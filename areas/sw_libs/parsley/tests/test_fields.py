import pytest

from parsley.fields import ASCII, Enum, Numeric, Switch, Floating, Bitfield

from parsley import message_types as mt
from utils import approx


class TestASCII:
    def test_ASCII(self):
        a = ASCII("string", 32)
        (data, length) = a.encode("aBcD")
        assert data == b"\x61\x42\x63\x44"
        assert length == 32
        data = a.decode(b"\x4c\x4d\x41\x4f")
        assert data == "LMAO"

    def test_ASCII_spaces(self):
        a = ASCII("string", 32)
        assert a.decode(b"\x20\x20\x57\x20") == "  W "

    def test_ASCII_front_padding(self):
        a = ASCII("string", 32)
        assert a.decode(b"\x57") == "W"

    # there is an interesting behaviour when encoding partial ASCII data:
    # we want the text to be left-aligned (instead of the normal right-aligned seen everywhere else)
    def test_ASCII_partial(self):
        a = ASCII("string", 32)
        (data, _) = a.encode("a")
        assert data == b"a\x00\x00\x00"

    def test_ASCII_decode_encode(self):
        a = ASCII("string", 32)
        assert a.decode(a.encode("1234")[0]) == "1234"

    def test_ASCII_empty(self):
        a = ASCII("string", 32)
        assert a.encode("")[0] == b"\x00\x00\x00\x00"

    def test_ASCII_error_not_str(self):
        a = ASCII("string", 16)
        with pytest.raises(ValueError):
            a.encode(b"12")
        with pytest.raises(ValueError):
            a.encode(12)

    def test_ASCII_error_not_ASCII(self):
        a = ASCII("string", 16)
        with pytest.raises(ValueError):
            a.encode("😎")

    def test_ASCII_error_length(self):
        a = ASCII("string", 16)
        with pytest.raises(ValueError):
            a.encode("xdd")


class TestEnum:
    def test_enum(self):
        enum = Enum("enum", 8, mt.board_type_id)
        (data, length) = enum.encode("INJECTOR")
        assert data == b"\x01"
        assert length == 8
        data = enum.decode(b"\x0A")
        assert data == "PAYLOAD"

    def test_numeric_scale_imprecision(self):
        num = Numeric("time", 24, scale=1 / 1000)
        (data, _) = num.encode(54.321)
        converted_data = num.decode(data)
        assert 54.321 == approx(converted_data)

    def test_numeric_scale_round_trips_exactly(self):
        # encode must round, not floor: an inexact scale (1/1000) otherwise loses 1ms
        num = Numeric("time", 16, scale=1 / 1000)
        for raw in (1, 11, 1000, 1500, 65535):
            assert int.from_bytes(num.encode(num.decode(raw.to_bytes(2, "big")))[0], "big") == raw

    def test_enum_decode_encode(self):
        map = {"a": 1, "b": 10, "c": 100}
        enum = Enum("enum", 8, map)
        assert enum.decode(enum.encode("a")[0]) == "a"

    def test_enum_error_bijective(self):
        map = {"a": 1, "b": 0, "c": 1}
        with pytest.raises(ValueError):
            Enum("enum", 8, map)

    def test_enum_error_init_neg(self):
        map = {"a": -1, "b": 0, "c": 1}
        with pytest.raises(ValueError):
            Enum("enum", 8, map)

    def test_enum_error_length(self):
        map = {"max": 0x3F3F3F3F}
        with pytest.raises(ValueError):
            Enum("enum", 8, map)

    def test_enum_error_contains(self):
        map = {"a": 1, "b": 2, "c": 3}
        enum = Enum("enum", 8, map)
        with pytest.raises(ValueError):
            enum.encode("d")

    def test_enum_decode_error_unknown_value(self):
        map = {"a": 1, "b": 2, "c": 3}
        enum = Enum("enum", 8, map)
        with pytest.raises(ValueError):
            enum.decode(b"\xff")

    def test_enum_get_keys(self):
        map = {"a": 1, "b": 2}
        enum = Enum("enum", 8, map)
        assert set(enum.get_keys()) == {"a", "b"}


