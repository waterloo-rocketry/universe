import tomllib
from importlib import resources

import pytest

from sd_card_tool.config import ConfigError, load_config, parse_config


def default_raw() -> dict:
    return tomllib.loads(resources.files("sd_card_tool").joinpath(
        "default_config.toml").read_text(encoding="utf-8"))


def test_default_config_matches_the_spec():
    config = load_config()
    assert config.chunk_size == 32768
    assert config.data_size == 32756
    assert config.counter_bits == 13
    assert config.type_bits == 3
    assert config.max_counter == 8191
    assert config.types == {0: "BIN", 1: "ERR", 2: "TXT"}


def test_loads_a_config_file(tmp_path):
    path = tmp_path / "format.toml"
    text = resources.files("sd_card_tool").joinpath(
        "default_config.toml").read_text(encoding="utf-8")
    path.write_text(text.replace("header_id = 0x534C4F47",
                                 "header_id = 0xCAFEF00D"))
    assert load_config(path).header_id == 0xCAFEF00D


@pytest.mark.parametrize("change, message", [
    ({"chunk_size": 12}, "too small"),
    ({"counter_bits": 12}, "must be 16"),
    ({"header_id": 0}, "must not be 0"),
    ({"header_id": 1 << 32}, "32 bits"),
    ({"byte_order": "middle"}, "byte_order"),
    ({"filename": "{nope}.{extension}"}, "filename"),
    ({"types": {"9": "BIN"}}, "3 bits"),
    ({"types": {"x": "BIN"}}, "number"),
    ({"chunk_size": "big"}, "must be a int"),
    ({"empty_check_bytes": 0}, "empty_check_bytes"),
])
def test_rejects_bad_values(change, message):
    raw = default_raw() | change
    with pytest.raises(ConfigError, match=message):
        parse_config(raw)


def test_rejects_missing_values():
    raw = default_raw()
    del raw["crc"]["poly"]
    with pytest.raises(ConfigError, match="crc.poly"):
        parse_config(raw)


def test_rejects_invalid_toml(tmp_path):
    path = tmp_path / "format.toml"
    path.write_text("chunk_size = = 1")
    with pytest.raises(ConfigError, match="TOML"):
        load_config(path)
