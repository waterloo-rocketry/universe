from dataclasses import dataclass, field
from typing import Literal


@dataclass(frozen=True, kw_only=True)
class ConfigItem:
    name: str
    desc: str = ""


@dataclass(frozen=True, kw_only=True)
class SIDField(ConfigItem):
    bits: int
    enum: str | None = None


@dataclass(frozen=True, kw_only=True)
class SID:
    fields: list[SIDField] = field(default_factory=list)


@dataclass(frozen=True, kw_only=True)
class Field(ConfigItem):
    id: str | None = None
    bytes: int | None = None
    type: Literal["ascii", "bitfield", "enum", "int", "uint", "raw"]
    unit: str | None = None
    bitfield: str | None = None
    enum: str | None = None


@dataclass(frozen=True, kw_only=True)
class RefField:
    ref: str


@dataclass(frozen=True, kw_only=True)
class Message(ConfigItem):
    id: int
    metadata: list[Field | RefField] = field(default_factory=list)
    field: list[Field | RefField] = field(default_factory=list)


@dataclass(frozen=True, kw_only=True)
class EnumValue(ConfigItem):
    id: int
    doc_link: str | None = None


@dataclass(frozen=True, kw_only=True)
class Enum(ConfigItem):
    prefix: str
    value: list[EnumValue]


@dataclass(frozen=True, kw_only=True)
class BitfieldBit(ConfigItem):
    bit: int


@dataclass(frozen=True, kw_only=True)
class Bitfield(ConfigItem):
    prefix: str
    bits: list[BitfieldBit]


@dataclass(frozen=True, kw_only=True)
class RocketCAN:
    sid: SID
    message_fields: list[Field]
    messages: list[Message]
    enums: list[Enum]
    bitfields: list[Bitfield]

    def get_bitfield(self, name: str) -> Bitfield:
        bitfield = next(
            (b for b in self.bitfields if b.name == name), None
        )
        if bitfield is None:
            raise ValueError(f"Cannot find bitfield with name {name}")
        return bitfield

    def get_enum(self, name: str) -> Enum:
        enum = next(
            (e for e in self.enums if e.name == name), None
        )
        if enum is None:
            raise ValueError(f"Cannot find enum with name {name}")
        return enum

    def get_message_field(self, ref: str) -> Field:
        ref_source = next((f for f in self.message_fields if f.id == ref), None)
        if ref_source is None:
            raise ValueError(f"Cannot find message_field with id {ref}")
        return ref_source

