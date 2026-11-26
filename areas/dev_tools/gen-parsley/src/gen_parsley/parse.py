import re
from collections.abc import Iterable
from dataclasses import MISSING, fields, is_dataclass
from pathlib import Path
from typing import Literal, Union, get_args, get_origin, get_type_hints

from strictyaml import load

from gen_parsley.errors import RocketCANError
from gen_parsley.models import Field, RefField, RocketCAN, YAMLObject

_INT_PATTERN = re.compile(r"-?(0|[1-9][0-9]*|0[xX][0-9a-fA-F]+)")


def load_rocketcan(path: Path | str) -> RocketCAN:
    """
    read and parse a RocketCAN object from a rocketcan.yaml path
    """
    if isinstance(path, str):
        path = Path(path)
    yaml = load(path.read_text(encoding="utf-8"), label=str(path))
    data = _convert(RocketCAN, yaml.data)
    _validate_rocketcan(data)
    return data


def _check_unique(items: Iterable[YAMLObject], key_name: str) -> None:
    visited: set[object] = set()
    for item in items:
        key = getattr(item, key_name)
        if key is None:
            continue
        if key in visited:
            raise RocketCANError(
                f"{item.yaml_path}.{key_name}",
                f"duplicate {key_name} {key!r}",
            )
        visited.add(key)


def _validate_field(field: Field, data: RocketCAN, *, metadata: bool = False) -> None:
    path = field.yaml_path
    if field.bytes is None and not metadata:
        raise RocketCANError(f"{path}.bytes", "field requires a byte width")
    if field.bytes is not None and field.bytes <= 0:
        raise RocketCANError(f"{path}.bytes", "byte width must be positive")

    if field.type == "enum":
        if field.enum is None:
            raise RocketCANError(f"{path}.enum", "enum field requires an enum name")
        try:
            data.get_enum(field.enum)
        except KeyError:
            raise RocketCANError(
                f"{path}.enum", f"cannot find enum named {field.enum!r}"
            ) from None
    elif field.type == "bitfield":
        if field.bitfield is None:
            raise RocketCANError(
                f"{path}.bitfield", "bitfield field requires a bitfield name"
            )
        try:
            data.get_bitfield(field.bitfield)
        except KeyError:
            raise RocketCANError(
                f"{path}.bitfield", f"cannot find bitfield named {field.bitfield!r}"
            ) from None


def _validate_rocketcan(data: RocketCAN) -> None:
    """verify the validity of the decoded RocketCAN object"""
    _check_unique(data.enums, "name")
    _check_unique(data.bitfields, "name")
    _check_unique(data.message_fields, "id")
    _check_unique(data.messages, "name")
    _check_unique(data.messages, "id")

    if not data.sid.fields:
        raise RocketCANError(
            f"{data.sid.yaml_path}.fields", "at least one SID field is required"
        )

    for field in data.message_fields:
        _validate_field(field, data)
    for message in data.messages:
        for item in (*message.metadata, *message.field):
            if isinstance(item, RefField):
                try:
                    data.get_message_field(item.ref)
                except KeyError:
                    raise RocketCANError(
                        f"{item.yaml_path}.ref",
                        f"cannot find message field {item.ref!r}",
                    ) from None
        for field in message.metadata:
            if isinstance(field, Field):
                _validate_field(field, data, metadata=True)
        for field in message.field:
            if isinstance(field, Field):
                _validate_field(field, data)


def _convert(cls: type, value, where: str = "root"):
    origin = get_origin(cls)
    if cls is type(None):
        if value is not None:
            raise RocketCANError(where, "cannot convert non-None value to NoneType")
        return None
    elif origin is Literal:
        if value not in get_args(cls):
            raise RocketCANError(
                where, f"expected one of {get_args(cls)}, got {value!r}"
            )
        return value
    elif origin is Union:
        errors = []
        for t in get_args(cls):
            try:
                return _convert(t, value, where)
            except RocketCANError as e:
                errors.append(e.message)
        raise RocketCANError(
            where, f"no union member matched {value!r}: " + "; ".join(errors)
        )
    elif origin is list:
        (item,) = get_args(cls)
        if not isinstance(value, list):
            raise RocketCANError(where, f"expected a list, got {type(value).__name__}")
        return [_convert(item, v, f"{where}[{i}]") for i, v in enumerate(value)]
    elif is_dataclass(cls):
        return _from_dict(cls, value, where)
    elif cls is int:
        return _parse_int(value, where)
    elif cls is str:
        if not isinstance(value, str):
            raise RocketCANError(
                where, f"expected a string, got {type(value).__name__}"
            )
        return value
    raise TypeError(f"unsupported target type {cls!r}")


def _parse_int(value, where: str) -> int:
    """Parse a decimal or 0x-prefixed hex string. Anything else is rejected."""
    if not isinstance(value, str):
        raise RocketCANError(
            where, f"expected an integer string, got {type(value).__name__}"
        )
    if not _INT_PATTERN.fullmatch(value):
        raise RocketCANError(where, f"invalid integer {value!r}")
    return int(value, 0)


def _from_dict(cls: type, data, where: str = "root"):
    if not isinstance(data, dict):
        raise RocketCANError(where, f"expected a mapping, got {type(data).__name__}")
    hints = get_type_hints(cls)
    kwargs = {}
    accepted = set()
    for f in fields(cls):
        if not f.init:
            continue
        underscored = f.name
        hyphenated = f.name.replace("_", "-")
        accepted.update((underscored, hyphenated))
        spellings = list(dict.fromkeys((hyphenated, underscored)))
        present = [k for k in spellings if k in data]
        if len(present) == 2:
            raise RocketCANError(
                where,
                f"both {hyphenated!r} and {underscored!r} given, use one spelling",
            )
        if present:
            key = present[0]
            kwargs[f.name] = _convert(hints[f.name], data[key], f"{where}.{key}")
        elif f.default is MISSING and f.default_factory is MISSING:
            raise RocketCANError(where, f"missing required key {hyphenated!r}")
    unknown = sorted(str(k) for k in data if k not in accepted)
    if unknown:
        raise RocketCANError(where, f"unknown key(s) {unknown}")
    result = cls(**kwargs)
    if isinstance(result, YAMLObject):
        object.__setattr__(result, "yaml_path", where)
    return result
