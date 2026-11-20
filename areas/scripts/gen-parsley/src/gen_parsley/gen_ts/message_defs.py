from string import Template

from gen_parsley.models import Field, RefField, RocketCAN

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
$imports_msg_types
} from './messageTypes.js'

// SID-level field constants (shared, not per-msg-type)
$sid_fields

// Shared payload fields
$msg_fields

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


def _resolve_ref(field: Field | RefField, data: RocketCAN) -> Field:
    """if field is a RefField, get the Field that it points to"""
    if isinstance(field, Field):
        return field
    elif isinstance(field, RefField):
        # TODO: maybe parse RocketCAN to have message_fields as dict
        ref_source = next((f for f in data.message_fields if f.id == field.ref), None)
        if ref_source is None:
            raise ValueError(f"Cannot find message_field with id {field.ref}")
        return ref_source
    raise TypeError(f"Expected Field or RefField, got {type(field)}")


def _field(field: Field | RefField, data: RocketCAN) -> str:
    if isinstance(field, Field):
        name = field.name.lower()
        match field.type:
            case "ascii":
                assert isinstance(field.bytes, int)
                return f"new ASCII('{name}', {field.bytes})"
            case "bitfield":
                assert isinstance(field.bytes, int)
                return f"new Bitfield('{name}', {field.bytes * 8}, {'E_NOMINAL'}, {field.bitfield}_offset)"
            case "enum":
                enum = next((e for e in data.enums if e.name == field.enum), None)
                if enum is None:
                    raise ValueError(f"Cannot find enum with id {field.enum}")
                byte_size = field.bytes or 1  # HACK: some Fields don't define bytes
                return f"new Enum('{name}', {byte_size * 8}, {field.enum})"
            case "int":
                assert isinstance(field.bytes, int)
                return f"new Numeric('{name}', {field.bytes * 8}, 1, true)"
            case "uint":
                # TODO: TIMESTAMP_2 requiers the `scale` ctor parameter
                byte_size = field.bytes or 1  # HACK: some Fields don't define bytes
                return f"new Numeric('{name}', {byte_size * 8}, 1, false)"
            case "raw":
                return f"new ASCII('{name}', {field.bytes})"
            case _:
                raise ValueError(
                    f"Cannot convert Field of type {field.type} (field {field.name})"
                )
    elif isinstance(field, RefField):
        return f"MSG_FIELD_{field.ref}"

    raise TypeError(f"Expected Field or RefField, got {type(field)}")


def render(data: RocketCAN) -> str:
    msg_types = ["msg_type"]
    msg_types.extend(enum.name for enum in data.enums)
    msg_types.extend(f"{bitfield.name}_offset" for bitfield in data.bitfields)
    import_msg_types = "\n".join(f"    {name}," for name in msg_types)

    # TODO: message_type, metadata are not Enum fields
    sid_field_defs = "\n".join(
        f"export const {field.name.upper()} = "
        f"new Enum('{field.name}', {field.bits}, {field.enum})"
        for field in data.sid.fields
    )
    sid_len_sum = "\n".join(f"    {field.name.upper()} +" for field in data.sid.fields)
    sid_fields = f"""\
{sid_field_defs}
export const MESSAGE_SID_LEN =
{sid_len_sum}
"""

    # HACK: currently hard-coding timestamp field because RocketCAN has no config for Numeric scale
    msg_shared_fields = """\
// 16-bit millisecond timestamp, scaled to seconds.
export const MSG_FIELD_TIMESTAMP = new Numeric('time', 16, 1 / 1000, false, true, 's')"""

    msg_defs = []
    msg_name_list = []
    for message in data.messages:
        msg_name_list.append(f"    {message.name},")

        msg_fields = "\n".join(
            f"    {_field(_resolve_ref(field, data), data)}," for field in message.field
        )
        if msg_fields:
            msg_fields = f"\n{msg_fields}\n"

        metadata = ""
        if message.metadata:
            if len(message.metadata) != 1:
                raise ValueError(
                    "parsley-ts only supports one metadata field in Messages"
                )
            if message.metadata[0].name != "UNUSED":
                metadata = ", " + _field(message.metadata[0], data)

        msg_defs.append(
            f" export const {message.name} = defineMessage([{msg_fields}]{metadata})"
        )

    return _FILE.substitute(
        imports_msg_types=import_msg_types,
        sid_fields=sid_fields,
        msg_fields=msg_shared_fields,
        msg_definitions="\n\n".join(msg_defs),
        msg_name_list="\n".join(msg_name_list),
    )
