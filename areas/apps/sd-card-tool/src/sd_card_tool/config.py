"""Loads the on-card format from a YAML file."""

from __future__ import annotations

from dataclasses import dataclass
from importlib import resources
from pathlib import Path
from typing import Any, Literal

import yaml

from .crc import ALGORITHMS, CrcParams

# Names the tool looks up in the header layout.
HEADER_ID = "HEADER_ID"
STARTUP_COUNTER = "STARTUP_COUNTER"
DATA_TYPE = "DATA_TYPE"
SEGMENT_COUNTER = "SEGMENT_COUNTER"
REQUIRED = (HEADER_ID, STARTUP_COUNTER, DATA_TYPE, SEGMENT_COUNTER)


class ConfigError(ValueError):
    """The format file is missing a value or has an invalid one."""


@dataclass(frozen=True)
class Field:
    """A value in the header: a whole field, or a subfield inside one.

    It sits in bytes [offset, offset + size) of the header. Within that
    field's integer it occupies `bits` bits, starting `shift` bits up from the
    bottom. `parent` is the top-level field it belongs to (itself, for a
    top-level field).
    """
    name: str
    parent: str
    offset: int
    size: int
    shift: int
    bits: int
    value: int | None = None

    @property
    def max(self) -> int:
        return (1 << self.bits) - 1


@dataclass(frozen=True)
class DataType:
    name: str
    ext: str


@dataclass(frozen=True)
class FormatConfig:
    slot_size: int
    clear_bytes: int
    byte_order: Literal["little", "big"]
    # Top-level header fields, in order.
    fields: tuple[Field, ...]
    # Every named value, top-level and subfield, by name.
    values: dict[str, Field]
    header_size: int
    footer_size: int
    crc: CrcParams
    crc_covers: Literal["header+data", "data"]
    filename: str
    wrapped_filename: str
    types: dict[int, DataType]

    @property
    def data_size(self) -> int:
        """Payload bytes in each chunk."""
        return self.slot_size - self.header_size - self.footer_size

    def parts(self, field: Field) -> list[Field]:
        """The subfields of a top-level field, or the field itself."""
        subs = [value for value in self.values.values()
                if value.parent == field.name and value is not field]
        return subs or [field]

    @property
    def header_id(self) -> int:
        value = self.values[HEADER_ID].value
        assert value is not None
        return value

    def extension(self, data_type: int) -> str:
        known = self.types.get(data_type)
        return known.ext if known else f".TYPE{data_type}"


def default_format_text() -> str:
    return resources.files("sd_card_tool").joinpath(
        "format.yaml").read_text(encoding="utf-8")


def load_config(path: str | Path | None = None) -> FormatConfig:
    """Read a format file, or the packaged default when no path is given."""
    text = default_format_text() if path is None else Path(path).read_text(
        encoding="utf-8")
    try:
        raw = yaml.safe_load(text)
    except yaml.YAMLError as error:
        raise ConfigError(f"Format file is not valid YAML: {error}") from error
    return parse_config(raw)


def parse_config(raw: Any) -> FormatConfig:
    """Validate a decoded YAML document and build a FormatConfig."""
    root = _table(raw, "format file")
    layout = _table(_get(root, "layout"), "layout")
    output = _table(_get(root, "output"), "output")
    crc_raw = _table(_get(root, "crc"), "crc")

    fields, values = _parse_header(_list(_get(root, "header"), "header"))
    footer_size = _parse_footer(_list(_get(root, "footer"), "footer"))
    header_size = sum(field.size for field in fields)

    config = FormatConfig(
        slot_size=_int(layout, "slot_size", "layout."),
        clear_bytes=_int(layout, "clear_bytes", "layout."),
        byte_order=_choice(layout, "byte_order", ("little", "big"), "layout."),
        fields=fields,
        values=values,
        header_size=header_size,
        footer_size=footer_size,
        crc=_parse_crc(crc_raw),
        crc_covers=_choice(crc_raw, "covers", ("header+data", "data"), "crc."),
        filename=_str(output, "filename", "output."),
        wrapped_filename=_str(output, "wrapped_filename", "output."),
        types=_parse_types(root, values),
    )
    _check(config)
    return config


# --- header and footer -----------------------------------------------------

def _parse_header(raw: list) -> tuple[tuple[Field, ...], dict[str, Field]]:
    fields: list[Field] = []
    values: dict[str, Field] = {}
    offset = 0

    def add(field: Field) -> None:
        if field.name in values:
            raise ConfigError(f"header name {field.name} is used twice")
        values[field.name] = field

    for index, item in enumerate(raw):
        table = _table(item, f"header[{index}]")
        name = _str(table, "name", f"header[{index}].")
        width = _int(table, "width", f"{name}.")
        if width <= 0 or width % 8:
            raise ConfigError(f"{name}.width must be a whole number of bytes")
        size = width // 8
        field = Field(name, name, offset, size, 0, width,
                      _optional_int(table, "value", f"{name}."))
        fields.append(field)
        add(field)

        if "subfields" in table:
            shift = width
            for sub_index, sub_item in enumerate(
                    _list(table["subfields"], f"{name}.subfields")):
                sub = _table(sub_item, f"{name}.subfields[{sub_index}]")
                sub_name = _str(sub, "name", f"{name}.subfields[{sub_index}].")
                bits = _int(sub, "width", f"{sub_name}.")
                if bits <= 0:
                    raise ConfigError(f"{sub_name}.width must be positive")
                shift -= bits
                add(Field(sub_name, name, offset, size, shift, bits,
                          _optional_int(sub, "value", f"{sub_name}.")))
            if shift != 0:
                raise ConfigError(
                    f"{name} subfield widths must add up to {width} bits")
        offset += size

    for name in REQUIRED:
        if name not in values:
            raise ConfigError(f"header needs a field named {name}")
    for field in values.values():
        if field.value is not None and not 0 <= field.value <= field.max:
            raise ConfigError(
                f"{field.name}.value does not fit in {field.bits} bits")
    if values[HEADER_ID].value is None:
        raise ConfigError("HEADER_ID needs a value")
    if values[HEADER_ID].value == 0:
        raise ConfigError("HEADER_ID must not be 0, or unused slots would match")
    return tuple(fields), values


