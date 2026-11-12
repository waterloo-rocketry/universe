import pytest

from gen_parsley.errors import RocketCANError
from gen_parsley.parse import _convert


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
