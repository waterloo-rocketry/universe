from string import Template

from gen_parsley.models import RocketCAN

_FILE = Template("""\
// Auto generated file, do not edit directly

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
    canards_health_severity,
    canards_module_error_bitfield_offset,
    canards_module_id,
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

$msg_definitions

// Registry — exhaustive coverage of msg_type enforced by `satisfies`
export const MESSAGE_SCHEMAS = {
$msg_name_list
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
""")


def render(data: RocketCAN) -> str:
    return ""
