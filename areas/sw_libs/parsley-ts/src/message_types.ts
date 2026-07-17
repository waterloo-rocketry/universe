// Auto generated file, do not edit directly

import { z } from 'zod'

// ============================================================
// Message Priority
// ============================================================

export const msg_prio = {
    HIGHEST: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
} as const

export const msg_prio_schema = z.nativeEnum(msg_prio)
export type msg_prio = z.infer<typeof msg_prio_schema>

// ============================================================
// Message Type
// ============================================================

export const msg_type = {
    UNDEFINED: 0x00,
    GENERAL_BOARD_STATUS: 0x01,
    RESET_CMD: 0x02,
    DEBUG_RAW: 0x03,
    CONFIG_SET: 0x04,
    CONFIG_STATUS: 0x05,
    ACTUATOR_CMD: 0x06,
    ACTUATOR_STATUS: 0x07,
    ALT_ARM_CMD: 0x08,
    ALT_ARM_STATUS: 0x09,
    SENSOR_ANALOG16: 0x0A,
    SENSOR_ANALOG32: 0x0B,
    SENSOR_2D_ANALOG24: 0x0C,
    SENSOR_3D_ANALOG16: 0x0D,
    GPS_TIMESTAMP: 0x0E,
    GPS_LATITUDE: 0x0F,
    GPS_LONGITUDE: 0x10,
    GPS_ALTITUDE: 0x11,
    GPS_INFO: 0x12,
    STREAM_STATUS: 0x13,
    STREAM_DATA: 0x14,
    STREAM_RETRY: 0x15,
    TELEMETRY_INFO: 0x16,
    TELEMETRY_STATE_SWITCH: 0x17,
    CANARD_FIRMWARE_ERROR: 0x18,
    LEDS_ON: 0x19,
    LEDS_OFF: 0x20,
} as const

export const msg_type_schema = z.nativeEnum(msg_type)
export type msg_type = z.infer<typeof msg_type_schema>

// ============================================================
// Board Type ID
// ============================================================

export const board_type_id = {
    ANY: 0x00,
    INJECTOR: 0x01,
    CAMERA: 0x02,
    POWER: 0x03,
    LOGGER: 0x04,
    CANARD: 0x05,
    TELEMETRY: 0x06,
    GPS: 0x07,
    ALTIMETER: 0x08,
    ARMING: 0x09,
    PAYLOAD: 0x0A,
    RLCS_GLS: 0x0B,
    RLCS_RELAY: 0x0C,
    DAQ: 0x0D,
} as const

export const board_type_id_schema = z.nativeEnum(board_type_id)
export type board_type_id = z.infer<typeof board_type_id_schema>

// ============================================================
// Board Instance ID
// ============================================================

export const board_inst_id = {
    ANY: 0x00,
    GROUND: 0x01,
    ROCKET: 0x02,
    SIDE_LOOKING: 0x03,
    DOWN_LOOKING: 0x04,
    RECOVERY: 0x05,
    GROUND_1: 0x06,
    GROUND_2: 0x07,
    GROUND_3: 0x08,
    GROUND_4: 0x09,
    RA_RAVEN: 0x0A,
    RA_STRATOLOGGER: 0x0B,
} as const

export const board_inst_id_schema = z.nativeEnum(board_inst_id)
export type board_inst_id = z.infer<typeof board_inst_id_schema>

// ============================================================
// Actuator Id
// ============================================================

