/*
RocketCAN message definitions.

Each msg_type has a plain `MessageSchema` built with `defineMessage`:
- `fields`        : ordered list of Field transcoders for the payload bytes
- `metadataField` : Field used to decode the 8-bit Metadata in the SID (per-msg-type)

`decodeMessage(schema, bs)` walks `fields` and returns a plain object typed as `PayloadOf<fields>`.

See: https://docs.waterloorocketry.com/avionics/rocketcan/packet-format.html
*/

import { BitString } from './bitString.js'
import { ASCII, Bitfield, Enum, Numeric } from './fields.js'
import type { Field } from './fields.js'
import {
    actuator_id,
    actuator_state,
    alt_arm_state,
    altimeter_id,
    analog_sensor_id,
    board_error_bitfield_offset,
    board_inst_id,
    board_type_id,
    dem_2d_sensor_id,
    dem_3d_sensor_id,
    msg_prio,
    msg_type,
} from './messageTypes.js'

// SID-level field constants (shared, not per-msg-type)

export const MESSAGE_PRIO     = new Enum('msg_prio', 2, msg_prio)
export const MESSAGE_TYPE     = new Enum('msg_type', 7, msg_type)
export const BOARD_TYPE_ID    = new Enum('board_type_id', 6, board_type_id)
export const BOARD_INST_ID    = new Enum('board_inst_id', 6, board_inst_id)
export const MESSAGE_METADATA = new Numeric('msg_metadata', 8)
export const MESSAGE_SID_LEN =
    MESSAGE_PRIO.length +
    MESSAGE_TYPE.length +
    BOARD_TYPE_ID.length +
    BOARD_INST_ID.length +
    MESSAGE_METADATA.length

// Shared payload field: 16-bit millisecond timestamp, scaled to seconds.
export const TIMESTAMP_2 = new Numeric('time', 16, 1 / 1000, false, true, 's')

// wire layout of one msg_type: ordered payload fields plus the field used to decode SID metadata
export interface MessageSchema<
    F extends readonly Field[] = readonly Field[],
    M extends Field = Field,
> {
    readonly fields: F
    readonly metadataField: M
}

// overloads for defineMessage because metadataField is optional.
// protects against specifying an M that does not match the default MESSAGE_METADATA
export function defineMessage<const F extends readonly Field[]>(
    fields: F,
): MessageSchema<F, typeof MESSAGE_METADATA>
export function defineMessage<const F extends readonly Field[], M extends Field>(
    fields: F,
    metadataField: M,
): MessageSchema<F, M>
export function defineMessage(
    fields: readonly Field[],
    metadataField: Field = MESSAGE_METADATA,
): MessageSchema {
    return { fields, metadataField }
}

// properties corresponding to a decoded set of Fields
export type PayloadOf<F extends readonly Field[]> = {
    [P in F[number] as P['name']]: ReturnType<P['decode']>
}

// decodes payload bits by walking the schema's fields in order, returning a plain typed object
export function decodeMessage<F extends readonly Field[]>(
    schema: MessageSchema<F>,
    bs: BitString,
): PayloadOf<F> {
    const data: Record<string, unknown> = {}
    for (const field of schema.fields) {
        data[field.name] = field.decode(bs.pop(field.length, field.variable_length))
    }
    return data as PayloadOf<F>
}

// One schema per msg_type (24 total: UNDEFINED + 23 real types)

export const UNDEFINED = defineMessage([])

export const GENERAL_BOARD_STATUS = defineMessage([
    TIMESTAMP_2,
    new Bitfield('board_error_bitfield', 32, 'E_NOMINAL', board_error_bitfield_offset),
])

export const RESET_CMD = defineMessage([
    TIMESTAMP_2,
    new Enum('board_type_id', 8, board_type_id),
    new Enum('board_inst_id', 8, board_inst_id),
])

export const DEBUG_RAW = defineMessage([
    TIMESTAMP_2,
    new ASCII('string', 48),
])

export const CONFIG_SET = defineMessage([
    TIMESTAMP_2,
    new Enum('board_type_id', 8, board_type_id),
    new Enum('board_inst_id', 8, board_inst_id),
    new Numeric('config_id', 16),
    new Numeric('config_value', 16),
])

export const CONFIG_STATUS = defineMessage([
    TIMESTAMP_2,
    new Numeric('config_id', 16),
    new Numeric('config_value', 16),
])

export const ACTUATOR_CMD = defineMessage([
    TIMESTAMP_2,
    new Enum('cmd_state', 8, actuator_state),
], new Enum('msg_metadata', 8, actuator_id))

export const ACTUATOR_STATUS = defineMessage([
    TIMESTAMP_2,
    new Enum('cmd_state', 8, actuator_state),
    new Enum('curr_state', 8, actuator_state),
], new Enum('msg_metadata', 8, actuator_id))

export const ALT_ARM_CMD = defineMessage([
    TIMESTAMP_2,
    new Enum('alt_arm_state', 8, alt_arm_state),
], new Enum('msg_metadata', 8, altimeter_id))

export const ALT_ARM_STATUS = defineMessage([
    TIMESTAMP_2,
    new Enum('alt_arm_state', 8, alt_arm_state),
    new Numeric('drogue_v', 16),
    new Numeric('main_v', 16),
], new Enum('msg_metadata', 8, altimeter_id))

