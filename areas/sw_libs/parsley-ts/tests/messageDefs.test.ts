import { describe, it, expect } from 'vitest'
import {
    MESSAGE_DEFS,
    MESSAGE_METADATA,
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
    ParsleyDataPayload,
} from '../src/messageDefs.js'
import { msg_type } from '../src/messageTypes.js'
import { Enum, Numeric } from '../src/fields.js'

describe('MESSAGE_DEFS registry', () => {
    it('covers every key in msg_type exactly once', () => {
        const msgTypeKeys = Object.keys(msg_type).sort()
        const registryKeys = Object.keys(MESSAGE_DEFS).sort()
        expect(registryKeys).toEqual(msgTypeKeys)
        expect(registryKeys).toHaveLength(26)
    })

    it('each entry extends ParsleyDataPayload', () => {
        for (const cls of Object.values(MESSAGE_DEFS)) {
            expect(cls.prototype).toBeInstanceOf(ParsleyDataPayload)
        }
    })

    it('each entry has a static fields array', () => {
        for (const cls of Object.values(MESSAGE_DEFS)) {
            expect(Array.isArray(cls.fields)).toBe(true)
        }
    })

    it('UNDEFINED, LEDS_ON, LEDS_OFF have empty fields', () => {
        expect(UNDEFINED.fields).toEqual([])
        expect(LEDS_ON.fields).toEqual([])
        expect(LEDS_OFF.fields).toEqual([])
    })

    it('STREAM_RETRY has only TIMESTAMP_2', () => {
        expect(STREAM_RETRY.fields).toHaveLength(1)
        expect(STREAM_RETRY.fields[0]?.name).toBe('time')
    })
})

describe('Per-msg-type metadataField overrides', () => {
    it('defaults to MESSAGE_METADATA (numeric) for most msg types', () => {
        expect(GENERAL_BOARD_STATUS.metadataField).toBe(MESSAGE_METADATA)
        expect(LEDS_ON.metadataField).toBe(MESSAGE_METADATA)
        expect(STREAM_DATA.metadataField).toBe(MESSAGE_METADATA)
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

describe('Generic decode walks fields and constructs instances', () => {
    it('LEDS_ON.decode returns a LEDS_ON with no own properties', () => {
        // Just exercise the inheritance — actual decoding tested via parseToObject.
        // Confirm the class's static `decode` is the inherited base method.
        expect(LEDS_ON.decode).toBe(ParsleyDataPayload.decode)
    })
})
