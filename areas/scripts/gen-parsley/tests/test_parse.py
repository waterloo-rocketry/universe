from dataclasses import dataclass, field
from pathlib import Path

import pytest
from strictyaml import load as strict_load
from strictyaml.exceptions import StrictYAMLError

from gen_parsley import models
from gen_parsley.errors import RocketCANError
from gen_parsley.parse import _convert, load_rocketcan


@dataclass(frozen=True, kw_only=True)
class Sample:
    ts_name: str
    width: int | None = None
    tags: list[str] = field(default_factory=list)
    label: str = "none"


def test_rocketcan_error_message_includes_path():
    err = RocketCANError("messages[2].field[0]", "missing key name")

    assert isinstance(err, ValueError)
    assert err.path == "messages[2].field[0]"
    assert str(err) == "messages[2].field[0]: missing key name"


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("12", 12),
        ("0x1F", 31),
        ("0X1f", 31),
        ("-3", -3),
        ("0", 0),
        ("-0x10", -16),
    ],
)
def test_int_accepts_decimal_and_hex(text, expected):
    assert _convert(int, text) == expected


@pytest.mark.parametrize(
    "text",
    ["1f", "1.5", "zz", "010", "0b11", "0o17", " 12 ", "1_000", ""],
)
def test_int_rejects_invalid_strings(text):
    with pytest.raises(RocketCANError, match="root: invalid integer"):
        _convert(int, text)


@pytest.mark.parametrize("value", [12, None])
def test_int_rejects_non_string_values(value):
    with pytest.raises(RocketCANError, match="expected an integer string"):
        _convert(int, value)


@pytest.mark.parametrize("value", [5, None])
def test_str_rejects_non_string_values(value):
    with pytest.raises(RocketCANError, match="expected a string"):
        _convert(str, value)


def test_str_returns_string_unchanged():
    assert _convert(str, "LEDS_OFF") == "LEDS_OFF"


def test_int_error_includes_given_path():
    with pytest.raises(RocketCANError, match=r"^messages\[2\]\.id: invalid integer"):
        _convert(int, "1f", where="messages[2].id")


def test_optional_none_returns_none():
    assert _convert(int | None, None) is None


def test_optional_converts_non_none_value():
    assert _convert(int | None, "0x1F") == 31


def test_list_empty_returns_empty_list():
    assert _convert(list[int], []) == []


def test_list_converts_hex_elements():
    assert _convert(list[int], ["0x10", "2"]) == [16, 2]


@pytest.mark.parametrize("value", ["0x10", {"a": "1"}, None])
def test_list_rejects_non_list_values(value):
    with pytest.raises(RocketCANError, match="expected a list"):
        _convert(list[int], value, where="messages[0].id")


def test_list_element_error_path_ends_with_index():
    with pytest.raises(RocketCANError, match=r"^messages\[0\]\.ids\[2\]: invalid integer"):
        _convert(list[int], ["1", "2", "zz"], where="messages[0].ids")


def test_nested_list_converts_recursively():
    assert _convert(list[list[int]], [["1", "0x2"], [], ["3"]]) == [[1, 2], [], [3]]


@pytest.mark.parametrize("cls", [float, int | str, int | str | None])
def test_unsupported_target_types_raise_type_error(cls):
    with pytest.raises(TypeError, match="unsupported target type"):
        _convert(cls, "5", "x")


def test_from_dict_accepts_hyphenated_key():
    assert _convert(Sample, {"ts-name": "a"}) == Sample(ts_name="a")


def test_from_dict_accepts_underscored_key():
    assert _convert(Sample, {"ts_name": "a"}) == Sample(ts_name="a")


def test_from_dict_rejects_both_spellings():
    with pytest.raises(RocketCANError, match="both 'ts-name' and 'ts_name' given"):
        _convert(Sample, {"ts-name": "a", "ts_name": "b"})


