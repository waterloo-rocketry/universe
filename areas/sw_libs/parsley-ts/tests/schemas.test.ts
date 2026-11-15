import { describe, it, expect } from 'vitest'
import { ParsleyErrorSchema } from '../src/schemas.js'

describe('ParsleyErrorSchema', () => {
    it('should validate a well-formed error', () => {
        const result = ParsleyErrorSchema.safeParse({
            msg_prio: 'HIGH',
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
            msg_prio: 'MEDIUM',
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
            msg_prio: 'LOW',
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

    it('should reject an error missing msg_prio', () => {
        const result = ParsleyErrorSchema.safeParse({
            board_type_id: 'INJECTOR',
            board_inst_id: 'ROCKET',
            msg_type: 'ACTUATOR_CMD',
            msg_metadata: 0,
            msg_data: '0xABCD',
            error: 'Parse failed',
        })
        expect(result.success).toBe(false)
    })
})
