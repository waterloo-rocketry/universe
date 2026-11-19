"""Loads the on-card format from a TOML file."""

from __future__ import annotations

import tomllib
from dataclasses import dataclass
from importlib import resources
from pathlib import Path
from typing import Literal

# Header ID (4) + file ID (2) + segment counter (4) before the payload.
HEADER_SIZE = 10
FOOTER_SIZE = 2


class ConfigError(ValueError):
    """The format config is missing a value or has an invalid one."""


@dataclass(frozen=True)
class CrcParams:
    poly: int
    init: int
    reflect_in: bool
    reflect_out: bool
    xor_out: int
    covers: Literal["chunk", "data"]


@dataclass(frozen=True)
class FormatConfig:
    chunk_size: int
    byte_order: Literal["little", "big"]
    header_id: int
    counter_bits: int
    type_bits: int
    counter_position: Literal["high", "low"]
    filename: str
    empty_check_bytes: int
    crc: CrcParams
    types: dict[int, str]

    @property
    def data_size(self) -> int:
        """Payload bytes in each chunk."""
        return self.chunk_size - HEADER_SIZE - FOOTER_SIZE

    @property
    def max_counter(self) -> int:
        return (1 << self.counter_bits) - 1

    @property
    def max_type(self) -> int:
        return (1 << self.type_bits) - 1


def load_config(path: str | Path | None = None) -> FormatConfig:
    """Read a format config, or the packaged default when no path is given."""
    if path is None:
        text = resources.files("sd_card_tool").joinpath(
            "default_config.toml").read_text(encoding="utf-8")
    else:
        text = Path(path).read_text(encoding="utf-8")
    try:
        raw = tomllib.loads(text)
    except tomllib.TOMLDecodeError as error:
        raise ConfigError(f"Config is not valid TOML: {error}") from error
    return parse_config(raw)


def parse_config(raw: dict) -> FormatConfig:
    """Validate a decoded TOML table and build a FormatConfig."""
    crc_raw = _get(raw, "crc", dict)
    config = FormatConfig(
        chunk_size=_get(raw, "chunk_size", int),
        byte_order=_choice(raw, "byte_order", ("little", "big")),
        header_id=_get(raw, "header_id", int),
        counter_bits=_get(raw, "counter_bits", int),
        type_bits=_get(raw, "type_bits", int),
        counter_position=_choice(raw, "counter_position", ("high", "low")),
        filename=_get(raw, "filename", str),
        empty_check_bytes=_get(raw, "empty_check_bytes", int),
        crc=CrcParams(
            poly=_get(crc_raw, "poly", int, "crc."),
            init=_get(crc_raw, "init", int, "crc."),
            reflect_in=_get(crc_raw, "reflect_in", bool, "crc."),
            reflect_out=_get(crc_raw, "reflect_out", bool, "crc."),
            xor_out=_get(crc_raw, "xor_out", int, "crc."),
            covers=_choice(crc_raw, "covers", ("chunk", "data"), "crc."),
        ),
        types=_parse_types(_get(raw, "types", dict)),
    )
    _check(config)
    return config


def _get(table: dict, key: str, kind: type, prefix: str = ""):
    if key not in table:
        raise ConfigError(f"Config is missing {prefix}{key}")
    value = table[key]
    # bool is a subclass of int, so reject it explicitly for integer fields.
    if not isinstance(value, kind) or (kind is int and isinstance(value, bool)):
        raise ConfigError(f"{prefix}{key} must be a {kind.__name__}")
    return value


def _choice(table: dict, key: str, options: tuple[str, ...], prefix: str = ""):
    value = _get(table, key, str, prefix)
    if value not in options:
        raise ConfigError(f"{prefix}{key} must be one of {', '.join(options)}")
    return value


def _parse_types(raw: dict) -> dict[int, str]:
    types: dict[int, str] = {}
    for key, extension in raw.items():
        if not key.isdigit():
            raise ConfigError(f"types key {key!r} must be a number")
        if not isinstance(extension, str) or not extension:
            raise ConfigError(f"types.{key} must be a file extension")
        types[int(key)] = extension
    return types


def _check(config: FormatConfig) -> None:
    if config.data_size <= 0:
        raise ConfigError("chunk_size is too small to hold the header and CRC")
    if not 1 <= config.empty_check_bytes <= config.chunk_size:
        raise ConfigError("empty_check_bytes must be between 1 and chunk_size")
    if config.counter_bits < 1 or config.type_bits < 1:
        raise ConfigError("counter_bits and type_bits must be at least 1")
    if config.counter_bits + config.type_bits != 16:
        raise ConfigError("counter_bits + type_bits must be 16")
    if not 0 <= config.header_id <= 0xFFFFFFFF:
        raise ConfigError("header_id must fit in 32 bits")
    if config.header_id == 0:
        raise ConfigError("header_id must not be 0, or blank slots would match")
    for name in ("poly", "init", "xor_out"):
        if not 0 <= getattr(config.crc, name) <= 0xFFFF:
            raise ConfigError(f"crc.{name} must fit in 16 bits")
    for number in config.types:
        if number > config.max_type:
            raise ConfigError(
                f"types.{number} does not fit in {config.type_bits} bits")
    try:
        config.filename.format(counter=0, extension="BIN")
    except (KeyError, IndexError, ValueError) as error:
        raise ConfigError(f"filename pattern is invalid: {error}") from error
