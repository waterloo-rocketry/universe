from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

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


# ---------------------------------------------------------------- RocketCANError


def test_rocketcan_error_message_includes_path():
    err = RocketCANError("messages[2].field[0]", "missing key name")

    assert isinstance(err, ValueError)
    assert err.path == "messages[2].field[0]"
    assert str(err) == "messages[2].field[0]: missing key name"


# ---------------------------------------------------------------- int and str


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


# ---------------------------------------------------------------- Optional and list


def test_optional_none_returns_none():
    assert _convert(int | None, None) is None


def test_optional_converts_non_none_value():
    assert _convert(int | None, "0x1F") == 31


def test_optional_invalid_inner_value_raises_instead_of_returning_none():
    with pytest.raises(
        RocketCANError,
        match=r"^x: no union member matched 'zz': invalid integer 'zz'; cannot convert non-None",
    ):
        _convert(int | None, "zz", "x")


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


# ---------------------------------------------------------------- NoneType


def test_none_type_accepts_none():
    assert _convert(type(None), None) is None


def test_none_type_rejects_non_none_value():
    with pytest.raises(RocketCANError, match="cannot convert non-None value to NoneType"):
        _convert(type(None), "x", "x")


# ---------------------------------------------------------------- Unions


def test_union_uses_first_member_that_accepts_value():
    assert _convert(int | str, "5") == 5


def test_union_member_order_decides_the_result():
    assert _convert(str | int, "5") == "5"


def test_union_with_none_returns_none_for_none():
    assert _convert(int | str | None, None) is None


def test_union_with_no_matching_member_reports_every_failure():
    with pytest.raises(RocketCANError, match=r"^x: no union member matched None"):
        _convert(int | str, None, "x")


def test_union_of_unsupported_member_raises_type_error():
    with pytest.raises(TypeError, match="unsupported target type"):
        _convert(int | float, "1.5", "x")


# ---------------------------------------------------------------- Unsupported types


def test_unsupported_target_type_raises_type_error():
    with pytest.raises(TypeError, match="unsupported target type"):
        _convert(float, "1.5", "x")


# ---------------------------------------------------------------- Literal


@pytest.mark.parametrize("value", ["uint", "enum", "raw", "ascii", "int", "bitfield"])
def test_field_type_accepts_each_literal_value(value):
    assert _convert(models.Field, {"name": "x", "type": value}).type == value


def test_literal_returns_matching_value():
    assert _convert(Literal["uint", "enum"], "enum") == "enum"


def test_literal_rejects_value_outside_options_with_path():
    with pytest.raises(
        RocketCANError,
        match=r"^x: expected one of \('uint', 'enum'\), got 'bogus'",
    ):
        _convert(Literal["uint", "enum"], "bogus", "x")


def test_literal_rejects_non_string_value():
    with pytest.raises(RocketCANError, match=r"^x: expected one of .*, got 1$"):
        _convert(Literal["1"], 1, "x")


def test_field_type_error_path_names_the_type_key():
    with pytest.raises(
        RocketCANError,
        match=r"^messages\[0\]\.field\[0\]\.type: expected one of",
    ):
        _convert(models.Field, {"name": "x", "type": "bogus"}, "messages[0].field[0]")


def test_field_missing_type_is_rejected():
    with pytest.raises(RocketCANError, match="missing required key 'type'"):
        _convert(models.Field, {"name": "x"})


# ---------------------------------------------------------------- Union switching (Field | RefField)

FIELD_OR_REF = list[models.Field | models.RefField]


def test_union_switches_to_ref_field_for_ref_mapping():
    assert _convert(FIELD_OR_REF, [{"ref": "ts"}]) == [models.RefField(ref="ts")]


def test_union_switches_to_field_for_field_mapping():
    result = _convert(FIELD_OR_REF, [{"name": "state", "type": "enum", "enum": "STATE"}])

    assert result == [models.Field(name="state", type="enum", enum="STATE")]


