import { describe, it, expect } from 'vitest'
import {
    GeneralBoardStatusPayload,
    ResetCmdPayload,
    DebugRawPayload,
    ConfigSetPayload,
    ConfigStatusPayload,
    ActuatorCmdPayload,
    ActuatorStatusPayload,
    AltArmCmdPayload,
    AltArmStatusPayload,
    SensorAnalog16Payload,
    SensorAnalog32Payload,
    Sensor2DAnalog24Payload,
    Sensor3DAnalog16Payload,
    GpsTimestampPayload,
    GpsLatitudePayload,
    GpsLongitudePayload,
    GpsAltitudePayload,
    GpsInfoPayload,
    StreamStatusPayload,
    StreamDataPayload,
    StreamRetryPayload,
    LedsOnPayload,
    LedsOffPayload,
    PayloadSchemas,
    getPayloadSchema,
} from '../src/payloads.js'

// ============================================================
// Helper — most payloads require time + msg_metadata
// ============================================================

const BASE = { time: 1234, msg_metadata: 0 }

// ============================================================
// Individual Payload Schema Tests
// ============================================================

describe('GeneralBoardStatusPayload', () => {
    it('should accept a valid payload', () => {
        const result = GeneralBoardStatusPayload.safeParse({
            ...BASE,
            board_error_bitfield: 'E_NOMINAL',
        })
        expect(result.success).toBe(true)
    })

    it('should reject a payload missing board_error_bitfield', () => {
        const result = GeneralBoardStatusPayload.safeParse({ ...BASE })
        expect(result.success).toBe(false)
    })

    it('should reject a payload missing time', () => {
        const result = GeneralBoardStatusPayload.safeParse({
            msg_metadata: 0,
            board_error_bitfield: 'E_NOMINAL',
        })
        expect(result.success).toBe(false)
    })
})

describe('ResetCmdPayload', () => {
    it('should accept a valid payload', () => {
        const result = ResetCmdPayload.safeParse({
            ...BASE,
            board_type_id: 'INJECTOR',
            board_inst_id: 'ROCKET',
        })
        expect(result.success).toBe(true)
    })

    it('should reject a payload with numeric board_type_id', () => {
        const result = ResetCmdPayload.safeParse({
            ...BASE,
            board_type_id: 1,
            board_inst_id: 'ROCKET',
        })
        expect(result.success).toBe(false)
    })

    it('should reject invalid board_type_id enum key', () => {
        const result = ResetCmdPayload.safeParse({
            ...BASE,
            board_type_id: 'NONEXISTENT',
            board_inst_id: 'ROCKET',
        })
        expect(result.success).toBe(false)
    })
})

describe('DebugRawPayload', () => {
    it('should accept a valid payload', () => {
        const result = DebugRawPayload.safeParse({
            ...BASE,
            string: 'zZz',
        })
        expect(result.success).toBe(true)
    })

    it('should reject a payload missing string', () => {
        const result = DebugRawPayload.safeParse({ ...BASE })
        expect(result.success).toBe(false)
    })
})

describe('ConfigSetPayload', () => {
    it('should accept a valid payload', () => {
        const result = ConfigSetPayload.safeParse({
            ...BASE,
            board_type_id: 'LOGGER',
            board_inst_id: 'GROUND',
            config_id: 1,
            config_value: 42,
        })
        expect(result.success).toBe(true)
    })

    it('should reject a payload with string config_id', () => {
        const result = ConfigSetPayload.safeParse({
            ...BASE,
            board_type_id: 'LOGGER',
            board_inst_id: 'GROUND',
            config_id: 'one',
            config_value: 42,
        })
        expect(result.success).toBe(false)
    })
})

describe('ConfigStatusPayload', () => {
    it('should accept a valid payload', () => {
        const result = ConfigStatusPayload.safeParse({
            ...BASE,
            config_id: 1,
            config_value: 100,
        })
        expect(result.success).toBe(true)
    })
})

describe('ActuatorCmdPayload', () => {
    it('should accept a valid payload', () => {
        const result = ActuatorCmdPayload.safeParse({
            time: 1234,
            msg_metadata: 'ACTUATOR_OX_INJECTOR_VALVE',
            cmd_state: 'ACT_STATE_ON',
        })
        expect(result.success).toBe(true)
    })

    it('should reject a payload with numeric cmd_state', () => {
        const result = ActuatorCmdPayload.safeParse({
            time: 1234,
            msg_metadata: 'ACTUATOR_OX_INJECTOR_VALVE',
            cmd_state: 0,
        })
        expect(result.success).toBe(false)
    })

    it('should reject invalid actuator id in msg_metadata', () => {
        const result = ActuatorCmdPayload.safeParse({
            time: 1234,
            msg_metadata: 'NONEXISTENT_ACTUATOR',
            cmd_state: 'ACT_STATE_ON',
        })
        expect(result.success).toBe(false)
    })
})

