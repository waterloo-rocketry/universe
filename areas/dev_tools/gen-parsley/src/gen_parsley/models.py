from dataclasses import dataclass, field
from functools import cached_property
from typing import Literal


@dataclass(frozen=True, kw_only=True)
class YAMLObject:
    """base class for all yaml-derived models, with path info"""

    yaml_path: str | None = field(default=None, init=False, compare=False, repr=False)


@dataclass(frozen=True, kw_only=True)
class ConfigItem(YAMLObject):
    name: str
    desc: str = ""


@dataclass(frozen=True, kw_only=True)
class SIDField(ConfigItem):
    bits: int
    enum: str | None = None


@dataclass(frozen=True, kw_only=True)
class SID(YAMLObject):
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
class RefField(YAMLObject):
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
class RocketCAN(YAMLObject):
    sid: SID
    message_fields: list[Field]
    messages: list[Message]
    enums: list[Enum]
    bitfields: list[Bitfield]

    @cached_property
    def _bitfields_by_name(self) -> dict[str, Bitfield]:
        return {bitfield.name: bitfield for bitfield in self.bitfields}

    @cached_property
    def _enums_by_name(self) -> dict[str, Enum]:
        return {enum.name: enum for enum in self.enums}

    @cached_property
    def _message_fields_by_id(self) -> dict[str, Field]:
        return {item.id: item for item in self.message_fields if item.id is not None}

    def get_bitfield(self, name: str) -> Bitfield:
        return self._bitfields_by_name[name]

    def get_enum(self, name: str) -> Enum:
        return self._enums_by_name[name]

    def get_message_field(self, ref: str) -> Field:
        return self._message_fields_by_id[ref]