def test_union_keeps_order_of_mixed_entries():
    result = _convert(
        FIELD_OR_REF,
        [{"name": "a", "type": "raw"}, {"ref": "b"}, {"name": "c", "type": "int"}],
    )

    assert result == [
        models.Field(name="a", type="raw"),
        models.RefField(ref="b"),
        models.Field(name="c", type="int"),
    ]


def test_union_rejects_entry_matching_neither_member():
    with pytest.raises(RocketCANError, match=r"^root\[0\]: no union member matched"):
        _convert(FIELD_OR_REF, [{"name": "a", "type": "raw", "ref": "b"}])


def test_union_bad_literal_reports_both_member_failures():
    doc = _message_doc(field=[{"name": "x", "type": "bogus"}])

    with pytest.raises(
        RocketCANError,
        match=r"^messages\[0\]\.field\[0\]: no union member matched .*expected one of",
    ):
        _convert(models.Message, doc, where="messages[0]")


# ---------------------------------------------------------------- Dataclass and _from_dict


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
    with pytest.raises(RocketCANError, match=r"^messages\[0\]: missing required key 'ts-name'"):
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
    with pytest.raises(
        RocketCANError,
        match=r"^messages\[0\]\.width: no union member matched 'zz': invalid integer 'zz'",
    ):
        _convert(Sample, {"ts-name": "a", "width": "zz"}, where="messages[0]")


# ---------------------------------------------------------------- RocketCAN models


def _message_doc(**overrides):
    doc = {"name": "LEDS_OFF", "id": "0x20", "field": []}
    doc.update(overrides)
    return doc


def _rocketcan_doc(**overrides):
    doc = {
        "sid": {"fields": [{"name": "priority", "bits": "4", "enum": "PRIO"}]},
        "message_fields": [{"name": "state", "type": "enum", "enum": "STATE", "bytes": "1"}],
        "messages": [
            {
                "name": "LEDS_OFF",
                "desc": "turn off",
                "id": "0x20",
                "metadata": [{"name": "ts", "type": "uint", "bytes": "4"}],
                "field": [
                    {"name": "state", "type": "enum", "enum": "STATE"},
                    {"ref": "ts"},
                ],
            }
        ],
        "enums": [
            {
                "name": "STATE",
                "prefix": "S",
                "value": [{"name": "OFF", "id": "0", "doc_link": "http://x"}],
            }
        ],
        "bitfields": [{"name": "FLAGS", "prefix": "F", "bits": [{"name": "B0", "bit": "0"}]}],
    }
    doc.update(overrides)
    return doc


EXPECTED_DOC_ROCKETCAN = models.RocketCAN(
    sid=models.SID(fields=[models.SIDField(name="priority", bits=4, enum="PRIO")]),
    message_fields=[models.Field(name="state", type="enum", enum="STATE", bytes=1)],
    messages=[
        models.Message(
            name="LEDS_OFF",
            desc="turn off",
            id=32,
            metadata=[models.Field(name="ts", type="uint", bytes=4)],
            field=[
                models.Field(name="state", type="enum", enum="STATE"),
                models.RefField(ref="ts"),
            ],
        )
    ],
    enums=[
        models.Enum(
            name="STATE",
            prefix="S",
            value=[models.EnumValue(name="OFF", id=0, doc_link="http://x")],
        )
    ],
    bitfields=[
        models.Bitfield(
            name="FLAGS",
            prefix="F",
            bits=[models.BitfieldBit(name="B0", bit=0)],
        )
    ],
)


def test_full_rocketcan_document_converts_to_models():
    assert _convert(models.RocketCAN, _rocketcan_doc()) == EXPECTED_DOC_ROCKETCAN


def test_sid_fields_default_to_empty_list():
    assert _convert(models.SID, {}) == models.SID()


def test_rocketcan_missing_sid_reports_root_path():
    doc = _rocketcan_doc()
    del doc["sid"]

    with pytest.raises(RocketCANError, match=r"^root: missing required key 'sid'"):
        _convert(models.RocketCAN, doc)


