from string import Template
from typing import assert_never, cast

from gen_parsley.errors import RocketCANError
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
// protects against specifying an M that does not match the default $name_MESSAGE_METADATA
export function defineMessage<const F extends readonly Field[]>(
    fields: F,
): MessageSchema<F, typeof $name_MESSAGE_METADATA>
export function defineMessage<const F extends readonly Field[], M extends Field>(
    fields: F,
    metadataField: M,
): MessageSchema<F, M>
export function defineMessage(
    fields: readonly Field[],
    metadataField: Field = $name_MESSAGE_METADATA,
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

// One schema per msg_type

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
    msg_prio: keyof typeof $name_msg_prio | (string & {})
    msg_type: K
    board_type_id: keyof typeof $name_board_type_id | (string & {})
    board_inst_id: keyof typeof $name_board_inst_id | (string & {})
    msg_metadata: MessageMetadata<K>
    data: MessagePayload<K>
}

// discriminated union: narrowing on msg_type narrows msg_metadata and data
export type ParsleyMessage = {
    [K in MessageSchemaKey]: ParsleyMessageEntry<K>
}[MessageSchemaKey]
""")


def _field(
    field: Field | RefField, data: RocketCAN, *, byte_width: int | None = None
) -> str:
    if isinstance(field, Field):
        name = field.name.lower()
        size = cast(int, field.bytes if byte_width is None else byte_width)
        match field.type:
            case "ascii":
                return f"new ASCII('{name}', {size * 8})"
            case "bitfield":
                bitfield = data.get_bitfield(cast(str, field.bitfield))
                # TODO: assuming default bitfield string is *_NOMINAL
                bitfield_default = f"{bitfield.prefix}_NOMINAL"
                return f"new Bitfield('{name}', {size * 8}, '{bitfield_default}', {field.bitfield}_offset)"
            case "enum":
                return f"new Enum('{name}', {size * 8}, {field.enum})"
            case "int":
                return f"new Numeric('{name}', {size * 8}, 1, true)"
            case "uint":
                # TODO: TIMESTAMP_2 requiers the `scale` ctor parameter
                return f"new Numeric('{name}', {size * 8}, 1, false)"
            case "raw":
                return f"new ASCII('{name}', {size * 8})"
            case _:
                assert_never(field.type)
    elif isinstance(field, RefField):
        return f"MSG_FIELD_{field.ref.upper()}"

    raise TypeError(f"Expected Field or RefField, got {type(field)}")


def render(data: RocketCAN) -> str:
    # named identifiers in the generated code
    names: dict[str, str] = {}

    msg_types = ["msg_type"]
    msg_types.extend(enum.name for enum in data.enums)
    msg_types.extend(f"{bitfield.name}_offset" for bitfield in data.bitfields)
    import_msg_types = "\n".join(f"    {name}," for name in msg_types)

    # TODO: these are hardcoded, see if there is some smart way to get these from message types
    names["msg_prio"] = "prio"
    names["board_type_id"] = "board_type"
    names["board_inst_id"] = "board_inst"

    sid_field_defs = []
    for field in data.sid.fields:
        sid_field_def = f"export const {field.name.upper()} = "
        if field.enum is None:
            # one-byte placeholder when enum type not given
            sid_field_def += f"new Numeric('{field.name}', 8)"
        else:
            # TODO: message_type is not hooked up to msg_types in rocketcan.yaml
            sid_field_def += f"new Enum('{field.name}', {field.bits}, {field.enum})"
        sid_field_defs.append(sid_field_def)
    sid_len_sum = " +\n".join(
        f"    {field.name.upper()}.length" for field in data.sid.fields
    )
    sid_fields = f"""\
{"\n".join(sid_field_defs)}
export const MESSAGE_SID_LEN =
{sid_len_sum}"""

    # HACK: assuming last SID field is metadata
    names["MESSAGE_METADATA"] = data.sid.fields[-1].name.upper()

    shared_fields = []
    for field in data.message_fields:
        if field.id is None:
            continue
        if field.id == "timestamp":
            # rocketcan does not specify the output name or scale.
            # as a result this is hard-coded into the generator.
            definition = "new Numeric('time', 16, 1 / 1000, false, true, 's')"
        else:
            definition = _field(field, data)
        shared_fields.append(
            f"export const MSG_FIELD_{field.id.upper()} = {definition}"
        )
    msg_shared_fields = "\n".join(shared_fields)

    msg_defs = []
    msg_name_list = []
    for message in data.messages:
        msg_name_list.append(f"    {message.name},")

        msg_fields = "\n".join(f"    {_field(field, data)}," for field in message.field)
        if msg_fields:
            msg_fields = f"\n{msg_fields}\n"

        metadata = ""
        if len(message.metadata) > 1:
            raise RocketCANError(
                f"{message.yaml_path}.metadata",
                "parsley-ts only supports one metadata field in Messages",
            )
        if message.metadata:
            meta_field = message.metadata[0]
            is_unused = False
            if isinstance(meta_field, Field):
                is_unused = meta_field.name == "UNUSED"

            if not is_unused:
                # Metadata defaults to one byte when its width is omitted.
                metadata = ", " + _field(
                    meta_field,
                    data,
                    byte_width=(
                        1
                        if isinstance(meta_field, Field) and meta_field.bytes is None
                        else None
                    ),
                )

        msg_defs.append(
            f"export const {message.name} = defineMessage([{msg_fields}]{metadata})"
        )

    return _FILE.substitute(
        imports_msg_types=import_msg_types,
        sid_fields=sid_fields,
        msg_fields=msg_shared_fields,
        msg_definitions="\n\n".join(msg_defs),
        msg_name_list="\n".join(msg_name_list),
        **{f"name_{key}": name for key, name in names.items()},
    )