export const SENSOR_ANALOG16 = defineMessage([
    TIMESTAMP_2,
    new Numeric('value', 16),
], new Enum('msg_metadata', 8, analog_sensor_id))

export const SENSOR_ANALOG32 = defineMessage([
    TIMESTAMP_2,
    new Numeric('value', 32),
], new Enum('msg_metadata', 8, analog_sensor_id))

export const SENSOR_2D_ANALOG24 = defineMessage([
    TIMESTAMP_2,
    new Numeric('value_x', 24),
    new Numeric('value_y', 24),
], new Enum('msg_metadata', 8, dem_2d_sensor_id))

export const SENSOR_3D_ANALOG16 = defineMessage([
    TIMESTAMP_2,
    new Numeric('value_x', 16),
    new Numeric('value_y', 16),
    new Numeric('value_z', 16),
], new Enum('msg_metadata', 8, dem_3d_sensor_id))

export const GPS_TIMESTAMP = defineMessage([
    TIMESTAMP_2,
    new Numeric('hrs', 8),
    new Numeric('mins', 8),
    new Numeric('secs', 8),
    new Numeric('dsecs', 8),
])

export const GPS_LATITUDE = defineMessage([
    TIMESTAMP_2,
    new Numeric('degs', 8),
    new Numeric('mins', 8),
    new Numeric('dmins', 16),
    new ASCII('direction', 8),
])

export const GPS_LONGITUDE = defineMessage([
    TIMESTAMP_2,
    new Numeric('degs', 8),
    new Numeric('mins', 8),
    new Numeric('dmins', 16),
    new ASCII('direction', 8),
])

export const GPS_ALTITUDE = defineMessage([
    TIMESTAMP_2,
    new Numeric('altitude', 32),
    new Numeric('daltitude', 8),
])

export const GPS_INFO = defineMessage([
    TIMESTAMP_2,
    new Numeric('num_sats', 8),
    new Numeric('quality', 8),
])

export const STREAM_STATUS = defineMessage([
    TIMESTAMP_2,
    new Numeric('total_size', 24),
    new Numeric('tx_size', 24),
])

// Metadata is SEQ_ID (numeric per docs); uses default MESSAGE_METADATA.
export const STREAM_DATA = defineMessage([
    TIMESTAMP_2,
    new ASCII('data', 48),
])

export const STREAM_RETRY = defineMessage([
    TIMESTAMP_2,
])

export const TELEMETRY_INFO = defineMessage([
    TIMESTAMP_2,
    new Numeric('lqi', 8),
    new Numeric('rssi', 8),
])

export const TELEMETRY_STATE_SWITCH = defineMessage([
    TIMESTAMP_2,
], new Enum('msg_metadata', 8, board_inst_id))

export const CANARD_FIRMWARE_ERROR = defineMessage([
    TIMESTAMP_2,
    new Numeric('error_code', 32),
    new Numeric('severity', 8),
])

export const LEDS_ON = defineMessage([])

export const LEDS_OFF = defineMessage([])

// Registry — exhaustive coverage of msg_type enforced by `satisfies`
export const MESSAGE_SCHEMAS = {
    UNDEFINED,
    GENERAL_BOARD_STATUS,
    RESET_CMD,
    DEBUG_RAW,
    CONFIG_SET,
    CONFIG_STATUS,
    ACTUATOR_CMD,
    ACTUATOR_STATUS,
    ALT_ARM_CMD,
    ALT_ARM_STATUS,
    SENSOR_ANALOG16,
    SENSOR_ANALOG32,
    SENSOR_2D_ANALOG24,
    SENSOR_3D_ANALOG16,
    GPS_TIMESTAMP,
    GPS_LATITUDE,
    GPS_LONGITUDE,
    GPS_ALTITUDE,
    GPS_INFO,
    STREAM_STATUS,
    STREAM_DATA,
    STREAM_RETRY,
    TELEMETRY_INFO,
    TELEMETRY_STATE_SWITCH,
    CANARD_FIRMWARE_ERROR,
    LEDS_ON,
    LEDS_OFF,
} satisfies Record<keyof typeof msg_type, MessageSchema>

export type MessageSchemaKey = keyof typeof MESSAGE_SCHEMAS

// schema registered for msg_type K
type SchemaOfMessage<K extends MessageSchemaKey> = (typeof MESSAGE_SCHEMAS)[K]

// decoded payload for msg_type K; `{}` when the schema has no fields
export type MessagePayload<K extends MessageSchemaKey> = PayloadOf<SchemaOfMessage<K>['fields']>

// decoded SID metadata for msg_type K; enum metadata falls back to the raw number on a miss
export type MessageMetadata<K extends MessageSchemaKey> =
    ReturnType<SchemaOfMessage<K>['metadataField']['decode']> | number

// one parsed message of type K
type ParsleyMessageEntry<K extends MessageSchemaKey> = {
    // msg_prio, board_type_id, board_inst_id are a hex code when given unknown enum value
    msg_prio: keyof typeof msg_prio | (string & {})
    msg_type: K
    board_type_id: keyof typeof board_type_id | (string & {})
    board_inst_id: keyof typeof board_inst_id | (string & {})
    msg_metadata: MessageMetadata<K>
    data: MessagePayload<K>
}

// discriminated union: narrowing on msg_type narrows msg_metadata and data
export type ParsleyMessage = {
    [K in MessageSchemaKey]: ParsleyMessageEntry<K>
}[MessageSchemaKey]