def _parse_footer(raw: list) -> int:
    if len(raw) != 1:
        raise ConfigError("footer must hold exactly one field, CRC")
    table = _table(raw[0], "footer[0]")
    if _str(table, "name", "footer[0].") != "CRC":
        raise ConfigError("footer field must be named CRC")
    if _int(table, "width", "CRC.") != 16:
        raise ConfigError("CRC.width must be 16; only CRC-16 is supported")
    return 2


def _parse_crc(table: dict) -> CrcParams:
    algorithm = _str(table, "algorithm", "crc.")
    if algorithm.lower() == "custom":
        return CrcParams(
            poly=_int(table, "poly", "crc."),
            init=_int(table, "init", "crc."),
            reflect_in=_bool(table, "reflect_in", "crc."),
            reflect_out=_bool(table, "reflect_out", "crc."),
            xor_out=_int(table, "xor_out", "crc."),
        )
    params = ALGORITHMS.get(algorithm.upper())
    if params is None:
        raise ConfigError(
            f"crc.algorithm {algorithm!r} is unknown; use one of "
            f"{', '.join(ALGORITHMS)} or custom")
    return params


def _parse_types(root: dict, values: dict[str, Field]) -> dict[int, DataType]:
    enum_name = None
    for item in _list(_get(root, "header"), "header"):
        for sub in item.get("subfields", []) or []:
            if isinstance(sub, dict) and sub.get("name") == DATA_TYPE:
                enum_name = sub.get("enum")
        if item.get("name") == DATA_TYPE:
            enum_name = item.get("enum")
    if enum_name is None:
        return {}

    for index, enum in enumerate(_list(root.get("enums", []), "enums")):
        table = _table(enum, f"enums[{index}]")
        if table.get("name") != enum_name:
            continue
        types: dict[int, DataType] = {}
        for value_index, item in enumerate(
                _list(_get(table, "value"), f"{enum_name}.value")):
            entry = _table(item, f"{enum_name}.value[{value_index}]")
            name = _str(entry, "name", f"{enum_name}.value[{value_index}].")
            number = _int(entry, "id", f"{name}.")
            if not 0 <= number <= values[DATA_TYPE].max:
                raise ConfigError(
                    f"{name}.id does not fit in {values[DATA_TYPE].bits} bits")
            if number in types:
                raise ConfigError(f"{enum_name} id {number} is used twice")
            types[number] = DataType(name, _str(entry, "ext", f"{name}."))
        return types
    raise ConfigError(f"DATA_TYPE refers to enum {enum_name}, which is missing")


def _check(config: FormatConfig) -> None:
    if config.data_size <= 0:
        raise ConfigError("layout.slot_size is too small for the header and CRC")
    if not config.header_size + 1 <= config.clear_bytes <= config.slot_size:
        raise ConfigError(
            "layout.clear_bytes must cover the header and fit in a slot")
    try:
        config.filename.format(counter=0, ext=".BIN", generation=0)
        config.wrapped_filename.format(counter=0, ext=".BIN", generation=1)
    except (KeyError, IndexError, ValueError) as error:
        raise ConfigError(f"output filename pattern is invalid: {error}") \
            from error


# --- small typed getters ----------------------------------------------------

def _get(table: dict, key: str, prefix: str = ""):
    if key not in table:
        raise ConfigError(f"Format file is missing {prefix}{key}")
    return table[key]


def _table(value: Any, where: str) -> dict:
    if not isinstance(value, dict):
        raise ConfigError(f"{where} must be a mapping")
    return value


def _list(value: Any, where: str) -> list:
    if not isinstance(value, list):
        raise ConfigError(f"{where} must be a list")
    return value


def _int(table: dict, key: str, prefix: str = "") -> int:
    value = _get(table, key, prefix)
    if not isinstance(value, int) or isinstance(value, bool):
        raise ConfigError(f"{prefix}{key} must be a whole number")
    return value


def _optional_int(table: dict, key: str, prefix: str = "") -> int | None:
    return _int(table, key, prefix) if key in table else None


def _bool(table: dict, key: str, prefix: str = "") -> bool:
    value = _get(table, key, prefix)
    if not isinstance(value, bool):
        raise ConfigError(f"{prefix}{key} must be true or false")
    return value


def _str(table: dict, key: str, prefix: str = "") -> str:
    value = _get(table, key, prefix)
    if not isinstance(value, str) or not value:
        raise ConfigError(f"{prefix}{key} must be text")
    return value


def _choice(table: dict, key: str, options: tuple[str, ...],
            prefix: str = "") -> Any:
    value = _str(table, key, prefix)
    if value not in options:
        raise ConfigError(f"{prefix}{key} must be one of {', '.join(options)}")
    return value
