from dataclasses import dataclass, field


@dataclass(frozen=True, kw_only=True)
class ConfigItem:
    name: str
    desc: str = ""


@dataclass(frozen=True, kw_only=True)
class Field(ConfigItem):
    width: int | None = None
    bitfield: str | None = None
    enum: str | None = None


@dataclass(frozen=True, kw_only=True)
class Message(ConfigItem):
    id: int
    timestamp: int
    metadata: list[Field] = field(default_factory=list)
    field: list[Field] = field(default_factory=list)


@dataclass(frozen=True, kw_only=True)
class Board(ConfigItem):
    id: int
    inst: list[ConfigItem] = field(default_factory=list)
    doc_link: str | None = None


@dataclass(frozen=True, kw_only=True)
class Enum(ConfigItem):
    prefix: str
    value: list[ConfigItem]


@dataclass(frozen=True, kw_only=True)
class Bitfield(ConfigItem):
    prefix: str
    bits: list[ConfigItem]


@dataclass(frozen=True, kw_only=True)
class RocketCAN:
    messages: list[Message]
    boards: list[Board]
    enums: list[Enum]
    bitfields: list[Bitfield]
