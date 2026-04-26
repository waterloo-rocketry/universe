import { describe, it, expect } from 'vitest'
import { ASCII, Enum, Numeric, Floating, Switch, Bitfield } from '../src/fields.js'
import { BoardTypeId, BoardErrorBitfieldOffset } from '../src/messageTypes.js'

// Adapted from waterloo-rocketry/parsley tests/test_fields.py.
// The Python tests use `bytes`; we use the bigint LSB-aligned form that
// BitString.pop()/push() exchange with field encoders. Conversion: a byte
// sequence b"\xAA\xBB" of length 16 maps to the bigint 0xAABBn.

describe('ASCII', () => {
    it('encode and decode round-trip', () => {
        const a = new ASCII('string', 32)
        const [data, length] = a.encode('aBcD')
        expect(data).toBe(0x61426344n)
        expect(length).toBe(32)
        expect(a.decode(0x4c4d414fn)).toBe('LMAO')
    })

    it('decodes spaces', () => {
        const a = new ASCII('string', 32)
        expect(a.decode(0x20205720n)).toBe('  W ')
    })

    it('decodes implicit leading zeros (front padding)', () => {
        // Equivalent to Python's a.decode(b"\x57") with length 32 — the bigint
        // is 0x57n and the decoder reconstitutes the full 4-byte field.
        const a = new ASCII('string', 32)
        expect(a.decode(0x57n)).toBe('W')
    })

    it('encode left-aligns with trailing nulls', () => {
        const a = new ASCII('string', 32)
        const [data] = a.encode('a')
        expect(data).toBe(0x61000000n)
    })

    it('encode then decode is identity', () => {
        const a = new ASCII('string', 32)
        const [data] = a.encode('1234')
        expect(a.decode(data)).toBe('1234')
    })

    it('encode empty string', () => {
        const a = new ASCII('string', 32)
        expect(a.encode('')[0]).toBe(0n)
    })

    it('throws on non-string input', () => {
        const a = new ASCII('string', 16)
        // @ts-expect-error wrong type on purpose
        expect(() => a.encode(12)).toThrow()
        // @ts-expect-error wrong type on purpose
        expect(() => a.encode(Buffer.from('12'))).toThrow()
    })

    it('throws on non-ASCII characters', () => {
        const a = new ASCII('string', 16)
        expect(() => a.encode('😎')).toThrow()
    })

    it('throws when string overflows the field', () => {
        const a = new ASCII('string', 16)
        expect(() => a.encode('xdd')).toThrow()
    })
})

describe('Enum', () => {
    it('encodes and decodes against a real map', () => {
        const e = new Enum('enum', 8, BoardTypeId)
        const [data, length] = e.encode('INJECTOR')
        expect(data).toBe(0x01n)
        expect(length).toBe(8)
        expect(e.decode(0x0an)).toBe('PAYLOAD')
    })

    it('round-trips', () => {
        const e = new Enum('enum', 8, { a: 1, b: 10, c: 100 })
        expect(e.decode(e.encode('a')[0])).toBe('a')
    })

    it('rejects non-bijective maps', () => {
        expect(() => new Enum('enum', 8, { a: 1, b: 0, c: 1 })).toThrow()
    })

    it('rejects negative values', () => {
        expect(() => new Enum('enum', 8, { a: -1, b: 0, c: 1 })).toThrow()
    })

    it('rejects values that overflow the field', () => {
        expect(() => new Enum('enum', 8, { max: 0x3f3f3f3f })).toThrow()
    })

    it('encode throws on unknown key', () => {
        const e = new Enum('enum', 8, { a: 1, b: 2, c: 3 })
        expect(() => e.encode('d')).toThrow()
    })

    it('decode throws on unknown value', () => {
        const e = new Enum('enum', 8, { a: 1, b: 2, c: 3 })
        expect(() => e.decode(0xffn)).toThrow()
    })

    it('get_keys returns all keys', () => {
        const e = new Enum('enum', 8, { a: 1, b: 2 })
        expect(new Set(e.get_keys())).toEqual(new Set(['a', 'b']))
    })
})

