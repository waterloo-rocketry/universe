/*
Input-format parsers. Each one peels its transport wrapper off a frame and
delegates to `parseToObject`.

Mirrors Python `parse_to_object.py`'s ParsleyParser hierarchy:
- USBDebugParser     — ASCII USB-debug lines: "$<sid>:<bytes>"
- LiveTelemetryParser — binary frame with 1-byte header, length, SID, payload, CRC8
- LoggerParser       — 4096-byte logger page, yields multiple messages
- BitstringParser    — raw BitString input
*/

import { BitString } from './bitString.js'
import { crc8 } from './crc8.js'
import { MESSAGE_SID_LEN } from './messageDefs.js'
import type { ParsleyMessage } from './messageDefs.js'
import { parseToObject, MESSAGE_SID_BYTES } from './parseToObject.js'
import type { ParsleyError } from './schemas.js'

export type ParseResult = ParsleyMessage | ParsleyError

// ============================================================
// Abstract base
// ============================================================

export abstract class ParsleyParser {
    abstract parse(...args: unknown[]): unknown
}

// ============================================================
// USBDebugParser — "$<sid_hex>[:<byte_hex>,<byte_hex>,...]"
// ============================================================

export class USBDebugParser extends ParsleyParser {
    override parse(line: string): ParseResult {
        const trimmed = line.replace(/^[\s\0\r\n]+|[\s\0\r\n]+$/g, '')
        if (trimmed.length === 0 || trimmed[0] !== '$') {
            throw new Error('Incorrect line format')
        }
        const body = trimmed.slice(1)

        let sid: bigint
        let data: number[]
        if (body.includes(':')) {
            const [sidStr, dataStr] = body.split(':') as [string, string]
            sid = BigInt('0x' + sidStr)
            data = dataStr.length === 0 ? [] : dataStr.split(',').map((b) => parseInt(b, 16))
        } else {
            sid = BigInt('0x' + body)
            data = []
        }

        return parseToObject(sid, data)
    }
}

// ============================================================
// LiveTelemetryParser — binary frame from the live-telemetry radio link
// Layout: [0x02][len][sid:4 (top 3 bits masked)][...payload...][crc8]
// ============================================================

export class LiveTelemetryParser extends ParsleyParser {
    override parse(frame: Uint8Array): ParseResult {
        if (frame.length < 7) throw new Error('Incorrect frame length')
        if (frame[0] !== 0x02) throw new Error('Incorrect frame header')

        const frameLen = frame[1]!
        if (frameLen > frame.length) throw new Error('Frame length exceeds buffer')

        // SID is 4 bytes big-endian, top 3 bits of byte 2 are reserved (mask with 0x1F).
        const sidBytes = new Uint8Array(MESSAGE_SID_BYTES)
        sidBytes[0] = frame[2]! & 0x1f
        sidBytes[1] = frame[3]!
        sidBytes[2] = frame[4]!
        sidBytes[3] = frame[5]!

        const msgData = frame.slice(6, frameLen - 1)
        const expectedCrc = frame[frameLen - 1]!
        const computedCrc = crc8(frame.slice(0, frameLen - 1))

        if (computedCrc !== expectedCrc) {
            throw new Error(
                `Bad checksum, expected ${expectedCrc.toString(16).toUpperCase().padStart(2, '0')} but got ${computedCrc.toString(16).toUpperCase().padStart(2, '0')}`,
            )
        }

        return parseToObject(sidBytes, msgData)
    }
}

// ============================================================
// LoggerParser — 4096-byte page, yields multiple messages
//
// Page layout (little-endian unless noted):
//   bytes 0-2  : 'L','O','G' magic
//   byte  3    : page number (uint8, page_number % 256)
//   bytes 4..  : repeated records, each:
//                  bytes 0-3 : SID  (uint32 LE)
//                  bytes 4-7 : timestamp (uint32 LE, ignored)
//                  byte  8   : DLC (uint8, 0..8)
//                  bytes 9.. : DLC bytes of payload
//   record loop stops when (SID & 0xE000_0000) != 0 (sentinel/padding)
// ============================================================

export class LoggerParser extends ParsleyParser {
    static readonly PAGE_SIZE = 4096
    static readonly HEADER_LEN = 9 // 4 SID + 4 timestamp + 1 DLC
    static readonly LOG_MAGIC = new Uint8Array([0x4c, 0x4f, 0x47]) // 'LOG'

    override *parse(buf: Uint8Array, pageNumber: number): Generator<ParseResult, void, void> {
        if (buf.length !== LoggerParser.PAGE_SIZE) {
            throw new Error('Logger message must be exactly 4096 bytes')
        }
        if (buf[0] !== 0x4c || buf[1] !== 0x4f || buf[2] !== 0x47) {
            throw new Error("Missing 'LOG' signature")
        }
        const expectedPage = pageNumber & 0xff
        if (buf[3] !== expectedPage) {
            throw new Error(`Page number mismatch: expected ${expectedPage}, got ${buf[3]}`)
        }

        let offset = 4
        const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
        while (LoggerParser.PAGE_SIZE - offset > LoggerParser.HEADER_LEN) {
            const sidU32 = view.getUint32(offset, true)
            // view.getUint32(offset + 4, true) // timestamp, unused
            const dlc = view.getUint8(offset + 8)

            if ((sidU32 & 0xe000_0000) !== 0) break
            if (dlc > 8) throw new Error(`DLC out of range (0-8), got ${dlc}`)

            offset += LoggerParser.HEADER_LEN
            const data = buf.slice(offset, offset + dlc)
            offset += dlc

            yield parseToObject(BigInt(sidU32), data)
        }
    }
}

// ============================================================
// BitstringParser — pops SID then remainder, delegates to parseToObject
// ============================================================

export class BitstringParser extends ParsleyParser {
    override parse(bitStr: BitString): ParseResult {
        const sidBig = bitStr.pop(MESSAGE_SID_LEN)
        // Remaining bits, packed back into bytes (length rounded up).
        const remaining = bitStr.length
        const dataBytes = new Uint8Array(Math.ceil(remaining / 8))
        if (remaining > 0) {
            let v = bitStr.pop(remaining)
            for (let i = dataBytes.length - 1; i >= 0; i--) {
                dataBytes[i] = Number(v & 0xffn)
                v >>= 8n
            }
        }
        return parseToObject(sidBig, dataBytes)
    }
}