export const actuator_id = {
    ACTUATOR_OX_INJECTOR_VALVE: 0x00,
    ACTUATOR_FUEL_INJECTOR_VALVE: 0x01,
    ACTUATOR_IGNITION: 0x02,
    ACTUATOR_ROCKET_UPPER_CHARGE_ENABLE: 0x03,
    ACTUATOR_ROCKET_INJECTOR_CHARGE_ENABLE: 0x04,
    ACTUATOR_5V_RAIL_ROCKET: 0x05,
    ACTUATOR_12V_RAIL_ROCKET: 0x06,
    ACTUATOR_TELEMETRY: 0x07,
    ACTUATOR_CAMERA_SIDE_LOOKING_POWER: 0x08,
    ACTUATOR_CAMERA_DOWN_LOOKING_POWER: 0x09,
    ACTUATOR_CAMERA_RECOVERY_POWER: 0x0A,
    ACTUATOR_CAMERA_SIDE_LOOKING_RECORD: 0x0B,
    ACTUATOR_CAMERA_DOWN_LOOKING_RECORD: 0x0C,
    ACTUATOR_CAMERA_RECOVERY_RECORD: 0x0D,
    ACTUATOR_CANARD_PAD_FILTER: 0x0E,
    ACTUATOR_CANARD_5V_OUTPUT: 0x0F,
    ACTUATOR_CANARD_LIPO_ON: 0x10,
    ACTUATOR_SRAD_ALT_ESTIMATOR_INIT: 0x11,
    ACTUATOR_SRAD_ALT_GPS_RESET: 0x12,
    ACTUATOR_CAMERA_CAPTURE: 0x13,
    ACTUATOR_PAYLOAD_LOGGING_ENABLE: 0x14,
    ACTUATOR_INJECTOR_BOARD_ACTUATOR_1: 0x15,
    ACTUATOR_INJECTOR_BOARD_ACTUATOR_2: 0x16,
    ACTUATOR_RLCS_RELAY_POWER: 0x17,
    ACTUATOR_RLCS_RELAY_SELECT: 0x18,
    ACTUATOR_PAYLOAD_ACCEL_ARM: 0x19,
    ACTUATOR_PAYLOAD_PZT_ARM: 0x1A,
    ACTUATOR_LOGGER_FLASH_ERASE: 0x1B,
    ACTUATOR_CANARD_FLASH_ERASE: 0x1C,
    ACTUATOR_CANARD_MOTOR_CALIBRATION: 0x1D,
} as const

export const actuator_id_schema = z.nativeEnum(actuator_id)
export type actuator_id = z.infer<typeof actuator_id_schema>

// ============================================================
// Actuator State
// ============================================================

export const actuator_state = {
    ACT_STATE_ON: 0x00,
    ACT_STATE_OFF: 0x01,
    ACT_STATE_UNK: 0x02,
    ACT_STATE_ILLEGAL: 0x03,
} as const

export const actuator_state_schema = z.nativeEnum(actuator_state)
export type actuator_state = z.infer<typeof actuator_state_schema>

// ============================================================
// Altimeter Id
// ============================================================

export const altimeter_id = {
    ALTIMETER_RAVEN: 0x00,
    ALTIMETER_STRATOLOGGER: 0x01,
    ALTIMETER_SRAD: 0x02,
} as const

export const altimeter_id_schema = z.nativeEnum(altimeter_id)
export type altimeter_id = z.infer<typeof altimeter_id_schema>

// ============================================================
// Alt Arm State
// ============================================================

export const alt_arm_state = {
    ALT_ARM_STATE_DISARMED: 0x00,
    ALT_ARM_STATE_ARMED: 0x01,
} as const

export const alt_arm_state_schema = z.nativeEnum(alt_arm_state)
export type alt_arm_state = z.infer<typeof alt_arm_state_schema>

// ============================================================
// Analog Sensor Id
// ============================================================

