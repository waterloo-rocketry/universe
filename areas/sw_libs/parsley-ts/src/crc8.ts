// Standard CRC-8 (poly 0x07, init 0x00, refin/refout=false, xorout=0x00).
// Matches Python's `crc8` library defaults — used by LiveTelemetryParser.

import crc8Lib from 'crc/crc8'
import { Buffer } from 'buffer'

export function crc8(data: Uint8Array): number {
    return crc8Lib(Buffer.from(data))
}
