import { z } from 'zod'
import {
    board_type_id,
    board_inst_id,
    actuator_id,
    actuator_state,
    altimeter_id,
    alt_arm_state,
    analog_sensor_id,
    dem_2d_sensor_id,
    dem_3d_sensor_id,
} from './message_types.js'

// ============================================================
// Enum Key Schemas
// ============================================================

function enumKeys<T extends Record<string, number>>(obj: T) {
    return z.enum(Object.keys(obj) as [string, ...string[]])
}

const board_type_idKey = enumKeys(board_type_id)
const board_inst_idKey = enumKeys(board_inst_id)
const actuator_idKey = enumKeys(actuator_id)
const actuator_stateKey = enumKeys(actuator_state)
const altimeter_idKey = enumKeys(altimeter_id)
const alt_arm_stateKey = enumKeys(alt_arm_state)
const analog_sensor_idKey = enumKeys(analog_sensor_id)
const dem_2d_sensor_idKey = enumKeys(dem_2d_sensor_id)
const dem_3d_sensor_idKey = enumKeys(dem_3d_sensor_id)

// ============================================================
// Base Payloads
// ============================================================

const BasePayload = z.object({
    time: z.number(),
})

// ============================================================
// Individual Payload Schemas
// ============================================================

export const GeneralBoardStatusPayload = BasePayload.extend({
    msg_metadata: z.number(),
    board_error_bitfield: z.string(),
})

export const ResetCmdPayload = BasePayload.extend({
    msg_metadata: z.number(),
    board_type_id: board_type_idKey,
    board_inst_id: board_inst_idKey,
})

export const DebugRawPayload = BasePayload.extend({
    msg_metadata: z.number(),
    string: z.string(),
})

export const ConfigSetPayload = BasePayload.extend({
    msg_metadata: z.number(),
    board_type_id: board_type_idKey,
    board_inst_id: board_inst_idKey,
    config_id: z.number(),
    config_value: z.number(),
})

export const ConfigStatusPayload = BasePayload.extend({
    msg_metadata: z.number(),
    config_id: z.number(),
    config_value: z.number(),
})

export const ActuatorCmdPayload = BasePayload.extend({
    msg_metadata: actuator_idKey,
    cmd_state: actuator_stateKey,
})

export const ActuatorStatusPayload = BasePayload.extend({
    msg_metadata: actuator_idKey,
    cmd_state: actuator_stateKey,
    curr_state: actuator_stateKey,
})

export const AltArmCmdPayload = BasePayload.extend({
    msg_metadata: altimeter_idKey,
    alt_arm_state: alt_arm_stateKey,
})

export const AltArmStatusPayload = BasePayload.extend({
    msg_metadata: altimeter_idKey,
    alt_arm_state: alt_arm_stateKey,
    drogue_v: z.number(),
    main_v: z.number(),
})

export const SensorAnalog16Payload = BasePayload.extend({
    msg_metadata: analog_sensor_idKey,
    value: z.number(),
})

export const SensorAnalog32Payload = BasePayload.extend({
    msg_metadata: analog_sensor_idKey,
    value: z.number(),
})

export const Sensor2DAnalog24Payload = BasePayload.extend({
    msg_metadata: dem_2d_sensor_idKey,
    value_x: z.number(),
    value_y: z.number(),
})

export const Sensor3DAnalog16Payload = BasePayload.extend({
    msg_metadata: dem_3d_sensor_idKey,
    value_x: z.number(),
    value_y: z.number(),
    value_z: z.number(),
})

export const GpsTimestampPayload = BasePayload.extend({
    msg_metadata: z.number(),
    hrs: z.number(),
    mins: z.number(),
    secs: z.number(),
    dsecs: z.number(),
})

export const GpsLatitudePayload = BasePayload.extend({
    msg_metadata: z.number(),
    degs: z.number(),
    mins: z.number(),
    dmins: z.number(),
    direction: z.string(),
})

export const GpsLongitudePayload = BasePayload.extend({
    msg_metadata: z.number(),
    degs: z.number(),
    mins: z.number(),
    dmins: z.number(),
    direction: z.string(),
})

export const GpsAltitudePayload = BasePayload.extend({
    msg_metadata: z.number(),
    altitude: z.number(),
    daltitude: z.number(),
})

export const GpsInfoPayload = BasePayload.extend({
    msg_metadata: z.number(),
    num_sats: z.number(),
    quality: z.number(),
})

export const StreamStatusPayload = BasePayload.extend({
    msg_metadata: z.number(),
    total_size: z.number(),
    tx_size: z.number(),
})

export const StreamDataPayload = BasePayload.extend({
    msg_metadata: z.number(),
    data: z.string(),
})

export const StreamRetryPayload = BasePayload.extend({
    msg_metadata: z.number(),
})

