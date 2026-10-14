import { describe, it, expect } from 'vitest'
import {
    msg_prio,
    msg_prio_schema,
    msg_type,
    msg_type_schema,
    board_type_id,
    board_type_id_schema,
    board_inst_id,
    board_inst_id_schema,
    actuator_id,
    actuator_id_schema,
    actuator_state,
    actuator_state_schema,
    altimeter_id,
    altimeter_id_schema,
    alt_arm_state,
    alt_arm_state_schema,
    analog_sensor_id,
    analog_sensor_id_schema,
    dem_2d_sensor_id,
    dem_2d_sensor_id_schema,
    dem_3d_sensor_id,
    dem_3d_sensor_id_schema,
    board_error_bitfield_offset,
    board_error_bitfield_offset_schema,
} from '../src/message_types.js'

describe('msg_prio', () => {
    it('should have 4 priorities', () => {
        expect(Object.keys(msg_prio)).toHaveLength(4)
    })

    it('should validate valid priority values', () => {
        expect(msg_prio_schema.safeParse(0).success).toBe(true)
        expect(msg_prio_schema.safeParse(3).success).toBe(true)
    })

    it('should reject invalid priority values', () => {
        expect(msg_prio_schema.safeParse(5).success).toBe(false)
        expect(msg_prio_schema.safeParse(-1).success).toBe(false)
        expect(msg_prio_schema.safeParse('HIGHEST').success).toBe(false)
    })

    it('should have correct numeric values', () => {
        expect(msg_prio.HIGHEST).toBe(0)
        expect(msg_prio.HIGH).toBe(1)
        expect(msg_prio.MEDIUM).toBe(2)
        expect(msg_prio.LOW).toBe(3)
    })
})

describe('msg_type', () => {
    it('should have 26 message types', () => {
        expect(Object.keys(msg_type)).toHaveLength(27)
    })

    it('should validate valid message type values', () => {
        expect(msg_type_schema.safeParse(0x00).success).toBe(true)
        expect(msg_type_schema.safeParse(0x01).success).toBe(true)
        expect(msg_type_schema.safeParse(0x17).success).toBe(true)
    })

    it('should reject invalid message type values', () => {
        expect(msg_type_schema.safeParse(0xff).success).toBe(false)
        expect(msg_type_schema.safeParse(-1).success).toBe(false)
    })

    it('should have correct hex values', () => {
        expect(msg_type.UNDEFINED).toBe(0x00)
        expect(msg_type.GENERAL_BOARD_STATUS).toBe(0x01)
        expect(msg_type.ACTUATOR_CMD).toBe(0x06)
        expect(msg_type.SENSOR_ANALOG16).toBe(0x0a)
        expect(msg_type.SENSOR_2D_ANALOG24).toBe(0x0c)
        expect(msg_type.SENSOR_3D_ANALOG16).toBe(0x0d)
        expect(msg_type.GPS_TIMESTAMP).toBe(0x0e)
        expect(msg_type.LEDS_OFF).toBe(0x20)
    })
})

describe('board_type_id', () => {
    it('should have 14 board types', () => {
        expect(Object.keys(board_type_id)).toHaveLength(14)
    })

    it('should validate valid board type values', () => {
        expect(board_type_id_schema.safeParse(0x00).success).toBe(true)
        expect(board_type_id_schema.safeParse(0x0d).success).toBe(true)
    })

    it('should reject invalid board type values', () => {
        expect(board_type_id_schema.safeParse(0x0e).success).toBe(false)
    })

    it('should have correct hex values', () => {
        expect(board_type_id.ANY).toBe(0x00)
        expect(board_type_id.DAQ).toBe(0x0d)
    })
})

describe('board_inst_id', () => {
    it('should have 12 board instances', () => {
        expect(Object.keys(board_inst_id)).toHaveLength(12)
    })

    it('should validate valid board instance values', () => {
        expect(board_inst_id_schema.safeParse(0x00).success).toBe(true)
        expect(board_inst_id_schema.safeParse(0x0B).success).toBe(true)
    })

    it('should reject invalid board instance values', () => {
        expect(board_inst_id_schema.safeParse(0x0C).success).toBe(false)
    })
})

describe('actuator_id', () => {
    it('should have 29 actuator IDs', () => {
        expect(Object.keys(actuator_id)).toHaveLength(29)
    })

    it('should validate valid actuator ID values', () => {
        expect(actuator_id_schema.safeParse(0x00).success).toBe(true)
        expect(actuator_id_schema.safeParse(0x1C).success).toBe(true)
    })

    it('should reject invalid actuator ID values', () => {
        expect(actuator_id_schema.safeParse(0x1D).success).toBe(false)
    })

    it('should have correct hex values', () => {
        expect(actuator_id.ACTUATOR_OX_INJECTOR_VALVE).toBe(0x00)
        expect(actuator_id.ACTUATOR_PAYLOAD_PZT_ARM).toBe(0x1A)
    })
})