class TestNumeric:
    def test_numeric(self):
        num = Numeric("num", 8)
        (data, length) = num.encode(250)
        assert data == b"\xfa"
        assert length == 8
        data = num.decode(b"\x21")
        assert data == 33

    def test_numeric_scale(self):
        num = Numeric("time", 8, scale=2)
        (data, _) = num.encode(12)
        assert data == b"\x06"

        num = Numeric("time", 8, scale=1 / 2)
        (data, _) = num.encode(12)
        assert data == b"\x18"

    def test_numeric_decode_encode(self):
        num = Numeric("num", 8)
        assert num.decode(num.encode(255)[0]) == 255

    def test_numeric_error_not_num(self):
        num = Numeric("num", 8)
        with pytest.raises(ValueError):
            num.encode(b"12")
        with pytest.raises(ValueError):
            num.encode("12")

    def test_numeric_error_unsigned(self):
        num = Numeric("num", 8)
        num.encode(0)
        num.encode(255)
        with pytest.raises(ValueError):
            num.encode(-1)
        with pytest.raises(ValueError):
            num.encode(256)

    def test_numeric_error_signed(self):
        num = Numeric("num", 8, signed=True)
        num.encode(-128)
        num.encode(0)
        num.encode(127)
        with pytest.raises(ValueError):
            num.encode(-129)
        with pytest.raises(ValueError):
            num.encode(128)

    def test_numeric_error_scale_bounds(self):
        num = Numeric("num", 8, scale=1 / 4)
        num.encode(0)
        num.encode(63)
        with pytest.raises(ValueError):
            num.encode(-1)
        with pytest.raises(ValueError):
            num.encode(64)

        num = Numeric("num", 8, signed=True, scale=1 / 4)
        num.encode(-32)
        num.encode(0)
        num.encode(31)
        with pytest.raises(ValueError):
            num.encode(-33)
        with pytest.raises(ValueError):
            num.encode(32)

    def test_numeric_error_neg_scale(self):
        num = Numeric("num", 8, scale=-1 / 2)
        num.encode(-5)
        with pytest.raises(ValueError):
            num.encode(5)

    def test_numeric_encode_rounding_works_for_negative_numbers(self):
        # the round() fix must work the same for negative values, not just positive ones
        num = Numeric("num", 8, signed=True)
        for v in (-128, -4, -1, 0, 127):
            assert num.decode(num.encode(v)[0]) == v
        scaled = Numeric("t", 16, scale=1 / 1000, signed=True)
        for raw in (-32768, -1, 1, 32767):
            assert int.from_bytes(scaled.encode(scaled.decode(raw.to_bytes(2, "big", signed=True)))[0], "big", signed=True) == raw

    def test_numeric_encode_raises_on_real_overflow_not_just_rounding(self):
        # rounding up can push a value past the field's max; that must still raise
        unum = Numeric("num", 8)          # unsigned 0..255
        unum.encode(255.4)                # rounds down to 255, still fits: no error
        with pytest.raises(ValueError):
            unum.encode(255.6)            # rounds up to 256: real overflow, must raise
        snum = Numeric("num", 8, signed=True)  # -128..127
        with pytest.raises(ValueError):
            snum.encode(127.6)            # rounds up to 128: real overflow, must raise
        with pytest.raises(ValueError):
            snum.encode(-128.6)           # rounds down to -129: real overflow, must raise


class TestFloating:
    def test_floating(self):
        fl = Floating("Num")
        # We pick these numbers to be of the form
        # k/2^i as to avoid floating point rounding
        # issues
        assert fl.decode(fl.encode(2.0)[0]) == 2.0
        assert fl.decode(fl.encode(0.5)[0]) == 0.5
        assert fl.decode(fl.encode(2.5)[0]) == 2.5
        assert fl.decode(fl.encode(27.015625)[0]) == 27.015625
        assert fl.decode(fl.encode(1.3125)[0]) == 1.3125
        assert fl.decode(fl.encode(69.0)[0]) == 69.0
        assert fl.decode(fl.encode(420.0)[0]) == 420.0

    def test_floating_little_endian(self):
        fl = Floating("Num", big_endian=False)
        assert fl.decode(fl.encode(2.0)[0]) == 2.0
        assert fl.decode(fl.encode(0.5)[0]) == 0.5

    def test_floating_encode_error_not_num(self):
        fl = Floating("Num")
        with pytest.raises(ValueError):
            fl.encode("not a number")


class TestSwitch:
    def test_switch(self):
        enum = {"a": 0x01, "b": 0x02, "c": 0x03}
        map_key_enum = {"a": [0, 1], "b": [1, 2], "c": [2, 3]}
        switch = Switch("status", 8, enum, map_key_enum)
        (data, length) = switch.encode("a")
        assert data == b"\x01"
        assert length == 8
        decoded_data = switch.decode(data)
        assert decoded_data == "a"
        assert switch.get_fields(decoded_data) == [0, 1]

    def test_switch_get_keys(self):
        enum = {"a": 0x01, "b": 0x02}
        switch = Switch("status", 8, enum, {"a": [], "b": []})
        assert set(switch.get_keys()) == {"a", "b"}