export const LedsOnPayload = z.object({
    msg_metadata: z.number(),
})

export const LedsOffPayload = z.object({
    msg_metadata: z.number(),
})

// ============================================================
// Payload Schema Map
// ============================================================

export const PayloadSchemas = {
    GENERAL_BOARD_STATUS: GeneralBoardStatusPayload,
    RESET_CMD: ResetCmdPayload,
    DEBUG_RAW: DebugRawPayload,
    CONFIG_SET: ConfigSetPayload,
    CONFIG_STATUS: ConfigStatusPayload,
    ACTUATOR_CMD: ActuatorCmdPayload,
    ACTUATOR_STATUS: ActuatorStatusPayload,
    ALT_ARM_CMD: AltArmCmdPayload,
    ALT_ARM_STATUS: AltArmStatusPayload,
    SENSOR_ANALOG16: SensorAnalog16Payload,
    SENSOR_ANALOG32: SensorAnalog32Payload,
    SENSOR_2D_ANALOG24: Sensor2DAnalog24Payload,
    SENSOR_3D_ANALOG16: Sensor3DAnalog16Payload,
    GPS_TIMESTAMP: GpsTimestampPayload,
    GPS_LATITUDE: GpsLatitudePayload,
    GPS_LONGITUDE: GpsLongitudePayload,
    GPS_ALTITUDE: GpsAltitudePayload,
    GPS_INFO: GpsInfoPayload,
    STREAM_STATUS: StreamStatusPayload,
    STREAM_DATA: StreamDataPayload,
    STREAM_RETRY: StreamRetryPayload,
    LEDS_ON: LedsOnPayload,
    LEDS_OFF: LedsOffPayload,
} as const

// ============================================================
// Types
// ============================================================

export type PayloadMessageType = keyof typeof PayloadSchemas

export type GeneralBoardStatusPayload = z.infer<typeof GeneralBoardStatusPayload>
export type ResetCmdPayload = z.infer<typeof ResetCmdPayload>
export type DebugRawPayload = z.infer<typeof DebugRawPayload>
export type ConfigSetPayload = z.infer<typeof ConfigSetPayload>
export type ConfigStatusPayload = z.infer<typeof ConfigStatusPayload>
export type ActuatorCmdPayload = z.infer<typeof ActuatorCmdPayload>
export type ActuatorStatusPayload = z.infer<typeof ActuatorStatusPayload>
export type AltArmCmdPayload = z.infer<typeof AltArmCmdPayload>
export type AltArmStatusPayload = z.infer<typeof AltArmStatusPayload>
export type SensorAnalog16Payload = z.infer<typeof SensorAnalog16Payload>
export type SensorAnalog32Payload = z.infer<typeof SensorAnalog32Payload>
export type Sensor2DAnalog24Payload = z.infer<typeof Sensor2DAnalog24Payload>
export type Sensor3DAnalog16Payload = z.infer<typeof Sensor3DAnalog16Payload>
export type GpsTimestampPayload = z.infer<typeof GpsTimestampPayload>
export type GpsLatitudePayload = z.infer<typeof GpsLatitudePayload>
export type GpsLongitudePayload = z.infer<typeof GpsLongitudePayload>
export type GpsAltitudePayload = z.infer<typeof GpsAltitudePayload>
export type GpsInfoPayload = z.infer<typeof GpsInfoPayload>
export type StreamStatusPayload = z.infer<typeof StreamStatusPayload>
export type StreamDataPayload = z.infer<typeof StreamDataPayload>
export type StreamRetryPayload = z.infer<typeof StreamRetryPayload>
export type LedsOnPayload = z.infer<typeof LedsOnPayload>
export type LedsOffPayload = z.infer<typeof LedsOffPayload>

export type AnyParsleyPayload =
    | GeneralBoardStatusPayload
    | ResetCmdPayload
    | DebugRawPayload
    | ConfigSetPayload
    | ConfigStatusPayload
    | ActuatorCmdPayload
    | ActuatorStatusPayload
    | AltArmCmdPayload
    | AltArmStatusPayload
    | SensorAnalog16Payload
    | SensorAnalog32Payload
    | Sensor2DAnalog24Payload
    | Sensor3DAnalog16Payload
    | GpsTimestampPayload
    | GpsLatitudePayload
    | GpsLongitudePayload
    | GpsAltitudePayload
    | GpsInfoPayload
    | StreamStatusPayload
    | StreamDataPayload
    | StreamRetryPayload
    | LedsOnPayload
    | LedsOffPayload

// ============================================================
// Helper
// ============================================================

export function getPayloadSchema(
    msgType: string
): (typeof PayloadSchemas)[PayloadMessageType] | null {
    return PayloadSchemas[msgType as PayloadMessageType] ?? null
}