describe('Numeric', () => {
    it('basic encode/decode', () => {
        const n = new Numeric('num', 8)
        const [data, length] = n.encode(250)
        expect(data).toBe(0xfan)
        expect(length).toBe(8)
        expect(n.decode(0x21n)).toBe(33)
    })

    it('honors integer scale', () => {
        const n = new Numeric('time', 8, 2)
        expect(n.encode(12)[0]).toBe(0x06n)
    })

    it('honors fractional scale', () => {
        const n = new Numeric('time', 8, 1 / 2)
        expect(n.encode(12)[0]).toBe(0x18n)
    })

    it('round-trips', () => {
        const n = new Numeric('num', 8)
        expect(n.decode(n.encode(255)[0])).toBe(255)
    })

    it('scale imprecision survives a round trip', () => {
        const n = new Numeric('time', 24, 1 / 1000)
        const [data] = n.encode(54.321)
        expect(n.decode(data)).toBeCloseTo(54.321, 3)
    })

    it('throws on non-number input', () => {
        const n = new Numeric('num', 8)
        // @ts-expect-error wrong type on purpose
        expect(() => n.encode('12')).toThrow()
        // @ts-expect-error wrong type on purpose
        expect(() => n.encode(Buffer.from('12'))).toThrow()
    })

    it('enforces unsigned bounds', () => {
        const n = new Numeric('num', 8)
        expect(() => n.encode(0)).not.toThrow()
        expect(() => n.encode(255)).not.toThrow()
        expect(() => n.encode(-1)).toThrow()
        expect(() => n.encode(256)).toThrow()
    })

    it('enforces signed bounds', () => {
        const n = new Numeric('num', 8, 1, true)
        expect(() => n.encode(-128)).not.toThrow()
        expect(() => n.encode(0)).not.toThrow()
        expect(() => n.encode(127)).not.toThrow()
        expect(() => n.encode(-129)).toThrow()
        expect(() => n.encode(128)).toThrow()
    })

    it('enforces scaled bounds', () => {
        const u = new Numeric('num', 8, 1 / 4)
        expect(() => u.encode(0)).not.toThrow()
        expect(() => u.encode(63)).not.toThrow()
        expect(() => u.encode(-1)).toThrow()
        expect(() => u.encode(64)).toThrow()

        const s = new Numeric('num', 8, 1 / 4, true)
        expect(() => s.encode(-32)).not.toThrow()
        expect(() => s.encode(0)).not.toThrow()
        expect(() => s.encode(31)).not.toThrow()
        expect(() => s.encode(-33)).toThrow()
        expect(() => s.encode(32)).toThrow()
    })

    it('handles negative scale', () => {
        const n = new Numeric('num', 8, -1 / 2)
        expect(() => n.encode(-5)).not.toThrow()
        expect(() => n.encode(5)).toThrow()
    })

    it('signed two\'s complement decode', () => {
        const n = new Numeric('num', 8, 1, true)
        expect(n.decode(0xfcn)).toBe(-4)
        expect(n.decode(0x7fn)).toBe(127)
        expect(n.decode(0x80n)).toBe(-128)
    })

    it('little-endian byte-swaps', () => {
        const n = new Numeric('num', 16, 1, false, false)
        // value 0x1234 → bytes [0x34, 0x12] → bigint 0x3412n
        expect(n.encode(0x1234)[0]).toBe(0x3412n)
        expect(n.decode(0x3412n)).toBe(0x1234)
    })
})

describe('Floating', () => {
    it('round-trips dyadic rationals', () => {
        const f = new Floating('Num')
        for (const v of [2.0, 0.5, 2.5, 27.015625, 1.3125, 69.0, 420.0]) {
            expect(f.decode(f.encode(v)[0])).toBe(v)
        }
    })

    it('little-endian round-trip', () => {
        const f = new Floating('Num', false)
        expect(f.decode(f.encode(2.0)[0])).toBe(2.0)
        expect(f.decode(f.encode(0.5)[0])).toBe(0.5)
    })

    it('encodes 9.8125 to the documented bit pattern', () => {
        // Python comment in fields.py: 9.8125 → b'\x41\x1d\x00\x00'
        const f = new Floating('Num')
        expect(f.encode(9.8125)[0]).toBe(0x411d0000n)
    })

    it('throws on non-number input', () => {
        const f = new Floating('Num')
        // @ts-expect-error wrong type on purpose
        expect(() => f.encode('not a number')).toThrow()
    })
})

describe('Switch', () => {
    it('decodes, encodes, and dispatches fields', () => {
        const inner = new Numeric('x', 8)
        const sw = new Switch(
            'status',
            8,
            { a: 0x01, b: 0x02, c: 0x03 },
            { a: [inner], b: [], c: [] },
        )
        const [data, length] = sw.encode('a')
        expect(data).toBe(0x01n)
        expect(length).toBe(8)
        const decoded = sw.decode(data)
        expect(decoded).toBe('a')
        expect(sw.get_fields(decoded)).toEqual([inner])
    })

    it('get_keys returns all keys', () => {
        const sw = new Switch('status', 8, { a: 1, b: 2 }, { a: [], b: [] })
        expect(new Set(sw.get_keys())).toEqual(new Set(['a', 'b']))
    })

    it('get_fields throws on unknown key', () => {
        const sw = new Switch('status', 8, { a: 1 }, { a: [] })
        expect(() => sw.get_fields('nope')).toThrow()
    })
})