describe('ActuatorStatusPayload', () => {
    it('should accept a valid payload', () => {
        const result = ActuatorStatusPayload.safeParse({
            time: 1234,
            msg_metadata: 'ACTUATOR_FUEL_INJECTOR_VALVE',
            cmd_state: 'ACT_STATE_OFF',
            curr_state: 'ACT_STATE_ON',
        })
        expect(result.success).toBe(true)
    })

    it('should reject a payload missing curr_state', () => {
        const result = ActuatorStatusPayload.safeParse({
            time: 1234,
            msg_metadata: 'ACTUATOR_FUEL_INJECTOR_VALVE',
            cmd_state: 'ACT_STATE_ON',
        })
        expect(result.success).toBe(false)
    })
})

describe('AltArmCmdPayload', () => {
    it('should accept a valid payload', () => {
        const result = AltArmCmdPayload.safeParse({
            time: 1234,
            msg_metadata: 'ALTIMETER_RAVEN',
            alt_arm_state: 'ALT_ARM_STATE_ARMED',
        })
        expect(result.success).toBe(true)
    })

    it('should reject invalid altimeter id', () => {
        const result = AltArmCmdPayload.safeParse({
            time: 1234,
            msg_metadata: 'NONEXISTENT',
            alt_arm_state: 'ALT_ARM_STATE_ARMED',
        })
        expect(result.success).toBe(false)
    })
})

describe('AltArmStatusPayload', () => {
    it('should accept a valid payload', () => {
        const result = AltArmStatusPayload.safeParse({
            time: 1234,
            msg_metadata: 'ALTIMETER_STRATOLOGGER',
            alt_arm_state: 'ALT_ARM_STATE_DISARMED',
            drogue_v: 4095,
            main_v: 2048,
        })
        expect(result.success).toBe(true)
    })

    it('should reject a payload missing drogue_v', () => {
        const result = AltArmStatusPayload.safeParse({
            time: 1234,
            msg_metadata: 'ALTIMETER_STRATOLOGGER',
            alt_arm_state: 'ALT_ARM_STATE_DISARMED',
            main_v: 2048,
        })
        expect(result.success).toBe(false)
    })
})

describe('SensorAnalog16Payload', () => {
    it('should accept a valid payload', () => {
        const result = SensorAnalog16Payload.safeParse({
            time: 1234,
            msg_metadata: 'SENSOR_5V_VOLT',
            value: 3300,
        })
        expect(result.success).toBe(true)
    })

    it('should reject invalid sensor id', () => {
        const result = SensorAnalog16Payload.safeParse({
            time: 1234,
            msg_metadata: 'NONEXISTENT_SENSOR',
            value: 3300,
        })
        expect(result.success).toBe(false)
    })
})

describe('SensorAnalog32Payload', () => {
    it('should accept a valid payload', () => {
        const result = SensorAnalog32Payload.safeParse({
            time: 1234,
            msg_metadata: 'SENSOR_BATT_VOLT',
            value: 123456,
        })
        expect(result.success).toBe(true)
    })
})

describe('Sensor2DAnalog24Payload', () => {
    it('should accept a valid payload', () => {
        const result = Sensor2DAnalog24Payload.safeParse({
            time: 1234,
            msg_metadata: 'DEM_2D_SENSOR_CANARD_MS5611_BARO_TEMP',
            value_x: 500,
            value_y: 1000,
        })
        expect(result.success).toBe(true)
    })

    it('should reject invalid dem 2d sensor id', () => {
        const result = Sensor2DAnalog24Payload.safeParse({
            time: 1234,
            msg_metadata: 'NONEXISTENT',
            value_x: 500,
            value_y: 1000,
        })
        expect(result.success).toBe(false)
    })
})

describe('Sensor3DAnalog16Payload', () => {
    it('should accept a valid payload', () => {
        const result = Sensor3DAnalog16Payload.safeParse({
            time: 1234,
            msg_metadata: 'DEM_3D_SENSOR_CANARD_LSM6DSV32X_ACCEL',
            value_x: 100,
            value_y: 200,
            value_z: 300,
        })
        expect(result.success).toBe(true)
    })
})

describe('GpsTimestampPayload', () => {
    it('should accept a valid payload', () => {
        const result = GpsTimestampPayload.safeParse({
            ...BASE,
            hrs: 14,
            mins: 30,
            secs: 45,
            dsecs: 5,
        })
        expect(result.success).toBe(true)
    })

    it('should reject a payload missing dsecs', () => {
        const result = GpsTimestampPayload.safeParse({
            ...BASE,
            hrs: 14,
            mins: 30,
            secs: 45,
        })
        expect(result.success).toBe(false)
    })
})

describe('GpsLatitudePayload', () => {
    it('should accept a valid payload', () => {
        const result = GpsLatitudePayload.safeParse({
            ...BASE,
            degs: 43,
            mins: 28,
            dmins: 1234,
            direction: 'N',
        })
        expect(result.success).toBe(true)
    })
})

describe('GpsLongitudePayload', () => {
    it('should accept a valid payload', () => {
        const result = GpsLongitudePayload.safeParse({
            ...BASE,
            degs: 80,
            mins: 31,
            dmins: 5678,
            direction: 'W',
        })
        expect(result.success).toBe(true)
    })
})

