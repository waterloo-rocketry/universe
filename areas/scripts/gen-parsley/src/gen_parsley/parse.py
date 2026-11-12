from dataclasses import MISSING, fields, is_dataclass
from pathlib import Path
from types import UnionType
from typing import Union, get_args, get_origin, get_type_hints

from strictyaml import load

from gen_parsley.models import RocketCAN


def load_rocketcan(path: Path | str) -> RocketCAN:
    """
    read and parse a RocketCAN object from a rocketcan.yaml path
    """
    if isinstance(path, str):
        path = Path(path)
    yaml = load(path.read_text(encoding="utf-8"), label=str(path))
    return _convert(RocketCAN, yaml.data)


def _convert(cls: type, value):
    origin = get_origin(cls)
    if origin in (Union, UnionType):
        inner = next(a for a in get_args(cls) if a is not type(None))
        return None if value is None else _convert(inner, value)
    elif origin is list:
        (item,) = get_args(cls)
        return [_convert(item, v) for v in value]
    elif is_dataclass(cls):
        return _from_dict(cls, value)
    elif cls is int:
        try:
            return cls(value)
        except ValueError:
            # hex handling logic
            return int(value, 16)
    return cls(value)


def _from_dict(cls: type, data: dict):
    hints = get_type_hints(cls)
    kwargs = {}
    for f in fields(cls):
        key = f.name.replace("_", "-")
        if key in data:
            kwargs[f.name] = _convert(hints[f.name], data[key])
        elif f.default is MISSING and f.default_factory is MISSING:
            raise TypeError(f"missing key {f.name}")
    return cls(**kwargs)