describe('Bitfield', () => {
    const make = () =>
        new Bitfield('general_board_status', 16, 'E_NOMINAL', BoardErrorBitfieldOffset)

    const singleBitCases: [bigint, string][] = [
        [0x0000n, 'E_NOMINAL'],
        [0x0001n, 'E_5V_OVER_CURRENT'],
        [0x0002n, 'E_5V_OVER_VOLTAGE'],
        [0x0004n, 'E_5V_UNDER_VOLTAGE'],
        [0x0008n, 'E_12V_OVER_CURRENT'],
        [0x0010n, 'E_12V_OVER_VOLTAGE'],
        [0x0020n, 'E_12V_UNDER_VOLTAGE'],
        [0x0040n, 'E_BATT_OVER_CURRENT'],
        [0x0080n, 'E_BATT_OVER_VOLTAGE'],
        [0x0100n, 'E_BATT_UNDER_VOLTAGE'],
        [0x0200n, 'E_MOTOR_OVER_CURRENT'],
        [0x0400n, 'E_IO_ERROR'],
        [0x0800n, 'E_FS_ERROR'],
        [0x1000n, 'E_WATCHDOG_TIMEOUT'],
        [0x2000n, 'E_12V_EFUSE_FAULT'],
        [0x4000n, 'E_5V_EFUSE_FAULT'],
        [0x8000n, 'E_PT_OUT_OF_RANGE'],
    ]
    it.each(singleBitCases)('decode 0x%s → %s', (data, expected) => {
        expect(make().decode(data)).toBe(expected)
    })

    it('decodes combined flags', () => {
        const bf = make()
        expect(bf.decode(0x0003n)).toBe('E_5V_OVER_CURRENT|E_5V_OVER_VOLTAGE')
        expect(bf.decode(0x0005n)).toBe('E_5V_OVER_CURRENT|E_5V_UNDER_VOLTAGE')
    })

    it('decodes a custom (raw) bitfield as a zero-padded hex string', () => {
        const bf = new Bitfield('raw', 16)
        expect(bf.decode(0x0006n)).toBe('0x0006')
        expect(bf.decode(0x0000n)).toBe('0x0000')
        // odd bit-widths round up to the next nibble
        const bf12 = new Bitfield('raw', 12)
        expect(bf12.decode(0x00fn)).toBe('0x00f')
    })

    const encodeCases: [string, bigint][] = [
        ['E_NOMINAL', 0x0000n],
        ['E_5V_OVER_CURRENT', 0x0001n],
        ['E_5V_OVER_VOLTAGE', 0x0002n],
        ['E_5V_OVER_CURRENT|E_5V_OVER_VOLTAGE', 0x0003n],
        ['E_5V_OVER_CURRENT|E_5V_UNDER_VOLTAGE', 0x0005n],
        ['E_WATCHDOG_TIMEOUT', 0x1000n],
    ]
    it.each(encodeCases)('encode %s', (value, expected) => {
        const [data, length] = make().encode(value)
        expect(data).toBe(expected)
        expect(length).toBe(16)
    })

    it('encode/decode round-trip', () => {
        const bf = make()
        for (const v of [
            'E_NOMINAL',
            'E_5V_OVER_CURRENT',
            'E_5V_OVER_CURRENT|E_5V_OVER_VOLTAGE',
        ]) {
            expect(bf.decode(bf.encode(v)[0])).toBe(v)
        }
    })

    it('throws on unknown flag', () => {
        expect(() => make().encode('E_NOT_A_REAL_FLAG')).toThrow()
    })

    it('throws on non-string value', () => {
        // @ts-expect-error wrong type on purpose
        expect(() => make().encode(42)).toThrow()
    })

    it('encodes a custom (raw) bitfield', () => {
        const bf = new Bitfield('raw', 16)
        const [data, length] = bf.encode('0b110')
        expect(data).toBe(0x0006n)
        expect(length).toBe(16)
    })

    it('custom bitfield rejects unparseable strings', () => {
        const bf = new Bitfield('raw', 16)
        expect(() => bf.encode('not_a_number')).toThrow()
    })

    it('custom bitfield rejects overflow', () => {
        const bf = new Bitfield('raw', 8)
        expect(() => bf.encode('0x1FF')).toThrow()
    })

    it('constructor rejects offsets beyond field length', () => {
        expect(() => new Bitfield('raw', 4, 'NONE', { HIGH: 4 })).toThrow()
        expect(() => new Bitfield('raw', 4, 'NONE', { LOW: -1 })).toThrow()
    })
})