export const analog_sensor_id = {
    SENSOR_5V_VOLT: 0x00,
    SENSOR_5V_CURR: 0x01,
    SENSOR_12V_VOLT: 0x02,
    SENSOR_12V_CURR: 0x03,
    SENSOR_CHARGE_VOLT: 0x04,
    SENSOR_CHARGE_CURR: 0x05,
    SENSOR_BATT_VOLT: 0x06,
    SENSOR_ALTERNATE_BATT_VOLT: 0x07,
    SENSOR_BATT_CURR: 0x08,
    SENSOR_RADIO_CURR: 0x09,
    SENSOR_GPS_CURR: 0x0A,
    SENSOR_CAMERA_CURR: 0x0B,
    SENSOR_LOCAL_RAIL_CURR: 0x0C,
    SENSOR_PT_CHANNEL_1: 0x0D,
    SENSOR_PT_CHANNEL_2: 0x0E,
    SENSOR_PT_CHANNEL_3: 0x0F,
    SENSOR_PT_CHANNEL_4: 0x10,
    SENSOR_PT_CHANNEL_5: 0x11,
    SENSOR_PT_CHANNEL_6: 0x12,
    SENSOR_PT_CHANNEL_7: 0x13,
    SENSOR_PT_CHANNEL_8: 0x14,
    SENSOR_PT_CHANNEL_9: 0x15,
    SENSOR_PT_CHANNEL_10: 0x16,
    SENSOR_HALL_CHANNEL_1: 0x17,
    SENSOR_HALL_CHANNEL_2: 0x18,
    SENSOR_HALL_CHANNEL_3: 0x19,
    SENSOR_RA_BATT_VOLT_1: 0x1A,
    SENSOR_RA_BATT_VOLT_2: 0x1B,
    SENSOR_RA_BATT_CURR_1: 0x1C,
    SENSOR_RA_BATT_CURR_2: 0x1D,
    SENSOR_RA_MAG_VOLT_1: 0x1E,
    SENSOR_RA_MAG_VOLT_2: 0x1F,
    SENSOR_FPS: 0x20,
    SENSOR_PAYLOAD_LIM_1: 0x21,
    SENSOR_PAYLOAD_LIM_2: 0x22,
    SENSOR_PAYLOAD_SERVO_DIRECTION: 0x23,
    SENSOR_PAYLOAD_INFRARED: 0x24,
    SENSOR_INJECTOR_BOARD_TEMP_1: 0x25,
    SENSOR_INJECTOR_BOARD_TEMP_2: 0x26,
    SENSOR_INJECTOR_BOARD_TEMP_3: 0x27,
    SENSOR_RLCS_RELAY_OUTPUT_VOLT_A: 0x28,
    SENSOR_RLCS_RELAY_OUTPUT_VOLT_B: 0x29,
    SENSOR_RLCS_RELAY_OUTPUT_CURR_A: 0x2A,
    SENSOR_RLCS_RELAY_OUTPUT_CURR_B: 0x2B,
    SENSOR_RLCS_RELAY_LIM_VOLT_A: 0x2C,
    SENSOR_RLCS_RELAY_LIM_VOLT_B: 0x2D,
    SENSOR_LOG_WRITTEN_SIZE: 0x2E,
    SENSOR_SD_LOG_FILE_NAME: 0x2F,
    SENSOR_SD_USED: 0x30,
    SENSOR_SD_FREE: 0x31,
    SENSOR_FLASH_LOG_FILE_NAME: 0x32,
    SENSOR_FLASH_USED: 0x33,
    SENSOR_FLASH_FREE: 0x34,
    SENSOR_CANARD_CTRL_CMD_ANGLE: 0x35,
    SENSOR_CANARD_CTRL_COEFF_LIFT: 0x36,
    SENSOR_CANARD_MTI630_BARO_0: 0x37,
    SENSOR_CANARD_MTI630_BARO_1: 0x38,
    SENSOR_CANARD_MTI630_EST_ALT: 0x39,
    SENSOR_CANARD_ADXRS649_GYRO: 0x3A,
    SENSOR_CANARD_SERVO_ANGLE: 0x3B,
    SENSOR_CANARD_SERVO_CURR: 0x3C,
    SENSOR_CANARD_SERVO_TEMP: 0x3D,
    SENSOR_PAYLOAD_SENSOR_CURR_READING: 0x3E,
    SENSOR_ALTITUDE: 0x3F,
} as const

export const analog_sensor_id_schema = z.nativeEnum(analog_sensor_id)
export type analog_sensor_id = z.infer<typeof analog_sensor_id_schema>

// ============================================================
// Dem 2D Sensor Id
// ============================================================

export const dem_2d_sensor_id = {
    DEM_2D_SENSOR_CANARD_NAV_VEL_ANGLE_VEL_X: 0x00,
    DEM_2D_SENSOR_CANARD_NAV_VEL_ANGLE_VEL_Y: 0x01,
    DEM_2D_SENSOR_CANARD_NAV_VEL_ANGLE_VEL_Z: 0x02,
    DEM_2D_SENSOR_CANARD_MS5611_BARO_TEMP: 0x03,
    DEM_2D_SENSOR_CANARD_MTI630_EST_ORI_QW_QX: 0x04,
    DEM_2D_SENSOR_CANARD_MTI630_EST_ORI_QY_QZ: 0x05,
} as const

export const dem_2d_sensor_id_schema = z.nativeEnum(dem_2d_sensor_id)
export type dem_2d_sensor_id = z.infer<typeof dem_2d_sensor_id_schema>

