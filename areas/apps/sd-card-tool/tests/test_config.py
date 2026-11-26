import pytest
from helpers import config_with, default_raw

from sd_card_tool.config import ConfigError, load_config, parse_config
from sd_card_tool.crc import ALGORITHMS, CrcParams


def test_default_format_matches_the_spec():
    config = load_config()
    assert config.slot_size == 32768
    assert config.header_size == 10
    assert config.footer_size == 2
    assert config.data_size == 32756
    assert config.clear_bytes == 512
    assert config.byte_order == "little"
    assert config.header_id == 0x5D5D5D5D
    assert config.crc == ALGORITHMS["CRC-16/CCITT-FALSE"]
    assert config.crc_covers == "header+data"
    assert {n: t.ext for n, t in config.types.items()} == {
        0: ".BIN", 1: ".ERR", 2: ".TXT"}


def test_header_layout():
    values = load_config().values
    counter, data_type = values["STARTUP_COUNTER"], values["DATA_TYPE"]
    assert (values["HEADER_ID"].offset, values["HEADER_ID"].size) == (0, 4)
    # FILE_ID is bytes 4-5; the counter is listed first, so it is on top.
    assert (counter.offset, counter.size, counter.shift, counter.bits) == (
        4, 2, 3, 13)
    assert (data_type.offset, data_type.shift, data_type.bits) == (4, 0, 3)
    assert counter.max == 8191
    assert (values["SEGMENT_COUNTER"].offset,
            values["SEGMENT_COUNTER"].size) == (6, 4)


def test_loads_a_format_file(tmp_path):
    path = tmp_path / "format.yaml"
    from sd_card_tool.config import default_format_text
    path.write_text(default_format_text().replace("0x5D5D5D5D", "0xCAFEF00D"))
    assert load_config(path).header_id == 0xCAFEF00D


def test_custom_crc():
    def change(raw):
        raw["crc"] = {"algorithm": "custom", "poly": 0x8005, "init": 0,
                      "reflect_in": True, "reflect_out": True, "xor_out": 0,
                      "covers": "data"}
    config = config_with(change)
    assert config.crc == CrcParams(0x8005, 0, True, True, 0)
    assert config.crc_covers == "data"


def test_crc_names_ignore_case():
    def change(raw):
        raw["crc"]["algorithm"] = "crc-16/modbus"
    assert config_with(change).crc == ALGORITHMS["CRC-16/MODBUS"]


def test_extra_header_fields_move_the_payload():
    def change(raw):
        raw["header"].append({"name": "BOARD_ID", "width": 8})
    config = config_with(change)
    assert config.header_size == 11
    assert config.data_size == 32755


def header(raw, name):
    return next(f for f in raw["header"] if f["name"] == name)


def file_id_sub(raw, index):
    return header(raw, "FILE_ID")["subfields"][index]


@pytest.mark.parametrize("change, message", [
    (lambda r: r["layout"].update(slot_size=12), "too small"),
    (lambda r: r["layout"].update(clear_bytes=4), "clear_bytes"),
    (lambda r: r["layout"].update(byte_order="middle"), "byte_order"),
    (lambda r: header(r, "HEADER_ID").update(value=0), "must not be 0"),
    (lambda r: header(r, "HEADER_ID").update(value=1 << 32), "32 bits"),
    (lambda r: header(r, "HEADER_ID").pop("value"), "needs a value"),
    (lambda r: header(r, "SEGMENT_COUNTER").update(width=12), "whole number"),
    (lambda r: file_id_sub(r, 0).update(width=12), "add up to 16"),
    (lambda r: header(r, "SEGMENT_COUNTER").update(name="SEG"),
     "SEGMENT_COUNTER"),
    (lambda r: r["header"].append({"name": "HEADER_ID", "width": 8}),
     "used twice"),
    (lambda r: r["footer"][0].update(width=32), "CRC-16"),
    (lambda r: r["crc"].update(algorithm="CRC-99"), "unknown"),
    (lambda r: r["crc"].update(covers="footer"), "covers"),
    (lambda r: r["output"].update(filename="{nope}{ext}"), "filename"),
    (lambda r: r["enums"][0]["value"][0].update(id=9), "3 bits"),
    (lambda r: r["enums"][0]["value"][1].update(id=0), "used twice"),
    (lambda r: file_id_sub(r, 1).update(enum="other"), "missing"),
    (lambda r: r["layout"].update(slot_size="big"), "whole number"),
    (lambda r: r.pop("crc"), "missing crc"),
])
def test_rejects_bad_values(change, message):
    raw = default_raw()
    change(raw)
    with pytest.raises(ConfigError, match=message):
        parse_config(raw)


def test_rejects_invalid_yaml(tmp_path):
    path = tmp_path / "format.yaml"
    path.write_text("layout: [unclosed")
    with pytest.raises(ConfigError, match="YAML"):
        load_config(path)


def test_rejects_a_non_mapping():
    with pytest.raises(ConfigError, match="mapping"):
        parse_config(["not", "a", "mapping"])
