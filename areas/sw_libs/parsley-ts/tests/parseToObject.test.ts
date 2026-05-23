/*
Ported from PR #56's `tests/test_parse_to_object.py`.

Each test reconstructs a CAN message (SID + payload), runs parseToObject, and
asserts on the typed result. Tests also lock in the per-msg-type metadata
typing (the improvement over PR #56).
*/

import { describe, it, expect } from 'vitest'
import { BitString } from '../src/bitString.js'
import { ASCII, Bitfield, Enum, Numeric } from '../src/fields.js'
import {
    BOARD_INST_ID,
    BOARD_TYPE_ID,
    MESSAGE_METADATA,
    MESSAGE_PRIO,
    MESSAGE_SID_LEN,
    MESSAGE_TYPE,
    MESSAGE_DEFS,
    TIMESTAMP_2,
    ACTUATOR_CMD,
    GENERAL_BOARD_STATUS,
} from '../src/messageDefs.js'
import { parseToObject } from '../src/parseToObject.js'
import {
    ActuatorId,
    ActuatorState,
    AltArmState,
    AltimeterId,
    AnalogSensorId,
    BoardErrorBitfieldOffset,
    DemSensor2DId,
    DemSensor3DId,
} from '../src/messageTypes.js'
import { createMsgSid, encodeFields, bigintToBytes, FLOAT_TOLERANCE } from './utils.js'

function isError(r: ReturnType<typeof parseToObject>): r is Extract<typeof r, { error: string }> {
    return 'error' in r
}

