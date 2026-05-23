/*
Standard CRC-8 (poly 0x07, init 0x00, refin/refout=false, xorout=0x00).
Matches Python's `crc8` library defaults — used by LiveTelemetryParser.
*/

export function crc8(data: Uint8Array): number {
    let crc = 0
    for (const byte of data) {
        crc ^= byte
        for (let i = 0; i < 8; i++) {
            crc = (crc & 0x80) !== 0 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff
        }
    }
    return crc
}
