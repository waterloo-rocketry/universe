import pytest
import parsley

from pytest import approx
from parsley.bitstring import BitString
from parsley.fields import ASCII, Enum, Numeric, Floating, Bitfield
from parsley.message_definitions import TIMESTAMP_2, MESSAGES

import parsley.message_types as mt

class TestCANMessage:
    """
    We are testing only the message body of CAN messages, which means that BitString won't contain
    a message_sid (ie. message_type | board_id where '|' represents bitwise OR)
    """

    @pytest.fixture()
    def bit_str2(self):
        bit_str2 = BitString()
        bit_str2.push(*TIMESTAMP_2.encode(3))
        return bit_str2


    def test_general_board_status(self, bit_str2):
        # 0x0000000B -> bits 0,1,3 set -> E_5V_OVER_CURR|E_5V_OVER_VOLT|E_12V_OVER_CURR
        bit_str2.push(b"\x00\x00\x00\x0B", 32)
        res = parsley.parse_fields(bit_str2, MESSAGES["GENERAL_BOARD_STATUS"][4:]) # [4:] to skip prio, type, inst
        assert res["board_error_bitfield"] == 'E_5V_OVER_CURR|E_5V_OVER_VOLT|E_12V_OVER_CURR'

    def test_payload_fields_never_shadow_header_fields(self):
        header_names = {'msg_prio', 'msg_type', 'board_type_id', 'board_inst_id', 'msg_metadata'}
        for msg_type, fields in MESSAGES.items():
            for field in fields[4:]:  # [4:] skips the header fields
                assert field.name not in header_names, \
                    f"{msg_type} payload field '{field.name}' collides with a header field"

    def test_reset_cmd(self, bit_str2):
        bit_str2.push(b"\x08\x00", 16) # 0x08 (ALTIMETER), 0x00 (ANY)
        res = parsley.parse_fields(bit_str2, MESSAGES["RESET_CMD"][4:])

        assert res["target_board_type_id"] == 'ALTIMETER'
        assert res["target_board_inst_id"] == 'ANY'

    def test_debug_raw(self, bit_str2):
        bit_str2.push(b"rawmsg", 48)
        res = parsley.parse_fields(bit_str2, MESSAGES["DEBUG_RAW"][4:])

        assert res["string"] == "rawmsg"

    def test_config_set(self, bit_str2):
        # 0x01 (INJECTOR), 0x02 (ROCKET), 0x0304 (ID), 0x0506 (Value)
        bit_str2.push(b"\x01\x02\x03\x04\x05\x06", 48)
        res = parsley.parse_fields(bit_str2, MESSAGES["CONFIG_SET"][4:])

        assert res["target_board_type_id"] == 'INJECTOR'
        assert res["target_board_inst_id"] == 'ROCKET'
        assert res["config_id"] == 0x0304
        assert res["config_value"] == 0x0506

    def test_config_status(self, bit_str2):
        # 0x1122 (ID), 0x3344 (Value)
        bit_str2.push(b"\x11\x22\x33\x44", 32)
        res = parsley.parse_fields(bit_str2, MESSAGES["CONFIG_STATUS"][4:])

        assert res["config_id"] == 0x1122
        assert res["config_value"] == 0x3344

    def test_actuator_cmd(self, bit_str2):
        # 0x00 (ACT_STATE_ON)
        bit_str2.push(b"\x00", 8)
        res = parsley.parse_fields(bit_str2, MESSAGES["ACTUATOR_CMD"][4:])

        assert res["cmd_state"] == "ACT_STATE_ON"

    def test_actuator_status(self, bit_str2):
        # 0x00 (cmd_state=ON), 0x01 (curr_state=OFF)
        bit_str2.push(b"\x00\x01", 16)
        res = parsley.parse_fields(bit_str2, MESSAGES["ACTUATOR_STATUS"][4:])

        assert res["cmd_state"] == "ACT_STATE_ON"
        assert res["curr_state"] == "ACT_STATE_OFF"

    def test_alt_arm_cmd(self, bit_str2):
        # 0x01 (ALT_ARM_STATE_ARMED) — alt_id now encoded in msg_metadata
        bit_str2.push(b"\x01", 8)
        res = parsley.parse_fields(bit_str2, MESSAGES["ALT_ARM_CMD"][4:])

        assert res["alt_arm_state"] == "ALT_ARM_STATE_ARMED"

    def test_alt_arm_status(self, bit_str2):
        # 0x01 (ARMED), 0x0500 (drogue=1280), 0x0A00 (main=2560) — alt_id now in msg_metadata
        bit_str2.push(b"\x01\x05\x00\x0A\x00", 40)
        res = parsley.parse_fields(bit_str2, MESSAGES["ALT_ARM_STATUS"][4:])

        assert res["alt_arm_state"] == "ALT_ARM_STATE_ARMED"
        assert res["drogue_v"] == 1280
        assert res["main_v"] == 2560

    def test_stream_status(self, bit_str2):
        # total_size 0x000A1B (2587), tx_size 0x000005 (5)
        bit_str2.push(b"\x00\x0A\x1B\x00\x00\x05", 48)
        res = parsley.parse_fields(bit_str2, MESSAGES["STREAM_STATUS"][4:])

        assert res["total_size"] == 2587
        assert res["tx_size"] == 5

    def test_stream_data(self, bit_str2):
        # 48-bit ASCII data field
        bit_str2.push(b"hello!", 48)
        res = parsley.parse_fields(bit_str2, MESSAGES["STREAM_DATA"][4:])

        assert res["data"] == "hello!"

    def test_stream_retry(self, bit_str2):
        # STREAM_RETRY has no payload fields beyond TIMESTAMP_2
        res = parsley.parse_fields(bit_str2, MESSAGES["STREAM_RETRY"][4:])

        assert res["time"] == approx(3, abs=1e-3)

    def test_sensor_analog16(self, bit_str2):
        # sensor ID now in msg_metadata; payload is just value (16-bit)
        bit_str2.push(b"\x03\xE8", 16)
        res = parsley.parse_fields(bit_str2, MESSAGES["SENSOR_ANALOG16"][4:])

        assert res["value"] == 1000

    def test_sensor_analog32(self, bit_str2):
        # sensor ID in msg_metadata; 32-bit value
        bit_str2.push(b"\x00\x01\x86\xA0", 32)  # 100000
        res = parsley.parse_fields(bit_str2, MESSAGES["SENSOR_ANALOG32"][4:])

        assert res["value"] == 100000

    def test_sensor_2d_analog24(self, bit_str2):
        # dem_sensor_id in msg_metadata; value_x and value_y (24-bit each)
        bit_str2.push(b"\x00\x01\xF4" + b"\x00\x03\xE8", 48)  # x=500, y=1000
        res = parsley.parse_fields(bit_str2, MESSAGES["SENSOR_2D_ANALOG24"][4:])

        assert res["value_x"] == 500
        assert res["value_y"] == 1000

    def test_sensor_3d_analog16(self, bit_str2):
        # dem_sensor_id in msg_metadata; value_x, value_y, value_z (16-bit each)
        bit_str2.push(b"\x01\xF4\x03\xE8\x05\xDC", 48)  # x=500, y=1000, z=1500
        res = parsley.parse_fields(bit_str2, MESSAGES["SENSOR_3D_ANALOG16"][4:])

        assert res["value_x"] == 500
        assert res["value_y"] == 1000
        assert res["value_z"] == 1500

    def test_gps_timestamp(self, bit_str2):
        # 10 hrs (0x0A), 30 mins (0x1E), 59 secs (0x3B), 99 dsecs (0x63) -> 10:30:59.99
        bit_str2.push(b"\x0A\x1E\x3B\x63", 32)
        res = parsley.parse_fields(bit_str2, MESSAGES["GPS_TIMESTAMP"][4:])

        assert res["hrs"] == 10
        assert res["mins"] == 30
        assert res["secs"] == 59
        assert res["dsecs"] == 99

    def test_gps_latitude(self, bit_str2):
        # 43 degs (0x2B), 28 mins (0x1C), 1234 dmins (0x04D2), 'N' (0x4E)
        bit_str2.push(b"\x2B\x1C\x04\xD2\x4E", 40)
        res = parsley.parse_fields(bit_str2, MESSAGES["GPS_LATITUDE"][4:])

        assert res["degs"] == 43
        assert res["mins"] == 28
        assert res["dmins"] == 1234
        assert res["direction"] == 'N'

    def test_gps_longitude(self, bit_str2):
        # 79 degs (0x4F), 59 mins (0x3B), 5678 dmins (0x162E), 'W' (0x57)
        bit_str2.push(b"\x4F\x3B\x16\x2E\x57", 40)
        res = parsley.parse_fields(bit_str2, MESSAGES["GPS_LONGITUDE"][4:])

        assert res["degs"] == 79
        assert res["mins"] == 59
        assert res["dmins"] == 5678
        assert res["direction"] == 'W'

    def test_gps_altitude(self, bit_str2):
        # altitude 500 (0x000001F4, 32-bit), daltitude 25 (0x19)
        bit_str2.push(b"\x00\x00\x01\xF4\x19", 40)
        res = parsley.parse_fields(bit_str2, MESSAGES["GPS_ALTITUDE"][4:])

        assert res["altitude"] == 500
        assert res["daltitude"] == 25

    def test_gps_info(self, bit_str2):
        bit_str2.push(b"\x05\x02", 16) # 5 sats, quality 2
        res = parsley.parse_fields(bit_str2, MESSAGES["GPS_INFO"][4:])

        assert res["num_sats"] == 5
        assert res["quality"] == 2

    def test_leds_on(self, bit_str2):
        res = parsley.parse_fields(bit_str2, [])
        assert res == {}

    def test_leds_off(self, bit_str2):
        res = parsley.parse_fields(bit_str2, [])
        assert res == {}