class TestBitfieldLogs:
    @pytest.fixture(autouse=True)
    def bitfield(self):
        return Bitfield(
            name="general_board_status",
            length=16,
            default="E_NOMINAL",
            map_name_offset=mt.board_error_bitfield_offset,
        )

    @pytest.mark.parametrize(
        "bytes,expected",
        [
            (b"\x00\x00", "E_NOMINAL"),
            (b"\x00\x01", "E_5V_OVER_CURR"),
            (b"\x00\x02", "E_5V_OVER_VOLT"),
            (b"\x00\x04", "E_5V_UNDER_VOLT"),
            (b"\x00\x08", "E_12V_OVER_CURR"),
            (b"\x00\x10", "E_12V_OVER_VOLT"),
            (b"\x00\x20", "E_12V_UNDER_VOLT"),
            (b"\x00\x40", "E_BATT_OVER_CURR"),
            (b"\x00\x80", "E_BATT_OVER_VOLT"),
            (b"\x01\x00", "E_BATT_UNDER_VOLT"),
            (b"\x02\x00", "E_MOTOR_OVER_CURR"),
            (b"\x04\x00", "E_IO_ERROR"),
            (b"\x08\x00", "E_FS_ERROR"),
            (b"\x10\x00", "E_WATCHDOG_TIMEOUT"),
            (b"\x20\x00", "E_12V_EFUSE_FAULT"),
            (b"\x40\x00", "E_5V_EFUSE_FAULT"),
            (b"\x80\x00", "E_PT_OUT_OF_RANGE"),
        ],
    )
    def test_decode_various_logs(self, bitfield, bytes, expected):
        assert bitfield.decode(bytes) == expected

    @pytest.mark.parametrize(
        "bytes,expected",
        [
            (b"\x00\x03", "E_5V_OVER_CURR|E_5V_OVER_VOLT"),
            (b"\x00\x05", "E_5V_OVER_CURR|E_5V_UNDER_VOLT"),
        ],
    )
    def test_decode_from_bytes(self, bitfield, bytes, expected):
        assert bitfield.decode(bytes) == expected

    def test_decode_from_hex_string(self, bitfield):
        # decode() also accepts a hex string — covers the isinstance(data, str) branch
        assert bitfield.decode("0001") == "E_5V_OVER_CURR"
        assert bitfield.decode("0000") == "E_NOMINAL"

    def test_decode_custom_bitfield(self):
        # map_name_offset=None → returns bin() string
        bf = Bitfield("raw", 16, map_name_offset=None)
        assert bf.decode(b"\x00\x06") == "0b110"
        assert bf.decode(b"\x00\x00") == "0b0"

    @pytest.mark.parametrize(
        "value,expected_bytes",
        [
            ("E_NOMINAL", b"\x00\x00"),
            ("E_5V_OVER_CURR", b"\x00\x01"),
            ("E_5V_OVER_VOLT", b"\x00\x02"),
            ("E_5V_OVER_CURR|E_5V_OVER_VOLT", b"\x00\x03"),
            ("E_5V_OVER_CURR|E_5V_UNDER_VOLT", b"\x00\x05"),
            ("E_WATCHDOG_TIMEOUT", b"\x10\x00"),
        ],
    )
    
    def test_encode(self, bitfield, value, expected_bytes):
        (data, length) = bitfield.encode(value)
        assert data == expected_bytes
        assert length == 16

    def test_encode_decode_roundtrip(self, bitfield):
        for value in ("E_NOMINAL", "E_5V_OVER_CURR", "E_5V_OVER_CURR|E_5V_OVER_VOLT"):
            assert bitfield.decode(bitfield.encode(value)[0]) == value

    def test_decode_surfaces_unnamed_bits(self):
        # production field is 32 bits wide but only ~17 bits are named; an unnamed
        # bit must never be silently dropped or reported as the nominal default
        bf = Bitfield("board_error_bitfield", 32, "E_NOMINAL", mt.board_error_bitfield_offset)
        assert bf.decode((0).to_bytes(4, "big")) == "E_NOMINAL"
        assert bf.decode((1 << 20).to_bytes(4, "big")) == "UNKNOWN(0x100000)"

    def test_encode_unknown_flag_raises(self, bitfield):
        with pytest.raises(ValueError):
            bitfield.encode("E_NOT_A_REAL_FLAG")

    def test_encode_non_string_raises(self, bitfield):
        with pytest.raises(ValueError):
            bitfield.encode(42)

    def test_encode_custom_bitfield(self):
        bf = Bitfield("raw", 16, map_name_offset=None)
        (data, length) = bf.encode("0b110")
        assert data == b"\x00\x06"
        assert length == 16

    def test_encode_custom_bitfield_invalid_string_raises(self):
        bf = Bitfield("raw", 16, map_name_offset=None)
        with pytest.raises(ValueError):
            bf.encode("not_a_number")

    def test_encode_custom_bitfield_overflow_raises(self):
        bf = Bitfield("raw", 8, map_name_offset=None)
        with pytest.raises(ValueError):
            bf.encode("0x1FF")  # 511 doesn't fit in 8 bits
