import { describe, it, expect } from 'vitest'
import { crc8 } from '../src/crc8.js'

describe('crc8 (CRC-8 SMBus: poly 0x07, init 0)', () => {
    it('CRC of empty buffer is 0', () => {
        expect(crc8(new Uint8Array())).toBe(0)
    })

    it('matches the standard check vector for "123456789"', () => {
        // Standard CRC-8 check vector: "123456789" -> 0xF4
        const data = new TextEncoder().encode('123456789')
        expect(crc8(data)).toBe(0xf4)
    })

    it('is deterministic', () => {
        const buf = new Uint8Array([0x01, 0x02, 0x03, 0xff, 0xab])
        expect(crc8(buf)).toBe(crc8(buf))
    })

    it('appending the CRC and re-CRCing yields 0 (residue property)', () => {
        const buf = new Uint8Array([0x10, 0x20, 0x30])
        const c = crc8(buf)
        const withCrc = new Uint8Array([...buf, c])
        expect(crc8(withCrc)).toBe(0)
    })
})