def test_from_dict_rejects_unknown_key_typo():
    with pytest.raises(RocketCANError, match=r"^root: unknown key\(s\) \['widht'\]"):
        _convert(Sample, {"ts-name": "a", "widht": "2"})


def test_from_dict_missing_required_key_names_yaml_key_and_path():
    with pytest.raises(
        RocketCANError, match=r"^messages\[0\]: missing required key 'ts-name'"
    ):
        _convert(Sample, {}, where="messages[0]")


def test_from_dict_uses_default_for_missing_optional_key():
    assert _convert(Sample, {"ts-name": "a"}) == Sample(ts_name="a", width=None, label="none")


def test_from_dict_uses_default_factory_for_missing_key():
    assert _convert(Sample, {"ts-name": "a"}).tags == []


@pytest.mark.parametrize("value", ["ts-name: a", ["ts-name"], 5])
def test_from_dict_rejects_non_mapping_input(value):
    with pytest.raises(RocketCANError, match="expected a mapping"):
        _convert(Sample, value, where="messages[0]")


def test_from_dict_child_error_path_uses_yaml_key():
    with pytest.raises(RocketCANError, match=r"^messages\[0\]\.width: invalid integer"):
        _convert(Sample, {"ts-name": "a", "width": "zz"}, where="messages[0]")


def test_full_rocketcan_document_converts_to_models():
    doc = {
        "messages": [
            {
                "name": "LEDS_OFF",
                "desc": "turn off",
                "id": "0x20",
                "timestamp": "1",
                "field": [{"name": "state", "width": "2", "enum": "STATE"}],
            }
        ],
        "boards": [
            {"name": "CAMERA", "id": "0x0A", "inst": [{"name": "CAM1"}], "doc_link": "http://x"}
        ],
        "enums": [{"name": "STATE", "prefix": "S", "value": [{"name": "OFF"}]}],
        "bitfields": [{"name": "FLAGS", "prefix": "F", "bits": [{"name": "B0"}]}],
    }
    expected = models.RocketCAN(
        messages=[
            models.Message(
                name="LEDS_OFF",
                desc="turn off",
                id=32,
                timestamp=1,
                field=[models.Field(name="state", width=2, enum="STATE")],
            )
        ],
        boards=[
            models.Board(
                name="CAMERA",
                id=10,
                inst=[models.ConfigItem(name="CAM1")],
                doc_link="http://x",
            )
        ],
        enums=[models.Enum(name="STATE", prefix="S", value=[models.ConfigItem(name="OFF")])],
        bitfields=[
            models.Bitfield(name="FLAGS", prefix="F", bits=[models.ConfigItem(name="B0")])
        ],
    )

    assert _convert(models.RocketCAN, doc) == expected


def test_nested_missing_required_field_reports_full_path():
    doc = {
        "messages": [
            {
                "name": "LEDS_OFF",
                "id": "0x20",
                "timestamp": "1",
                "field": [{"name": "state"}, {"desc": "no name"}],
            }
        ],
        "boards": [],
        "enums": [],
        "bitfields": [],
    }

    with pytest.raises(
        RocketCANError,
        match=r"^root\.messages\[0\]\.field\[1\]: missing required key 'name'",
    ):
        _convert(models.RocketCAN, doc)


def test_nested_invalid_int_reports_full_path():
    doc = {
        "messages": [{"name": "LEDS_OFF", "id": "zz", "timestamp": "1"}],
        "boards": [],
        "enums": [],
        "bitfields": [],
    }

    with pytest.raises(RocketCANError, match=r"^root\.messages\[0\]\.id: invalid integer"):
        _convert(models.RocketCAN, doc)


def test_board_without_inst_defaults_to_empty_list():
    board = _convert(models.Board, {"name": "CAMERA", "id": "0x0A"})

    assert board.inst == []
    assert board.id == 10


