import { describe, it, expect } from 'vitest'
import { BitString } from '../src/bitString.js'
import { Enum, Numeric } from '../src/fields.js'
import {
    MESSAGE_PRIO,
    MESSAGE_TYPE,
    BOARD_TYPE_ID,
    BOARD_INST_ID,
    MESSAGE_METADATA,
    MESSAGE_SID_LEN,
    TIMESTAMP_2,
    GENERAL_BOARD_STATUS,
    ACTUATOR_CMD,
} from '../src/messageDefs.js'
import {
    parseToObject,
    encodeData,
    formatLine,
    MESSAGE_SID_BYTES,
} from '../src/parseToObject.js'
import {
    USBDebugParser,
    LiveTelemetryParser,
    LoggerParser,
    BitstringParser,
} from '../src/parsers.js'
import { crc8 } from '../src/crc8.js'
import { ActuatorId, ActuatorState, AnalogSensorId } from '../src/messageTypes.js'
import { bigintToBytes, createMsgSid, encodeFields, splitFormatLine } from './utils.js'

function isError<T>(r: T | { error: string }): r is { error: string } & T {
    return r !== null && typeof r === 'object' && 'error' in (r as object)
}

// ============================================================
// parseToObject — additional input-format tests
// ============================================================

describe('parseToObject input coercion', () => {
    const sidBytes = createMsgSid('HIGH', 'GENERAL_BOARD_STATUS', 0, 'POWER', 'GROUND')
    const dataBytes = encodeFields([
        [TIMESTAMP_2, 1.0],
        [new Numeric('board_error_bitfield', 32), 0],
    ])

    it('accepts a Uint8Array SID', () => {
        const r = parseToObject(sidBytes, dataBytes)
        expect(isError(r)).toBe(false)
    })

    it('accepts a bigint SID equivalent to the byte form', () => {
        let sidInt = 0n
        for (const b of sidBytes) sidInt = (sidInt << 8n) | BigInt(b)
        const r = parseToObject(sidInt, dataBytes)
        if (isError(r)) throw new Error(r.error)
        expect(r.msg_type).toBe('GENERAL_BOARD_STATUS')
    })

    it('accepts a number SID', () => {
        let sidInt = 0
        for (const b of sidBytes) sidInt = sidInt * 256 + b
        const r = parseToObject(sidInt, dataBytes)
        if (isError(r)) throw new Error(r.error)
        expect(r.msg_type).toBe('GENERAL_BOARD_STATUS')
    })

    it('accepts number[] for data', () => {
        const r = parseToObject(sidBytes, Array.from(dataBytes))
        if (isError(r)) throw new Error(r.error)
        expect(r.msg_type).toBe('GENERAL_BOARD_STATUS')
    })
})

// ============================================================
// formatLine
// ============================================================

describe('formatLine', () => {
    it('header contains prio, type, board ids and msg_metadata', () => {
        const sid = createMsgSid('HIGH', 'GENERAL_BOARD_STATUS', 0, 'RLCS_RELAY', 'ROCKET')
        const data = encodeFields([
            [TIMESTAMP_2, 1.234],
            [new Numeric('board_error_bitfield', 32), 0],
        ])
        const r = parseToObject(sid, data)
        if (isError(r)) throw new Error(r.error)
        const { header, body } = splitFormatLine(formatLine(r))
        expect(header).toEqual(['HIGH', 'GENERAL_BOARD_STATUS', 'RLCS_RELAY', 'ROCKET', '0'])
        expect(body['time']).toBe('1.234')
        expect(body['board_error_bitfield']).toBe('E_NOMINAL')
    })

    it('includes sensor metadata as a string', () => {
        const sid = createMsgSid(
            'LOW',
            'SENSOR_ANALOG16',
            'SENSOR_PT_CHANNEL_1',
            'LOGGER',
            'ROCKET',
            new Enum('msg_metadata', 8, AnalogSensorId),
        )
        const data = encodeFields([
            [TIMESTAMP_2, 22.473],
            [new Numeric('value', 16), 13923],
        ])
        const r = parseToObject(sid, data)
        if (isError(r)) throw new Error(r.error)
        expect(formatLine(r)).toContain('SENSOR_PT_CHANNEL_1')
    })

    it('includes actuator metadata as a string', () => {
        const sid = createMsgSid(
            'MEDIUM',
            'ACTUATOR_CMD',
            'ACTUATOR_OX_INJECTOR_VALVE',
            'INJECTOR',
            'ROCKET',
            new Enum('msg_metadata', 8, ActuatorId),
        )
        const data = encodeFields([
            [TIMESTAMP_2, 1.0],
            [new Enum('cmd_state', 8, ActuatorState), 'ACT_STATE_ON'],
        ])
        const r = parseToObject(sid, data)
        if (isError(r)) throw new Error(r.error)
        expect(formatLine(r)).toContain('ACTUATOR_OX_INJECTOR_VALVE')
    })

    it('omits data section for empty-payload messages', () => {
        const sid = createMsgSid('LOW', 'LEDS_ON', 0, 'POWER', 'GROUND')
        const r = parseToObject(sid, new Uint8Array())
        if (isError(r)) throw new Error(r.error)
        const line = formatLine(r)
        expect(line).toContain('LEDS_ON')
        // No payload fields after the closing bracket.
        expect(line.trim().endsWith(']')).toBe(true)
    })
})

