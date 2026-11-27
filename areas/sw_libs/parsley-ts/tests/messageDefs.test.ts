import { describe, it, expect } from 'vitest'
import {
    MESSAGE_SCHEMAS,
    METADATA,
    ACTUATOR_CMD,
    ACTUATOR_STATUS,
    ALT_ARM_CMD,
    ALT_ARM_STATUS,
    SENSOR_ANALOG16,
    SENSOR_ANALOG32,
    SENSOR_2D_ANALOG24,
    SENSOR_3D_ANALOG16,
    UNDEFINED,
    GENERAL_BOARD_STATUS,
    LEDS_ON,
    LEDS_OFF,
    STREAM_DATA,
    STREAM_RETRY,
} from '../src/messageDefs.js'
import { msg_type } from '../src/messageTypes.js'
import { Enum, Numeric } from '../src/fields.js'

describe('MESSAGE_DEFS registry', () => {
    it('covers every key in msg_type exactly once', () => {
        const msgTypeKeys = Object.keys(msg_type).sort()
        const registryKeys = Object.keys(MESSAGE_SCHEMAS).sort()
        expect(registryKeys).toEqual(msgTypeKeys)
        expect(registryKeys).toHaveLength(27)
    })

    it('each entry has a static fields array', () => {
        for (const cls of Object.values(MESSAGE_SCHEMAS)) {
            expect(Array.isArray(cls.fields)).toBe(true)
        }
    })

    it('UNDEFINED, LEDS_ON, LEDS_OFF contain a timestamp', () => {
        expect(UNDEFINED.fields.map(f => f.name)).toEqual(['time'])
        expect(LEDS_ON.fields.map(f => f.name)).toEqual(['time'])
        expect(LEDS_OFF.fields.map(f => f.name)).toEqual(['time'])
    })

    it('STREAM_RETRY has only MSG_FIELD_TIMESTAMP', () => {
        expect(STREAM_RETRY.fields).toHaveLength(1)
        expect(STREAM_RETRY.fields[0]?.name).toBe('time')
    })
})

describe('Per-msg-type metadataField overrides', () => {
    it('defaults to METADATA (numeric) for most msg types', () => {
        expect(GENERAL_BOARD_STATUS.metadataField).toBe(METADATA)
        expect(LEDS_ON.metadataField).toBe(METADATA)
        expect(STREAM_DATA.metadataField.name).toBe('seq_id')
    })

    it('uses Enum-based metadata for actuator/altimeter/sensor types', () => {
        for (const cls of [ACTUATOR_CMD, ACTUATOR_STATUS, ALT_ARM_CMD, ALT_ARM_STATUS,
                           SENSOR_ANALOG16, SENSOR_ANALOG32, SENSOR_2D_ANALOG24, SENSOR_3D_ANALOG16]) {
            expect(cls.metadataField).toBeInstanceOf(Enum)
        }
    })

    it('non-enum-metadata classes use Numeric', () => {
        for (const cls of [GENERAL_BOARD_STATUS, LEDS_ON, LEDS_OFF, STREAM_DATA, STREAM_RETRY]) {
            expect(cls.metadataField).toBeInstanceOf(Numeric)
        }
    })
})