describe('parseToObject', () => {
    it('parses a GENERAL_BOARD_STATUS with bitfield', () => {
        const sid = createMsgSid('HIGH', 'GENERAL_BOARD_STATUS', 0, 'RLCS_RELAY', 'GROUND')
        const data = encodeFields([
            [TIMESTAMP_2, 1.234],
            [
                new Bitfield('board_error_bitfield', 32, 'E_NOMINAL', BoardErrorBitfieldOffset),
                'E_5V_OVER_VOLTAGE|E_5V_EFUSE_FAULT',
            ],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_type).toBe('GENERAL_BOARD_STATUS')
        expect(result.board_type_id).toBe('RLCS_RELAY')
        expect(result.board_inst_id).toBe('GROUND')
        expect(result.msg_prio).toBe('HIGH')
        expect(result.msg_metadata).toBe(0)
        expect(result.data).toBeInstanceOf(GENERAL_BOARD_STATUS)
        const payload = result.data as GENERAL_BOARD_STATUS
        expect(Math.abs(payload.time - 1.234)).toBeLessThan(FLOAT_TOLERANCE)
        expect(payload.board_error_bitfield).toBe('E_5V_OVER_VOLTAGE|E_5V_EFUSE_FAULT')
    })

    it('parses DEBUG_RAW with partial-byte ASCII field', () => {
        const sid = createMsgSid('LOW', 'DEBUG_RAW', 0, 'GPS', 'ROCKET')
        const data = encodeFields([
            [TIMESTAMP_2, 0.133],
            [new ASCII('string', 48), 'zZz'],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_type).toBe('DEBUG_RAW')
        expect(result.board_type_id).toBe('GPS')
        expect(result.board_inst_id).toBe('ROCKET')
        expect(result.msg_prio).toBe('LOW')
        expect(result.msg_metadata).toBe(0)
        expect(result.data).not.toBeNull()
        const payload = result.data as { time: number; string: string }
        expect(Math.abs(payload.time - 0.133)).toBeLessThan(FLOAT_TOLERANCE)
        expect(payload.string).toBe('zZz')
    })

    it('parses SENSOR_ANALOG16 with enum metadata', () => {
        const sid = createMsgSid(
            'MEDIUM',
            'SENSOR_ANALOG16',
            'SENSOR_5V_VOLT',
            'PAYLOAD',
            'ANY',
            new Enum('msg_metadata', 8, AnalogSensorId),
        )
        const data = encodeFields([
            [TIMESTAMP_2, 12.345],
            [new Numeric('value', 16), 3300],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_type).toBe('SENSOR_ANALOG16')
        expect(result.msg_metadata).toBe('SENSOR_5V_VOLT')
        const payload = result.data as { time: number; value: number }
        expect(Math.abs(payload.time - 12.345)).toBeLessThan(FLOAT_TOLERANCE)
        expect(payload.value).toBe(3300)
    })

    it('decodes nonzero numeric metadata on DEBUG_RAW', () => {
        const sid = createMsgSid('LOW', 'DEBUG_RAW', 42, 'GPS', 'ROCKET')
        const data = encodeFields([
            [TIMESTAMP_2, 1.0],
            [new ASCII('string', 48), 'abc'],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_metadata).toBe(42)
        expect(result.msg_type).toBe('DEBUG_RAW')
    })

    it('decodes ACTUATOR_CMD metadata as an actuator_id', () => {
        const sid = createMsgSid(
            'HIGH',
            'ACTUATOR_CMD',
            'ACTUATOR_FUEL_INJECTOR_VALVE',
            'INJECTOR',
            'ROCKET',
            new Enum('msg_metadata', 8, ActuatorId),
        )
        const data = encodeFields([
            [TIMESTAMP_2, 2.0],
            [new Enum('cmd_state', 8, ActuatorState), 'ACT_STATE_ON'],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_metadata).toBe('ACTUATOR_FUEL_INJECTOR_VALVE')
        const payload = result.data as { cmd_state: string }
        expect(payload.cmd_state).toBe('ACT_STATE_ON')
        expect(result.data).toBeInstanceOf(ACTUATOR_CMD)
    })

    it('decodes SENSOR_ANALOG16 metadata as SENSOR_5V_CURR', () => {
        const sid = createMsgSid(
            'MEDIUM',
            'SENSOR_ANALOG16',
            'SENSOR_5V_CURR',
            'POWER',
            'ROCKET',
            new Enum('msg_metadata', 8, AnalogSensorId),
        )
        const data = encodeFields([
            [TIMESTAMP_2, 5.0],
            [new Numeric('value', 16), 4800],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_metadata).toBe('SENSOR_5V_CURR')
        const payload = result.data as { value: number }
        expect(payload.value).toBe(4800)
    })

    it('decodes ALT_ARM_CMD metadata as ALTIMETER_STRATOLOGGER', () => {
        const sid = createMsgSid(
            'HIGH',
            'ALT_ARM_CMD',
            'ALTIMETER_STRATOLOGGER',
            'ALTIMETER',
            'ROCKET',
            new Enum('msg_metadata', 8, AltimeterId),
        )
        const data = encodeFields([
            [TIMESTAMP_2, 1.0],
            [new Enum('alt_arm_state', 8, AltArmState), 'ALT_ARM_STATE_ARMED'],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_metadata).toBe('ALTIMETER_STRATOLOGGER')
        const payload = result.data as { alt_arm_state: string }
        expect(payload.alt_arm_state).toBe('ALT_ARM_STATE_ARMED')
    })

    it('keeps STREAM_DATA metadata as numeric (SEQ_ID)', () => {
        const sid = createMsgSid('LOW', 'STREAM_DATA', 5, 'LOGGER', 'ROCKET')
        const data = encodeFields([
            [TIMESTAMP_2, 3.0],
            [new ASCII('data', 48), 'hello!'],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_metadata).toBe(5)
        const payload = result.data as { data: string }
        expect(payload.data).toBe('hello!')
    })

    it('decodes SENSOR_2D_ANALOG24 metadata as DEM 2D enum', () => {
        const sid = createMsgSid(
            'MEDIUM',
            'SENSOR_2D_ANALOG24',
            'DEM_2D_SENSOR_CANARD_MS5611_BARO_TEMP',
            'CANARD',
            'ROCKET',
            new Enum('msg_metadata', 8, DemSensor2DId),
        )
        const data = encodeFields([
            [TIMESTAMP_2, 1.5],
            [new Numeric('value_x', 24), 500],
            [new Numeric('value_y', 24), 1000],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_metadata).toBe('DEM_2D_SENSOR_CANARD_MS5611_BARO_TEMP')
        const payload = result.data as { value_x: number; value_y: number }
        expect(payload.value_x).toBe(500)
        expect(payload.value_y).toBe(1000)
    })

    it('decodes SENSOR_3D_ANALOG16 metadata as DEM 3D enum', () => {
        const sid = createMsgSid(
            'MEDIUM',
            'SENSOR_3D_ANALOG16',
            'DEM_3D_SENSOR_CANARD_LSM6DSV32X_ACCEL',
            'CANARD',
            'ROCKET',
            new Enum('msg_metadata', 8, DemSensor3DId),
        )
        const data = encodeFields([
            [TIMESTAMP_2, 1.5],
            [new Numeric('value_x', 16), 100],
            [new Numeric('value_y', 16), 200],
            [new Numeric('value_z', 16), 300],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.msg_metadata).toBe('DEM_3D_SENSOR_CANARD_LSM6DSV32X_ACCEL')
        const payload = result.data as { value_x: number; value_y: number; value_z: number }
        expect(payload.value_x).toBe(100)
        expect(payload.value_y).toBe(200)
        expect(payload.value_z).toBe(300)
    })

    it('falls back to numeric metadata when enum decode fails', () => {
        // Construct SID with metadata=0xFF — not in ActuatorId, so ACTUATOR_CMD's
        // metadataField throws and we fall back to numeric 255.
        const bs = new BitString()
        const [prioBits, prioLen] = MESSAGE_PRIO.encode('HIGH')
        const [typeBits, typeLen] = MESSAGE_TYPE.encode('ACTUATOR_CMD')
        const [btBits,   btLen]   = BOARD_TYPE_ID.encode('INJECTOR')
        const [biBits,   biLen]   = BOARD_INST_ID.encode('ROCKET')
        bs.push(prioBits, prioLen)
        bs.push(typeBits, typeLen)
        bs.push(btBits, btLen)
        bs.push(biBits, biLen)
        bs.push(0xffn, MESSAGE_METADATA.length)
        const sid = bigintToBytes(bs.pop(MESSAGE_SID_LEN), Math.ceil(MESSAGE_SID_LEN / 8))

        const data = encodeFields([
            [TIMESTAMP_2, 1.0],
            [new Enum('cmd_state', 8, ActuatorState), 'ACT_STATE_ON'],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.data).toBeInstanceOf(ACTUATOR_CMD)
        expect(result.msg_metadata).toBe(255)
        expect(result.msg_type).toBe('ACTUATOR_CMD')
        expect((result.data as { cmd_state: string }).cmd_state).toBe('ACT_STATE_ON')
    })

    it('returns ParsleyError on bad msg_type', () => {
        // SID = 0x0000 — msg_type bits are all zero -> UNDEFINED (which is valid)
        // but we don't have enough SID bits, so this should still error.
        const sid = new Uint8Array([0x00, 0x00])
        const data = new Uint8Array([0xab, 0xcd, 0xef, 0x00])
        const result = parseToObject(sid, data)
        expect(isError(result)).toBe(true)
        if (isError(result)) expect(result.error).toContain('error')
    })

    it('returns ParsleyError on empty SID and data', () => {
        const result = parseToObject(new Uint8Array(), new Uint8Array())
        expect(isError(result)).toBe(true)
        if (isError(result)) expect(result.error).toContain('error')
    })

    it('returns ParsleyError on messed-up SID', () => {
        const sid = new Uint8Array([0xff, 0xff, 0xff, 0xff])
        const data = new Uint8Array([0x00, 0x00, 0x00, 0x00])
        const result = parseToObject(sid, data)
        expect(isError(result)).toBe(true)
        if (isError(result)) expect(result.error).toContain('error')
    })

    it('softens bad board_type_id to hexified string but still returns success', () => {
        // Manually build SID with board_type_id = 0x1F (invalid)
        const bs = new BitString()
        const [prioBits, prioLen] = MESSAGE_PRIO.encode('LOW')
        const [typeBits, typeLen] = MESSAGE_TYPE.encode('LEDS_ON')
        bs.push(prioBits, prioLen)
        bs.push(typeBits, typeLen)
        bs.push(0x1fn, BOARD_TYPE_ID.length)
        bs.push(0x00n, BOARD_INST_ID.length)
        bs.push(0x00n, MESSAGE_METADATA.length)
        const sid = bigintToBytes(bs.pop(MESSAGE_SID_LEN), Math.ceil(MESSAGE_SID_LEN / 8))

        const result = parseToObject(sid, new Uint8Array())
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(String(result.board_type_id)).toBe('0x1F')
        expect(String(result.board_inst_id)).toBe('ANY')
        expect(result.msg_prio).toBe('LOW')
        expect(result.msg_type).toBe('LEDS_ON')
    })

    it('returns ParsleyError on truncated msg_data', () => {
        const sid = createMsgSid(
            'MEDIUM',
            'ALT_ARM_STATUS',
            'ALTIMETER_RAVEN',
            'ALTIMETER',
            'ANY',
            new Enum('msg_metadata', 8, AltimeterId),
        )
        // ALT_ARM_STATUS expects time(16) + alt_arm_state(8) + drogue_v(16) + main_v(16) = 56 bits = 7 bytes
        // Provide only 3 bytes.
        const data = new Uint8Array([0x00, 0x00, 0x01])
        const result = parseToObject(sid, data)
        expect(isError(result)).toBe(true)
        if (isError(result)) {
            expect(result.error).toContain('error')
            // SID-level fields must survive even on payload-decode failure (PR #66).
            expect(result.msg_prio).toBe('MEDIUM')
            expect(result.board_type_id).toBe('ALTIMETER')
            expect(result.board_inst_id).toBe('ANY')
        }
    })

    it('ParsleyError carries msg_prio for unknown msg_type', () => {
        // SID with valid msg_prio bits but msg_type = 0x7F (out of range).
        const bs = new BitString()
        const [prioBits, prioLen] = MESSAGE_PRIO.encode('LOW')
        bs.push(prioBits, prioLen)
        bs.push(0x7fn, MESSAGE_TYPE.length)
        const [btBits, btLen] = BOARD_TYPE_ID.encode('GPS')
        bs.push(btBits, btLen)
        const [biBits, biLen] = BOARD_INST_ID.encode('ROCKET')
        bs.push(biBits, biLen)
        bs.push(0n, MESSAGE_METADATA.length)
        const sid = bigintToBytes(bs.pop(MESSAGE_SID_LEN), Math.ceil(MESSAGE_SID_LEN / 8))

        const result = parseToObject(sid, new Uint8Array())
        expect(isError(result)).toBe(true)
        if (isError(result)) {
            expect(result.msg_prio).toBe('LOW')
        }
    })

    it('early errors (short SID) use empty msg_prio', () => {
        const result = parseToObject(new Uint8Array(), new Uint8Array())
        expect(isError(result)).toBe(true)
        if (isError(result)) expect(result.msg_prio).toBe('')
    })

    it('softens bad board_inst_id to hexified string but still returns success', () => {
        const bs = new BitString()
        const [prioBits, prioLen] = MESSAGE_PRIO.encode('LOW')
        const [typeBits, typeLen] = MESSAGE_TYPE.encode('LEDS_ON')
        bs.push(prioBits, prioLen)
        bs.push(typeBits, typeLen)
        const [btBits, btLen] = BOARD_TYPE_ID.encode('GPS')
        bs.push(btBits, btLen)
        bs.push(0x1fn, BOARD_INST_ID.length) // invalid board_inst_id
        bs.push(0x00n, MESSAGE_METADATA.length)
        const sid = bigintToBytes(bs.pop(MESSAGE_SID_LEN), Math.ceil(MESSAGE_SID_LEN / 8))

        const result = parseToObject(sid, new Uint8Array())
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(String(result.board_type_id)).toBe('GPS')
        expect(String(result.board_inst_id)).toBe('0x1F')
        expect(result.msg_type).toBe('LEDS_ON')
    })

    it('returns the right class instance via MESSAGE_DEFS for instanceof discrimination', () => {
        const sid = createMsgSid(
            'HIGH',
            'ACTUATOR_CMD',
            'ACTUATOR_OX_INJECTOR_VALVE',
            'INJECTOR',
            'ROCKET',
            new Enum('msg_metadata', 8, ActuatorId),
        )
        const data = encodeFields([
            [TIMESTAMP_2, 1.0],
            [new Enum('cmd_state', 8, ActuatorState), 'ACT_STATE_OFF'],
        ])

        const result = parseToObject(sid, data)
        if (isError(result)) throw new Error(`unexpected error: ${result.error}`)

        expect(result.data).toBeInstanceOf(MESSAGE_DEFS[result.msg_type])
        expect(result.data).toBeInstanceOf(ACTUATOR_CMD)
    })
})