// ============================================================
// encodeData — reverse direction
// ============================================================

describe('encodeData', () => {
    it('round-trips a GENERAL_BOARD_STATUS via parseToObject', () => {
        const sidBytes = createMsgSid('HIGH', 'GENERAL_BOARD_STATUS', 7, 'POWER', 'GROUND')
        const dataBytes = encodeFields([
            [TIMESTAMP_2, 1.234],
            [new Numeric('board_error_bitfield', 32), 0xdeadbeef],
        ])
        const parsed = parseToObject(sidBytes, dataBytes)
        if (isError(parsed)) throw new Error(parsed.error)

        const encoded = encodeData({
            msg_prio: parsed.msg_prio,
            msg_type: parsed.msg_type,
            board_type_id: parsed.board_type_id,
            board_inst_id: parsed.board_inst_id,
            msg_metadata: parsed.msg_metadata,
            data: parsed.data as unknown as Record<string, unknown>,
        })

        // Re-parse and compare.
        const sidRoundtrip = bigintToBytes(encoded.sid, MESSAGE_SID_BYTES)
        const reparsed = parseToObject(sidRoundtrip, encoded.data)
        if (isError(reparsed)) throw new Error(reparsed.error)

        expect(reparsed.msg_type).toBe(parsed.msg_type)
        expect(reparsed.msg_prio).toBe(parsed.msg_prio)
        expect(reparsed.board_type_id).toBe(parsed.board_type_id)
        expect(reparsed.board_inst_id).toBe(parsed.board_inst_id)
        expect(reparsed.msg_metadata).toBe(parsed.msg_metadata)
        expect(reparsed.data).toBeInstanceOf(GENERAL_BOARD_STATUS)
    })

    it('encodes ACTUATOR_CMD with enum metadata', () => {
        const encoded = encodeData({
            msg_prio: 'HIGH',
            msg_type: 'ACTUATOR_CMD',
            board_type_id: 'INJECTOR',
            board_inst_id: 'ROCKET',
            msg_metadata: 'ACTUATOR_FUEL_INJECTOR_VALVE',
            data: { time: 2.0, cmd_state: 'ACT_STATE_ON' },
        })
        const sid = bigintToBytes(encoded.sid, MESSAGE_SID_BYTES)
        const r = parseToObject(sid, encoded.data)
        if (isError(r)) throw new Error(r.error)
        expect(r.msg_metadata).toBe('ACTUATOR_FUEL_INJECTOR_VALVE')
        expect(r.data).toBeInstanceOf(ACTUATOR_CMD)
        expect((r.data as { cmd_state: string }).cmd_state).toBe('ACT_STATE_ON')
    })

    it('encodes LEDS_ON with no payload', () => {
        const encoded = encodeData({
            msg_prio: 'LOW',
            msg_type: 'LEDS_ON',
            board_type_id: 'POWER',
            board_inst_id: 'GROUND',
            msg_metadata: 0,
            data: null,
        })
        expect(encoded.data.length).toBe(0)
    })

    it('throws on unknown msg_type', () => {
        expect(() =>
            encodeData({
                msg_prio: 'LOW',
                msg_type: 'NOT_REAL' as never,
                board_type_id: 'POWER',
                board_inst_id: 'GROUND',
                msg_metadata: 0,
                data: null,
            }),
        ).toThrow()
    })

    it('falls back to numeric encoding when enum-metadata msg_type gets a raw int', () => {
        // ACTUATOR_CMD's metadataField is Enum, but 0xFF is not a valid actuator_id name.
        // Per PR #66: encodeData should silently fall back to MESSAGE_METADATA.encode (numeric).
        const encoded = encodeData({
            msg_prio: 'HIGH',
            msg_type: 'ACTUATOR_CMD',
            board_type_id: 'INJECTOR',
            board_inst_id: 'ROCKET',
            msg_metadata: 0xff,
            data: { time: 0.0, cmd_state: 'ACT_STATE_ON' },
        })
        // Re-decode the SID to confirm the metadata byte is exactly 0xFF.
        const sidBytes = bigintToBytes(encoded.sid, MESSAGE_SID_BYTES)
        const bs = new BitString(sidBytes, MESSAGE_SID_LEN)
        bs.pop(MESSAGE_PRIO.length)
        bs.pop(MESSAGE_TYPE.length)
        bs.pop(BOARD_TYPE_ID.length)
        bs.pop(BOARD_INST_ID.length)
        const metaRaw = bs.pop(MESSAGE_METADATA.length)
        expect(MESSAGE_METADATA.decode(metaRaw)).toBe(0xff)
    })
})

