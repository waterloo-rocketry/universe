import { describe, it, expect } from 'vitest'
import { ParsleyObjectSchema, ParsleyErrorSchema } from '../src/schemas.js'

describe('ParsleyObjectSchema', () => {
    it('should validate a well-formed message with data', () => {
        const result = ParsleyObjectSchema.safeParse({
            board_type_id: 'INJECTOR',
            board_inst_id: 'ROCKET',
            msg_prio: 'HIGH',
            msg_type: 'ACTUATOR_CMD',
            msg_metadata: 'ACTUATOR_OX_INJECTOR_VALVE',
            data: { time: 1234, cmd_state: 'ACT_STATE_ON' },
        })
        expect(result.success).toBe(true)
    })

    it('should validate a message with null data', () => {
        const result = ParsleyObjectSchema.safeParse({
            board_type_id: 'ANY',
            board_inst_id: 'ANY',
            msg_prio: 'LOW',
            msg_type: 'LEDS_ON',
            msg_metadata: 0,
            data: null,
        })
        expect(result.success).toBe(true)
    })

    it('should validate msg_metadata as int in range 0-255', () => {
        const result = ParsleyObjectSchema.safeParse({
            board_type_id: 'GPS',
            board_inst_id: 'ROCKET',
            msg_prio: 'MEDIUM',
            msg_type: 'GPS_TIMESTAMP',
            msg_metadata: 42,
            data: null,
        })
        expect(result.success).toBe(true)
    })

    it('should validate msg_metadata as non-empty string', () => {
        const result = ParsleyObjectSchema.safeParse({
            board_type_id: 'INJECTOR',
            board_inst_id: 'ROCKET',
            msg_prio: 'HIGH',
            msg_type: 'ACTUATOR_CMD',
            msg_metadata: 'ACTUATOR_FUEL_INJECTOR_VALVE',
            data: null,
        })
        expect(result.success).toBe(true)
    })

    it('should reject empty msg_prio', () => {
        const result = ParsleyObjectSchema.safeParse({
            board_type_id: 'ANY',
            board_inst_id: 'ANY',
            msg_prio: '',
            msg_type: 'LEDS_ON',
            msg_metadata: 0,
            data: null,
        })
        expect(result.success).toBe(false)
    })

    it('should reject invalid msg_type', () => {
        const result = ParsleyObjectSchema.safeParse({
            board_type_id: 'ANY',
            board_inst_id: 'ANY',
            msg_prio: 'HIGH',
            msg_type: 'NONEXISTENT',
            msg_metadata: 0,
            data: null,
        })
        expect(result.success).toBe(false)
    })

    it('should reject msg_metadata int out of range', () => {
        const result = ParsleyObjectSchema.safeParse({
            board_type_id: 'ANY',
            board_inst_id: 'ANY',
            msg_prio: 'HIGH',
            msg_type: 'LEDS_ON',
            msg_metadata: 256,
            data: null,
        })
        expect(result.success).toBe(false)
    })

    it('should reject negative msg_metadata int', () => {
        const result = ParsleyObjectSchema.safeParse({
            board_type_id: 'ANY',
            board_inst_id: 'ANY',
            msg_prio: 'HIGH',
            msg_type: 'LEDS_ON',
            msg_metadata: -1,
            data: null,
        })
        expect(result.success).toBe(false)
    })

    it('should reject empty msg_metadata string', () => {
        const result = ParsleyObjectSchema.safeParse({
            board_type_id: 'ANY',
            board_inst_id: 'ANY',
            msg_prio: 'HIGH',
            msg_type: 'LEDS_ON',
            msg_metadata: '',
            data: null,
        })
        expect(result.success).toBe(false)
    })

    it('should reject a message missing required fields', () => {
        const result = ParsleyObjectSchema.safeParse({
            msg_prio: 'HIGH',
        })
        expect(result.success).toBe(false)
    })

    it('should accept a message with empty data record', () => {
        const result = ParsleyObjectSchema.safeParse({
            board_type_id: 'LOGGER',
            board_inst_id: 'GROUND',
            msg_prio: 'MEDIUM',
            msg_type: 'DEBUG_RAW',
            msg_metadata: 0,
            data: {},
        })
        expect(result.success).toBe(true)
    })
})

describe('ParsleyErrorSchema', () => {
    it('should validate a well-formed error', () => {
        const result = ParsleyErrorSchema.safeParse({
            board_type_id: 'INJECTOR',
            board_inst_id: 'ROCKET',
            msg_type: 'ACTUATOR_CMD',
            msg_metadata: 0,
            msg_data: '0xABCD',
            error: 'Parse failed',
        })
        expect(result.success).toBe(true)
    })

    it('should accept string msg_metadata in error', () => {
        const result = ParsleyErrorSchema.safeParse({
            board_type_id: 'ANY',
            board_inst_id: 'ANY',
            msg_type: 'SENSOR_ANALOG16',
            msg_metadata: 'SENSOR_5V_VOLT',
            msg_data: '0x00',
            error: 'truncated data',
        })
        expect(result.success).toBe(true)
    })

    it('should reject msg_metadata with invalid types', () => {
        const base = {
            board_type_id: 'ANY',
            board_inst_id: 'ANY',
            msg_type: 'LEDS_ON',
            msg_data: '0x00',
            error: 'bad metadata',
        }
        for (const bad of [{}, [], true]) {
            const result = ParsleyErrorSchema.safeParse({ ...base, msg_metadata: bad })
            expect(result.success).toBe(false)
        }
    })

    it('should accept empty string msg_metadata (permissive)', () => {
        const result = ParsleyErrorSchema.safeParse({
            board_type_id: 'ANY',
            board_inst_id: 'ANY',
            msg_type: 'LEDS_ON',
            msg_metadata: '',
            msg_data: '0x00',
            error: 'bad parse',
        })
        expect(result.success).toBe(true)
    })

    it('should accept out-of-range int msg_metadata (permissive)', () => {
        const result = ParsleyErrorSchema.safeParse({
            board_type_id: 'ANY',
            board_inst_id: 'ANY',
            msg_type: 'LEDS_ON',
            msg_metadata: 256,
            msg_data: '0x00',
            error: 'bad parse',
        })
        expect(result.success).toBe(true)
    })

    it('should reject an error missing required fields', () => {
        const result = ParsleyErrorSchema.safeParse({
            error: 'something broke',
        })
        expect(result.success).toBe(false)
    })
})
