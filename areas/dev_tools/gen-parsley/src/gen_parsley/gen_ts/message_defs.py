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
    field: Field | RefField, data: RocketCAN, *, bit_width: int | None = None
) -> str:
    if isinstance(field, Field):
        name = field.name.lower()
        size = cast(int, field.bytes) * 8 if bit_width is None else bit_width
        match field.type:
            case "ascii":
                return f"new ASCII('{name}', {size})"
            case "bitfield":
                bitfield = data.get_bitfield(cast(str, field.bitfield))
                # TODO: assuming default bitfield string is *_NOMINAL
                bitfield_default = f"{bitfield.prefix}_NOMINAL"
                return f"new Bitfield('{name}', {size}, '{bitfield_default}', {field.bitfield}_offset)"
            case "enum":
                return f"new Enum('{name}', {size}, {field.enum})"
            case "int":
                return f"new Numeric('{name}', {size}, 1, true)"
            case "uint":
                # TODO: TIMESTAMP_2 requiers the `scale` ctor parameter
                return f"new Numeric('{name}', {size}, 1, false)"
            case "raw":
                return f"new ASCII('{name}', {size})"
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

    sid = sorted(data.sid.fields, key=lambda f: f.index)
    expected = [("prio", "enum"), ("message_type", "message_type"),
                ("board_type", "enum"), ("board_inst", "enum"), ("metadata", "metadata")]
    if [(f.name, f.type) for f in sid] != expected:
        raise RocketCANError(f"{data.sid.yaml_path}.fields", "SID fields must match parsley-ts order and roles")
    if any(f.bits <= 0 for f in sid):
        raise RocketCANError(f"{data.sid.yaml_path}.fields", "SID field widths must be positive")

    names["msg_prio"] = data.sid.get_field("prio").enum
    names["board_type_id"] = data.sid.get_field("board_type").enum
    names["board_inst_id"] = data.sid.get_field("board_inst").enum
    metadata_sid = data.sid.get_field("metadata")

    # TODO: update parsley-ts imports MESSAGE_PRIO, BOARD_TYPE_ID,
    # BOARD_INST_ID, and MESSAGE_METADATA to use RocketCAN field names.
    # Parsed message properties still use the old parsley-ts names as well.
    sid_field_defs = []
    exports = [field.name.upper() for field in sid]
    for field, export in zip(sid, exports):
        sid_field_def = f"export const {export} = "
        if field.type == "metadata":
            sid_field_def += f"new Numeric('{field.name}', {field.bits})"
        else:
            mapping = "msg_type" if field.type == "message_type" else field.enum
            sid_field_def += f"new Enum('{field.name}', {field.bits}, {mapping})"
        sid_field_defs.append(sid_field_def)
    sid_len_sum = " +\n".join(
        f"    {name}.length" for name in exports
    )
    sid_fields = f"""\
{"\n".join(sid_field_defs)}
export const MESSAGE_SID_LEN =
{sid_len_sum}"""

    names["MESSAGE_METADATA"] = metadata_sid.name.upper()

    shared_fields = []
    for field in data.message_fields:
        if field.id is None:
            continue
        if field.id == "timestamp":
            # rocketcan does not specify the output name or scale.
            # as a result this is hard-coded into the generator.
            # TODO: reconcile the legacy time name and scaling with RocketCAN.
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

        msg_fields = "\n".join(f"    {_field(field, data)}," for field in sorted(message.fields, key=lambda f: f.index))
        if msg_fields:
            msg_fields = f"\n{msg_fields}\n"

        metadata = ""
        if message.metadata is not None:
            meta_field = message.metadata
            if meta_field.bytes is not None and meta_field.bytes * 8 != metadata_sid.bits:
                raise RocketCANError(f"{meta_field.yaml_path}.bytes", "metadata width must match SID metadata width")
            if meta_field.type in ("ascii", "raw") and metadata_sid.bits % 8:
                raise RocketCANError(f"{meta_field.yaml_path}.type", "ASCII metadata requires a whole-byte width")
            metadata = ", " + _field(
                meta_field, data, bit_width=metadata_sid.bits
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