// ============================================================
// USBDebugParser
// ============================================================

describe('USBDebugParser', () => {
    const parser = new USBDebugParser()

    function makeUsbLine(msgType: string, prio: string, btype: string, binst: string, payload: Uint8Array, metadata: number = 0): string {
        const sid = createMsgSid(prio, msgType, metadata, btype, binst)
        let sidInt = 0n
        for (const b of sid) sidInt = (sidInt << 8n) | BigInt(b)
        const sidHex = sidInt.toString(16).toUpperCase().padStart(MESSAGE_SID_BYTES * 2, '0')
        if (payload.length === 0) return `$${sidHex}`
        const bytesHex = Array.from(payload, (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(',')
        return `$${sidHex}:${bytesHex}`
    }

    it('parses a line with payload', () => {
        const payload = encodeFields([
            [TIMESTAMP_2, 0.5],
            [new Numeric('board_error_bitfield', 32), 0],
        ])
        const line = makeUsbLine('GENERAL_BOARD_STATUS', 'HIGH', 'POWER', 'GROUND', payload)
        const r = parser.parse(line)
        if (isError(r)) throw new Error(r.error)
        expect(r.msg_type).toBe('GENERAL_BOARD_STATUS')
    })

    it('parses a line with no payload (no colon)', () => {
        const line = makeUsbLine('LEDS_ON', 'LOW', 'POWER', 'GROUND', new Uint8Array())
        const r = parser.parse(line)
        if (isError(r)) throw new Error(r.error)
        expect(r.msg_type).toBe('LEDS_ON')
    })

    it('trims whitespace and null bytes', () => {
        const line = makeUsbLine('LEDS_ON', 'LOW', 'POWER', 'GROUND', new Uint8Array())
        const r = parser.parse(`\0\r\n  ${line}  \r\n\0`)
        if (isError(r)) throw new Error(r.error)
        expect(r.msg_type).toBe('LEDS_ON')
    })

    it('throws on missing $ prefix', () => {
        expect(() => parser.parse('1234ABCD')).toThrow(/Incorrect line format/)
    })

    it('throws on empty input', () => {
        expect(() => parser.parse('')).toThrow(/Incorrect line format/)
    })
})

// ============================================================
// LiveTelemetryParser
// ============================================================

describe('LiveTelemetryParser', () => {
    const parser = new LiveTelemetryParser()

    function buildFrame(sidBytes: Uint8Array, payload: Uint8Array): Uint8Array {
        // Layout: [0x02][len][sid:4 bytes][payload...][crc8]
        // len = total frame length including 0x02, len byte, sid, payload, crc.
        const frameLen = 2 + 4 + payload.length + 1
        const frame = new Uint8Array(frameLen)
        frame[0] = 0x02
        frame[1] = frameLen
        frame[2] = sidBytes[0]! & 0x1f
        frame[3] = sidBytes[1]!
        frame[4] = sidBytes[2]!
        frame[5] = sidBytes[3]!
        frame.set(payload, 6)
        frame[frameLen - 1] = crc8(frame.slice(0, frameLen - 1))
        return frame
    }

    it('parses a well-formed frame', () => {
        const sid = createMsgSid('HIGH', 'GENERAL_BOARD_STATUS', 0, 'POWER', 'GROUND')
        const payload = encodeFields([
            [TIMESTAMP_2, 1.0],
            [new Numeric('board_error_bitfield', 32), 0],
        ])
        const frame = buildFrame(sid, payload)
        const r = parser.parse(frame)
        if (isError(r)) throw new Error(r.error)
        expect(r.msg_type).toBe('GENERAL_BOARD_STATUS')
    })

    it('throws on short frame', () => {
        expect(() => parser.parse(new Uint8Array([0x02, 0x03, 0x00]))).toThrow(/length/)
    })

    it('throws on bad header byte', () => {
        const frame = new Uint8Array([0x00, 7, 0, 0, 0, 0, 0])
        expect(() => parser.parse(frame)).toThrow(/header/)
    })

    it('throws on bad CRC', () => {
        const sid = createMsgSid('LOW', 'LEDS_ON', 0, 'POWER', 'GROUND')
        const frame = buildFrame(sid, new Uint8Array())
        frame[frame.length - 1] ^= 0xff // corrupt the CRC
        expect(() => parser.parse(frame)).toThrow(/checksum/)
    })
})

// ============================================================
// LoggerParser
// ============================================================

describe('LoggerParser', () => {
    const parser = new LoggerParser()

    function buildPage(pageNumber: number, records: Array<{ sid: Uint8Array; data: Uint8Array }>): Uint8Array {
        const page = new Uint8Array(LoggerParser.PAGE_SIZE)
        page.fill(0xff) // padding
        page[0] = 0x4c // 'L'
        page[1] = 0x4f // 'O'
        page[2] = 0x47 // 'G'
        page[3] = pageNumber & 0xff

        let offset = 4
        const view = new DataView(page.buffer)
        for (const { sid, data } of records) {
            // SID as uint32 LE — take the 4 SID bytes and reinterpret as LE.
            let sidU32 = 0
            for (const b of sid) sidU32 = (sidU32 << 8) + b
            view.setUint32(offset, sidU32, true)
            view.setUint32(offset + 4, 0, true) // timestamp (unused)
            view.setUint8(offset + 8, data.length)
            offset += 9
            page.set(data, offset)
            offset += data.length
        }
        // The next "SID" will be 0xFFFFFFFF (padding) — sentinel hit, parser stops.
        return page
    }

    it('yields messages from a page', () => {
        const recs = [
            {
                sid: createMsgSid('LOW', 'LEDS_ON', 0, 'POWER', 'GROUND'),
                data: new Uint8Array(),
            },
            {
                sid: createMsgSid('HIGH', 'GENERAL_BOARD_STATUS', 0, 'POWER', 'GROUND'),
                data: encodeFields([
                    [TIMESTAMP_2, 0.5],
                    [new Numeric('board_error_bitfield', 32), 0],
                ]),
            },
        ]
        const page = buildPage(0, recs)
        const out = [...parser.parse(page, 0)]
        expect(out).toHaveLength(2)
        if (isError(out[0]!)) throw new Error(out[0]!.error)
        if (isError(out[1]!)) throw new Error(out[1]!.error)
        expect(out[0]!.msg_type).toBe('LEDS_ON')
        expect(out[1]!.msg_type).toBe('GENERAL_BOARD_STATUS')
    })

    it('throws on wrong page size', () => {
        const buf = new Uint8Array(100)
        expect(() => [...parser.parse(buf, 0)]).toThrow(/4096/)
    })

    it('throws on missing LOG magic', () => {
        const page = new Uint8Array(LoggerParser.PAGE_SIZE).fill(0xff)
        expect(() => [...parser.parse(page, 0)]).toThrow(/LOG/)
    })

    it('throws on wrong page number', () => {
        const page = buildPage(0, [])
        expect(() => [...parser.parse(page, 5)]).toThrow(/Page number/)
    })

    it('respects page number wraparound (% 256)', () => {
        const page = buildPage(258 & 0xff, [])
        const out = [...parser.parse(page, 258)]
        expect(out).toEqual([])
    })
})

// ============================================================
// BitstringParser
// ============================================================

describe('BitstringParser', () => {
    const parser = new BitstringParser()

    it('parses a packed BitString', () => {
        const bs = new BitString()
        // SID (29 bits)
        bs.push(...MESSAGE_PRIO.encode('HIGH'))
        bs.push(...MESSAGE_TYPE.encode('GENERAL_BOARD_STATUS'))
        bs.push(...BOARD_TYPE_ID.encode('POWER'))
        bs.push(...BOARD_INST_ID.encode('GROUND'))
        bs.push(...MESSAGE_METADATA.encode(0))
        // Payload
        bs.push(...TIMESTAMP_2.encode(1.0))
        bs.push(...new Numeric('board_error_bitfield', 32).encode(0))

        expect(bs.length).toBe(MESSAGE_SID_LEN + 16 + 32)
        const r = parser.parse(bs)
        if (isError(r)) throw new Error(r.error)
        expect(r.msg_type).toBe('GENERAL_BOARD_STATUS')
    })
})

// Suppress unused-import warning for tooling — these symbols are used implicitly via TS resolution.
void Enum
void ActuatorId
void ActuatorState