def test_enum_entry_with_explicit_value_key_is_rejected():
    enum_doc = {
        "name": "STATE",
        "prefix": "S",
        "value": [{"name": "OFF", "value": "0"}],
    }

    with pytest.raises(
        RocketCANError,
        match=r"^root\.value\[0\]: unknown key\(s\) \['value'\]",
    ):
        _convert(models.Enum, enum_doc)


def test_board_instance_with_explicit_id_key_is_rejected():
    board_doc = {
        "name": "CAMERA",
        "id": "0x0A",
        "inst": [{"name": "CAM1", "id": "1"}],
    }

    with pytest.raises(
        RocketCANError,
        match=r"^root\.inst\[0\]: unknown key\(s\) \['id'\]",
    ):
        _convert(models.Board, board_doc)


def test_bit_with_explicit_offset_key_is_rejected():
    bitfield_doc = {
        "name": "FLAGS",
        "prefix": "F",
        "bits": [{"name": "B0", "offset": "0"}],
    }

    with pytest.raises(
        RocketCANError,
        match=r"^root\.bits\[0\]: unknown key\(s\) \['offset'\]",
    ):
        _convert(models.Bitfield, bitfield_doc)


ROCKETCAN_YAML = """\
messages:
  - name: LEDS_OFF
    desc: turn off
    id: 0x20
    timestamp: 1
    field:
      - name: state
        width: 2
        enum: STATE
boards:
  - name: CAMERA
    id: 0x0A
    doc_link: http://x
enums:
  - name: STATE
    prefix: S
    value:
      - name: OFF
bitfields:
  - name: FLAGS
    prefix: F
    bits:
      - name: B0
"""

EXPECTED_ROCKETCAN = models.RocketCAN(
    messages=[
        models.Message(
            name="LEDS_OFF",
            desc="turn off",
            id=32,
            timestamp=1,
            field=[models.Field(name="state", width=2, enum="STATE")],
        )
    ],
    boards=[
        models.Board(
            name="CAMERA",
            id=10,
            inst=[],
            doc_link="http://x",
        )
    ],
    enums=[models.Enum(name="STATE", prefix="S", value=[models.ConfigItem(name="OFF")])],
    bitfields=[models.Bitfield(name="FLAGS", prefix="F", bits=[models.ConfigItem(name="B0")])],
)


def _write_yaml(tmp_path: Path, text: str, name: str = "rocketcan.yaml") -> Path:
    path = tmp_path / name
    path.write_text(text, encoding="utf-8")
    return path


def test_load_rocketcan_accepts_str_path(tmp_path):
    path = _write_yaml(tmp_path, ROCKETCAN_YAML)

    assert load_rocketcan(str(path)) == EXPECTED_ROCKETCAN


def test_load_rocketcan_accepts_path_object(tmp_path):
    path = _write_yaml(tmp_path, ROCKETCAN_YAML)

    assert load_rocketcan(path) == EXPECTED_ROCKETCAN


def test_strictyaml_returns_scalars_as_strings():
    data = strict_load(ROCKETCAN_YAML).data

    assert data["messages"][0]["id"] == "0x20"
    assert data["messages"][0]["timestamp"] == "1"
    assert all(isinstance(v, str) for v in data["messages"][0].values() if not isinstance(v, (list, dict)))


def test_load_rocketcan_rejects_unknown_key_with_path(tmp_path):
    text = ROCKETCAN_YAML.replace("    timestamp: 1\n", "    timestamp: 1\n    colour: red\n")
    path = _write_yaml(tmp_path, text)

    with pytest.raises(RocketCANError, match=r"^root\.messages\[0\]: unknown key\(s\) \['colour'\]"):
        load_rocketcan(path)


def test_load_rocketcan_malformed_yaml_error_names_file(tmp_path):
    path = _write_yaml(tmp_path, "messages:\n  - name: [unclosed\n", name="broken.yaml")

    with pytest.raises(StrictYAMLError, match="broken.yaml"):
        load_rocketcan(path)
