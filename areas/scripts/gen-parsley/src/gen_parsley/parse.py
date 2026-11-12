import re
from dataclasses import MISSING, fields, is_dataclass
from pathlib import Path
from types import UnionType
from typing import Union, get_args, get_origin, get_type_hints

from strictyaml import load

from gen_parsley.errors import RocketCANError
from gen_parsley.models import RocketCAN

_INT_PATTERN = re.compile(r"-?(0|[1-9][0-9]*|0[xX][0-9a-fA-F]+)")


def load_rocketcan(path: Path | str) -> RocketCAN:
    """
    read and parse a RocketCAN object from a rocketcan.yaml path
    """
    if isinstance(path, str):
        path = Path(path)
    yaml = load(path.read_text(encoding="utf-8"), label=str(path))
    return _convert(RocketCAN, yaml.data)


def _convert(cls: type, value, where: str = "root"):
    origin = get_origin(cls)
    if origin in (Union, UnionType):
        inner_types = [a for a in get_args(cls) if a is not type(None)]
        if len(inner_types) != 1:
            raise TypeError(
                f"unsupported target type {cls!r}: only Optional unions are supported"
            )
        return None if value is None else _convert(inner_types[0], value, where)
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
    return cls(**kwargs)