describe('actuator_state', () => {
    it('should have 4 actuator states', () => {
        expect(Object.keys(actuator_state)).toHaveLength(4)
    })

    it('should validate valid actuator state values', () => {
        expect(actuator_state_schema.safeParse(0x00).success).toBe(true)
        expect(actuator_state_schema.safeParse(0x03).success).toBe(true)
    })

    it('should reject invalid actuator state values', () => {
        expect(actuator_state_schema.safeParse(0x04).success).toBe(false)
    })
})

describe('altimeter_id', () => {
    it('should have 3 altimeter IDs', () => {
        expect(Object.keys(altimeter_id)).toHaveLength(3)
    })

    it('should validate valid altimeter ID values', () => {
        expect(altimeter_id_schema.safeParse(0x00).success).toBe(true)
        expect(altimeter_id_schema.safeParse(0x02).success).toBe(true)
    })

    it('should reject invalid altimeter ID values', () => {
        expect(altimeter_id_schema.safeParse(0x03).success).toBe(false)
    })
})

describe('alt_arm_state', () => {
    it('should have 2 arm states', () => {
        expect(Object.keys(alt_arm_state)).toHaveLength(2)
    })

    it('should validate valid arm state values', () => {
        expect(alt_arm_state_schema.safeParse(0x00).success).toBe(true)
        expect(alt_arm_state_schema.safeParse(0x01).success).toBe(true)
    })

    it('should reject invalid arm state values', () => {
        expect(alt_arm_state_schema.safeParse(0x02).success).toBe(false)
    })
})

describe('analog_sensor_id', () => {
    it('should have 63 sensor IDs', () => {
        expect(Object.keys(analog_sensor_id)).toHaveLength(64)
    })

    it('should validate valid sensor ID values', () => {
        expect(analog_sensor_id_schema.safeParse(0x00).success).toBe(true)
        expect(analog_sensor_id_schema.safeParse(0x3E).success).toBe(true)
    })

    it('should reject invalid sensor ID values', () => {
        expect(analog_sensor_id_schema.safeParse(0x40).success).toBe(false)
    })

    it('should have correct hex values for boundary entries', () => {
        expect(analog_sensor_id.SENSOR_5V_VOLT).toBe(0x00)
        expect(analog_sensor_id.SENSOR_PAYLOAD_SENSOR_CURR_READING).toBe(0x3E)
    })
})

describe('dem_2d_sensor_id', () => {
    it('should have 4 DEM 2D sensor IDs', () => {
        expect(Object.keys(dem_2d_sensor_id)).toHaveLength(4)
    })

    it('should validate valid DEM 2D sensor ID values', () => {
        expect(dem_2d_sensor_id_schema.safeParse(0x00).success).toBe(true)
        expect(dem_2d_sensor_id_schema.safeParse(0x03).success).toBe(true)
    })

    it('should reject invalid DEM 2D sensor ID values', () => {
        expect(dem_2d_sensor_id_schema.safeParse(0x04).success).toBe(false)
    })
})

describe('dem_3d_sensor_id', () => {
    it('should have 13 DEM 3D sensor IDs', () => {
        expect(Object.keys(dem_3d_sensor_id)).toHaveLength(13)
    })

    it('should validate valid DEM 3D sensor ID values', () => {
        expect(dem_3d_sensor_id_schema.safeParse(0x00).success).toBe(true)
        expect(dem_3d_sensor_id_schema.safeParse(0x0C).success).toBe(true)
    })

    it('should reject invalid DEM 3D sensor ID values', () => {
        expect(dem_3d_sensor_id_schema.safeParse(0x0D).success).toBe(false)
    })
})

describe('board_error_bitfield_offset', () => {
    it('should have 16 error bitfield offsets', () => {
        expect(Object.keys(board_error_bitfield_offset)).toHaveLength(17)
    })

    it('should validate valid offset values', () => {
        expect(board_error_bitfield_offset_schema.safeParse(0x00).success).toBe(true)
        expect(board_error_bitfield_offset_schema.safeParse(0x0F).success).toBe(true)
    })

    it('should reject invalid offset values', () => {
        expect(board_error_bitfield_offset_schema.safeParse(0x11).success).toBe(false)
    })
})