// ============================================================
// Dem 3D Sensor Id
// ============================================================

export const dem_3d_sensor_id = {
    DEM_3D_SENSOR_CANARD_NAV_ORI_QX_QY_QZ: 0x00,
    DEM_3D_SENSOR_CANARD_NAV_ORI_QW_ALT_VARNORM: 0x01,
    DEM_3D_SENSOR_CANARD_LSM6DSV32X_ACCEL: 0x02,
    DEM_3D_SENSOR_CANARD_LSM6DSV32X_GYRO: 0x03,
    DEM_3D_SENSOR_CANARD_IIS2MDC_ACCEL: 0x04,
    DEM_3D_SENSOR_CANARD_IIS2MDC_MAG: 0x05,
    DEM_3D_SENSOR_CANARD_MTI630_ACCEL: 0x06,
    DEM_3D_SENSOR_CANARD_MTI630_GYRO: 0x07,
    DEM_3D_SENSOR_CANARD_MTI630_MAG: 0x08,
    DEM_3D_SENSOR_RESERVED_0: 0x09,
    DEM_3D_SENSOR_CANARD_MTI630_EST_ANGLE_VEL: 0x0A,
    DEM_3D_SENSOR_CANARD_MTI630_EST_VEL: 0x0B,
    DEM_3D_SENSOR_CANARD_ADXL380_ACCEL: 0x0C,
    DEM_3D_SENSOR_PAYLOAD_ACCEL_0: 0x0D,
    DEM_3D_SENSOR_PAYLOAD_ACCEL_1: 0x0E,
    DEM_3D_SENSOR_PAYLOAD_ACCEL_2: 0x0F,
    DEM_3D_SENSOR_PAYLOAD_ACCEL_3: 0x10,
    DEM_3D_SENSOR_PAYLOAD_ACCEL_4: 0x11,
    DEM_3D_SENSOR_PAYLOAD_ACCEL_5: 0x12,
    DEM_3D_SENSOR_PAYLOAD_ACCEL_6: 0x13,
    DEM_3D_SENSOR_PAYLOAD_ACCEL_7: 0x14,
} as const

export const dem_3d_sensor_id_schema = z.nativeEnum(dem_3d_sensor_id)
export type dem_3d_sensor_id = z.infer<typeof dem_3d_sensor_id_schema>

// ============================================================
// Canards Health Severity
// ============================================================

export const canards_health_severity = {
    CANARDS_HEALTH_SEVERITY_HEALTH_OK: 0x00,
    CANARDS_HEALTH_SEVERITY_HEALTH_ERROR: 0x01,
    CANARDS_HEALTH_SEVERITY_HEALTH_FATAL: 0x02,
} as const

export const canards_health_severity_schema = z.nativeEnum(canards_health_severity)
export type canards_health_severity = z.infer<typeof canards_health_severity_schema>

// ============================================================
// Canards Module Id
// ============================================================

export const canards_module_id = {
    CANARDS_MODULE_ID_ADC: 0x00,
    CANARDS_MODULE_ID_ADXL380: 0x01,
    CANARDS_MODULE_ID_ADXRS649: 0x02,
    CANARDS_MODULE_ID_AK45: 0x03,
    CANARDS_MODULE_ID_CAN_HANDLER: 0x04,
    CANARDS_MODULE_ID_CONTROLLER: 0x05,
    CANARDS_MODULE_ID_FLIGHT_PHASE: 0x06,
    CANARDS_MODULE_ID_FSM: 0x07,
    CANARDS_MODULE_ID_GPIO: 0x08,
    CANARDS_MODULE_ID_I2C: 0x09,
    CANARDS_MODULE_ID_IIS2MDC: 0x0A,
    CANARDS_MODULE_ID_LOGGER: 0x0B,
    CANARDS_MODULE_ID_LSM6DSV32X: 0x0C,
    CANARDS_MODULE_ID_MOVELLA: 0x0D,
    CANARDS_MODULE_ID_MS5611: 0x0E,
    CANARDS_MODULE_ID_NAVIGATOR: 0x0F,
    CANARDS_MODULE_ID_POWER_HANDLER: 0x10,
    CANARDS_MODULE_ID_SD_CARD: 0x11,
    CANARDS_MODULE_ID_SENSOR_HANDLER: 0x12,
    CANARDS_MODULE_ID_TELEMETRY: 0x13,
    CANARDS_MODULE_ID_TIMER: 0x14,
    CANARDS_MODULE_ID_UART: 0x15,
} as const