def test_nested_missing_type_reports_full_path():
    doc = _rocketcan_doc()
    doc["messages"][0]["field"] = [{"name": "state"}]

    with pytest.raises(
        RocketCANError,
        match=r"^root\.messages\[0\]\.field\[0\]: no union member matched .*missing required key 'type'",
    ):
        _convert(models.RocketCAN, doc)


def test_nested_invalid_int_reports_full_path():
    doc = _rocketcan_doc()
    doc["messages"][0]["id"] = "zz"

    with pytest.raises(RocketCANError, match=r"^root\.messages\[0\]\.id: invalid integer"):
        _convert(models.RocketCAN, doc)


def test_enum_value_missing_id_is_rejected():
    with pytest.raises(RocketCANError, match=r"^root\.value\[0\]: missing required key 'id'"):
        _convert(models.Enum, {"name": "S", "prefix": "S", "value": [{"name": "OFF"}]})


def test_enum_entry_with_explicit_value_key_is_rejected():
    enum_doc = {
        "name": "STATE",
        "prefix": "S",
        "value": [{"name": "OFF", "id": "0", "value": "0"}],
    }

    with pytest.raises(RocketCANError, match=r"^root\.value\[0\]: unknown key\(s\) \['value'\]"):
        _convert(models.Enum, enum_doc)


def test_bit_with_explicit_offset_key_is_rejected():
    bitfield_doc = {
        "name": "FLAGS",
        "prefix": "F",
        "bits": [{"name": "B0", "bit": "0", "offset": "0"}],
    }

    with pytest.raises(RocketCANError, match=r"^root\.bits\[0\]: unknown key\(s\) \['offset'\]"):
        _convert(models.Bitfield, bitfield_doc)


# ---------------------------------------------------------------- load_rocketcan


ROCKETCAN_YAML = """\
sid:
  fields:
    - name: priority
      bits: 4
      enum: PRIO
message-fields:
  - name: state
    type: enum
    enum: STATE
    bytes: 1
messages:
  - name: LEDS_OFF
    desc: turn off
    id: 0x20
    metadata:
      - name: ts
        type: uint
        bytes: 4
    field:
      - name: state
        type: enum
        enum: STATE
      - ref: ts
enums:
  - name: STATE
    prefix: S
    value:
      - name: OFF
        id: 0
        doc-link: http://x
bitfields:
  - name: FLAGS
    prefix: F
    bits:
      - name: B0
        bit: 0
"""


def _write_yaml(tmp_path: Path, text: str, name: str = "rocketcan.yaml") -> Path:
    path = tmp_path / name
    path.write_text(text, encoding="utf-8")
    return path


def test_load_rocketcan_accepts_str_path(tmp_path):
    path = _write_yaml(tmp_path, ROCKETCAN_YAML)

    assert load_rocketcan(str(path)) == EXPECTED_DOC_ROCKETCAN


def test_load_rocketcan_accepts_path_object(tmp_path):
    path = _write_yaml(tmp_path, ROCKETCAN_YAML)

    assert load_rocketcan(path) == EXPECTED_DOC_ROCKETCAN


def test_strictyaml_returns_scalars_as_strings():
    data = strict_load(ROCKETCAN_YAML).data

    assert data["messages"][0]["id"] == "0x20"
    assert data["sid"]["fields"][0]["bits"] == "4"


def test_load_rocketcan_rejects_unknown_key_with_path(tmp_path):
    text = ROCKETCAN_YAML.replace("    id: 0x20\n", "    id: 0x20\n    colour: red\n")
    path = _write_yaml(tmp_path, text)

    with pytest.raises(RocketCANError, match=r"^root\.messages\[0\]: unknown key\(s\) \['colour'\]"):
        load_rocketcan(path)


def test_load_rocketcan_malformed_yaml_error_names_file(tmp_path):
    path = _write_yaml(tmp_path, "messages:\n  - name: [unclosed\n", name="broken.yaml")

    with pytest.raises(StrictYAMLError, match="broken.yaml"):
        load_rocketcan(path)
