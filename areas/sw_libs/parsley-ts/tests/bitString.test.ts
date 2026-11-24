import { describe, it, expect } from 'vitest'
import { BitString } from '../src/bitString.js'

describe('BitString', () => {
    it('push and pop multiple bytes', () => {
        const bs = new BitString()
        bs.push(0xAA, 8)
        bs.push(0xBB, 8)
        bs.push(0xCC, 8)
        expect(bs.pop(24)).toBe(0xAABBCCn)
    })

    it('direct init from Uint8Array', () => {
        const bs = new BitString(new Uint8Array([0x31, 0x41]))
        expect(bs.pop(16)).toBe(0x3141n)
    })

    it('direct init with padding', () => {
        const bs = new BitString(new Uint8Array([0x03, 0x14]))
        expect(bs.pop(4)).toBe(0x00n)
        expect(bs.pop(12)).toBe(0x314n)
    })

    it('direct init with explicit bit length', () => {
        const bs = new BitString(new Uint8Array([0x03, 0x14]), 12)
        expect(bs.pop(12)).toBe(0x314n)
    })

    it('pop zero bits from empty', () => {
        const bs = new BitString()
        expect(bs.pop(0)).toBe(0n)
    })

    it('LSB byte ordering preserved', () => {
        const bs = new BitString()
        bs.push(0x0010, 16)
        expect(bs.pop(8)).toBe(0x00n)
        expect(bs.pop(8)).toBe(0x10n)
    })

    it('non-octet push and pop', () => {
        const bs = new BitString()
        bs.push(0x15, 5)  // ___1 0101
        bs.push(0x03, 2)  //      __11
        bs.push(0x01, 2)  //      __01
        expect(bs.pop(9)).toBe(0x15Dn) // 1 0101 1101
    })

    it('push fewer bits than value holds (padding)', () => {
        const bs = new BitString()
        bs.push(0xFF, 32)
        expect(bs.pop(24)).toBe(0x000000n)
        expect(bs.pop(8)).toBe(0xFFn)
    })

    it('interleaved push and pop', () => {
        const bs = new BitString()
        bs.push(0x81, 8)       // 1000 0001
        expect(bs.pop(6)).toBe(0x20n) // 10 0000
        bs.push(0x3C, 6)       // 11 1100
        expect(bs.pop(8)).toBe(0x7Cn) // 0111 1100
    })

    it('throws RangeError when popping more than available', () => {
        const bs = new BitString()
        bs.push(0x12, 8)
        expect(() => bs.pop(16)).toThrow(RangeError)
    })

    it('pop with variableLength returns available bits', () => {
        const bs = new BitString()
        bs.push(0xFF, 8)
        const res = bs.pop(16, true)
        expect(res).toBe(0xFFn)
    })

    it('pushFront prepends bits', () => {
        const bs = new BitString()
        bs.push(0xAA, 8)       // 1010 1010
        bs.pushFront(0x01, 4)  // 0001
        expect(bs.pop(12)).toBe(0x1AAn) // 0001 1010 1010
    })

    it('pop single bit', () => {
        const bs = new BitString(new Uint8Array([0b10110000]), 8)
        expect(bs.pop(1)).toBe(1n)
        expect(bs.pop(1)).toBe(0n)
        expect(bs.pop(1)).toBe(1n)
        expect(bs.pop(1)).toBe(1n)
    })

    it('length tracks remaining bits', () => {
        const bs = new BitString(new Uint8Array([0xFF, 0xFF]), 16)
        expect(bs.length).toBe(16)
        bs.pop(5)
        expect(bs.length).toBe(11)
        bs.push(0x00, 3)
        expect(bs.length).toBe(14)
    })

    it('push then pushFront then pop all', () => {
        const bs = new BitString()
        bs.push(0b1100, 4)
        bs.pushFront(0b0011, 4)
        expect(bs.pop(8)).toBe(0b00111100n)
    })

    it('variableLength on empty returns 0', () => {
        const bs = new BitString()
        expect(bs.pop(8, true)).toBe(0n)
    })

    it('push throws error for negative field length', () => {
        const bs = new BitString()
        expect(() => bs.push(0x12, -1)).toThrow('Field length must be non-negative, got -1.')
    })

    it('pushFront throws error for negative field length', () => {
        const bs = new BitString()
        expect(() => bs.pushFront(0x12, -5)).toThrow('Field length must be non-negative, got -5.')
    })
})