export const canards_module_id_schema = z.nativeEnum(canards_module_id)
export type canards_module_id = z.infer<typeof canards_module_id_schema>

// ============================================================
// Board Error Bitfield Offset (bitfield positions)
// ============================================================

export const board_error_bitfield_offset = {
    E_5V_OVER_CURR: 0x00,
    E_5V_OVER_VOLT: 0x01,
    E_5V_UNDER_VOLT: 0x02,
    E_12V_OVER_CURR: 0x03,
    E_12V_OVER_VOLT: 0x04,
    E_12V_UNDER_VOLT: 0x05,
    E_BATT_OVER_CURR: 0x06,
    E_BATT_OVER_VOLT: 0x07,
    E_BATT_UNDER_VOLT: 0x08,
    E_MOTOR_OVER_CURR: 0x09,
    E_IO_ERROR: 0x0A,
    E_FS_ERROR: 0x0B,
    E_WATCHDOG_TIMEOUT: 0x0C,
    E_12V_EFUSE_FAULT: 0x0D,
    E_5V_EFUSE_FAULT: 0x0E,
    E_PT_OUT_OF_RANGE: 0x0F,
    E_CANARD_MODULE_FAILURE: 0x10,
    E_LOCAL_RAIL_OVER_CURR: 0x11,
    E_CHARGE_RAIL_OVER_VOLT: 0x12,
    E_CHARGE_RAIL_OVER_CURR: 0x13,
} as const

export const board_error_bitfield_offset_schema = z.nativeEnum(board_error_bitfield_offset)
export type board_error_bitfield_offset = z.infer<typeof board_error_bitfield_offset_schema>

// ============================================================
// Canards Module Error Bitfield Offset (bitfield positions)
// ============================================================

export const canards_module_error_bitfield_offset = {
    CANARDS_MODULE_E_BAT1_FAULT: 0x00,
    CANARDS_MODULE_E_BAT2_FAULT: 0x01,
    CANARDS_MODULE_E_DEVICE_FAULT: 0x02,
    CANARDS_MODULE_E_FILE_SYSTEM: 0x03,
    CANARDS_MODULE_E_HARDWARE_FAIL: 0x04,
    CANARDS_MODULE_E_LOW_POWER_MODE_WITH_EXT_5V_ON: 0x05,
    CANARDS_MODULE_E_COMM_FAILURE: 0x06,
    CANARDS_MODULE_E_CRC_FAILED: 0x07,
    CANARDS_MODULE_E_NO_DATA: 0x08,
    CANARDS_MODULE_E_RX_FAILURE: 0x09,
    CANARDS_MODULE_E_TIMEOUT: 0x0A,
    CANARDS_MODULE_E_TX_FAILURE: 0x0B,
    CANARDS_MODULE_E_ERROR_STATE: 0x0C,
    CANARDS_MODULE_E_FAILED_CALIBRATION: 0x0D,
    CANARDS_MODULE_E_NOT_CALIBRATED: 0x0E,
    CANARDS_MODULE_E_LOOP_TIMING: 0x0F,
    CANARDS_MODULE_E_NOT_INIT: 0x10,
    CANARDS_MODULE_E_OS: 0x11,
    CANARDS_MODULE_E_CODEGEN: 0x12,
    CANARDS_MODULE_E_UNEXPECTED_EVENT: 0x13,
    CANARDS_MODULE_E_INVALID_PARAM: 0x14,
    CANARDS_MODULE_E_MATH: 0x15,
    CANARDS_MODULE_E_OUT_OF_BOUNDS: 0x16,
    CANARDS_MODULE_E_OVERFLOW: 0x17,
    CANARDS_MODULE_E_INTERNAL: 0x18,
} as const

export const canards_module_error_bitfield_offset_schema = z.nativeEnum(canards_module_error_bitfield_offset)
export type canards_module_error_bitfield_offset = z.infer<typeof canards_module_error_bitfield_offset_schema>