describe('GpsAltitudePayload', () => {
    it('should accept a valid payload', () => {
        const result = GpsAltitudePayload.safeParse({
            ...BASE,
            altitude: 332,
            daltitude: 1,
        })
        expect(result.success).toBe(true)
    })
})

describe('GpsInfoPayload', () => {
    it('should accept a valid payload', () => {
        const result = GpsInfoPayload.safeParse({
            ...BASE,
            num_sats: 12,
            quality: 1,
        })
        expect(result.success).toBe(true)
    })
})

describe('StreamStatusPayload', () => {
    it('should accept a valid payload', () => {
        const result = StreamStatusPayload.safeParse({
            ...BASE,
            total_size: 4096,
            tx_size: 1024,
        })
        expect(result.success).toBe(true)
    })
})

describe('StreamDataPayload', () => {
    it('should accept a valid payload', () => {
        const result = StreamDataPayload.safeParse({
            ...BASE,
            data: 'hello!',
        })
        expect(result.success).toBe(true)
    })

    it('should reject a payload with numeric data', () => {
        const result = StreamDataPayload.safeParse({
            ...BASE,
            data: 12345,
        })
        expect(result.success).toBe(false)
    })
})

describe('StreamRetryPayload', () => {
    it('should accept a valid payload', () => {
        const result = StreamRetryPayload.safeParse({ ...BASE })
        expect(result.success).toBe(true)
    })
})

describe('LedsOnPayload', () => {
    it('should accept a valid payload (no time)', () => {
        const result = LedsOnPayload.safeParse({ msg_metadata: 0 })
        expect(result.success).toBe(true)
    })

    it('should reject a payload missing msg_metadata', () => {
        const result = LedsOnPayload.safeParse({})
        expect(result.success).toBe(false)
    })
})

describe('LedsOffPayload', () => {
    it('should accept a valid payload (no time)', () => {
        const result = LedsOffPayload.safeParse({ msg_metadata: 0 })
        expect(result.success).toBe(true)
    })
})

// ============================================================
// PayloadSchemas Map
// ============================================================

describe('PayloadSchemas', () => {
    it('should contain all 23 message types', () => {
        expect(Object.keys(PayloadSchemas)).toHaveLength(23)
    })

    it('should map each key to a Zod schema with a safeParse method', () => {
        for (const schema of Object.values(PayloadSchemas)) {
            expect(schema).toBeDefined()
            expect(typeof schema.safeParse).toBe('function')
        }
    })

    it('should have the correct keys', () => {
        const expectedKeys = [
            'GENERAL_BOARD_STATUS',
            'RESET_CMD',
            'DEBUG_RAW',
            'CONFIG_SET',
            'CONFIG_STATUS',
            'ACTUATOR_CMD',
            'ACTUATOR_STATUS',
            'ALT_ARM_CMD',
            'ALT_ARM_STATUS',
            'SENSOR_ANALOG16',
            'SENSOR_ANALOG32',
            'SENSOR_2D_ANALOG24',
            'SENSOR_3D_ANALOG16',
            'GPS_TIMESTAMP',
            'GPS_LATITUDE',
            'GPS_LONGITUDE',
            'GPS_ALTITUDE',
            'GPS_INFO',
            'STREAM_STATUS',
            'STREAM_DATA',
            'STREAM_RETRY',
            'LEDS_ON',
            'LEDS_OFF',
        ]
        expect(Object.keys(PayloadSchemas).sort()).toEqual(expectedKeys.sort())
    })
})

// ============================================================
// getPayloadSchema Helper
// ============================================================

describe('getPayloadSchema', () => {
    it('should return the correct schema for a known message type', () => {
        const schema = getPayloadSchema('ACTUATOR_CMD')
        expect(schema).toBe(PayloadSchemas.ACTUATOR_CMD)
    })

    it('should return null for an unknown message type', () => {
        expect(getPayloadSchema('NONEXISTENT_TYPE')).toBeNull()
    })

    it('should return null for an empty string', () => {
        expect(getPayloadSchema('')).toBeNull()
    })

    it('should return a schema that validates correctly', () => {
        const schema = getPayloadSchema('GPS_INFO')
        expect(schema).not.toBeNull()
        const result = schema!.safeParse({
            time: 1234,
            msg_metadata: 0,
            num_sats: 8,
            quality: 2,
        })
        expect(result.success).toBe(true)
    })
})

// ============================================================
// Cross-cutting: time-based payloads require time
// ============================================================

describe('Base payload time field', () => {
    const timeBasedSchemas = Object.entries(PayloadSchemas).filter(
        ([key]) => key !== 'LEDS_ON' && key !== 'LEDS_OFF'
    )

    it.each(timeBasedSchemas)(
        '%s should reject a payload missing time',
        (_name, schema) => {
            const result = schema.safeParse({})
            expect(result.success).toBe(false)
        }
    )

    it.each(timeBasedSchemas)(
        '%s should reject a payload with string time',
        (_name, schema) => {
            const result = schema.safeParse({ time: 'not a number' })
            expect(result.success).toBe(false)
        }
    )
})
