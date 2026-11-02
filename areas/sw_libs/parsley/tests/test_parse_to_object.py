import pytest

from parsley.bitstring import BitString
from parsley.fields import ASCII, Enum, Numeric
from parsley.message_definitions import MESSAGE_TYPE, BOARD_TYPE_ID, BOARD_INST_ID, MESSAGE_SID, MESSAGE_PRIO, MESSAGE_METADATA, TIMESTAMP_2, CAN_MESSAGE

import parsley.message_types as mt
import utils as utilities
import parsley
import crc8 #cyclic redundancy check
import struct

PARSE_LOGGER_PAGE_SIZE = 4096 

from parsley.parse_to_object import _ParsleyParseInternal, ParsleyParser, USBDebugParser, LiveTelemetryParser, LoggerParser, BitstringParser
from parsley.parsley_message import ParsleyError, ParsleyObject

class TestParseToObject:
    def _to_dict(self, result):
        if isinstance(result, ParsleyError):
            return {'data': {'error': result.error, 'msg_data': result.msg_data}, 'msg_type': result.msg_type}
        
        return result.model_dump() # ParsleyObject -> dict

    def test_internal_class_cannot_be_instantiated(self):
        with pytest.raises(NotImplementedError) as e:
            _ParsleyParseInternal()
        assert "static only" in str(e.value)

    def test_parse(self):
        msg_sid = utilities.create_msg_sid_from_strings('HIGH', 'GENERAL_BOARD_STATUS', '0', 'RLCS_RELAY', 'GROUND')

        bit_str = BitString()
        bit_str.push(*TIMESTAMP_2.encode(1.234))
        board_error_value = (1 << mt.board_error_bitfield_offset['E_5V_OVER_VOLT'])
        board_error_value |= (1 << mt.board_error_bitfield_offset['E_5V_EFUSE_FAULT'])
        bit_str.push(*Numeric('board_error_bitfield', 32).encode(board_error_value))

        msg_data = bit_str.pop(bit_str.length)

        result = _ParsleyParseInternal.parse_to_object(msg_sid, msg_data)
        res = self._to_dict(result)

        expected_res = {
            'msg_type': 'GENERAL_BOARD_STATUS',
            'board_type_id': 'RLCS_RELAY',
            'board_inst_id': 'GROUND',
            'msg_prio': 'HIGH',
            'msg_metadata': 0,
            'data': {
                'time': utilities.approx(1.234),
                'board_error_bitfield': 'E_5V_OVER_VOLT|E_5V_EFUSE_FAULT'
            }
        }

        assert res == expected_res

    def test_parse_partial_byte_fields(self):
        msg_sid = utilities.create_msg_sid_from_strings('LOW', 'DEBUG_RAW', '0', 'GPS', 'ROCKET')

        bit_str = BitString()
        bit_str.push(*TIMESTAMP_2.encode(0.133))
        bit_str.push(*ASCII('string', 48).encode('zZz'))
        msg_data = bit_str.pop(bit_str.length)

        result = _ParsleyParseInternal.parse_to_object(msg_sid, msg_data)
        res = self._to_dict(result)

        expected_res = {
            'msg_type': 'DEBUG_RAW',
            'board_type_id': 'GPS',
            'board_inst_id': 'ROCKET',
            'msg_prio': 'LOW',
            'msg_metadata': 0,
            'data': {
                'time': utilities.approx(0.133),
                'string': 'zZz'
            }
        }

        assert res == expected_res

    def test_parse_sensor_analog(self):
        msg_sid = utilities.create_msg_sid_from_strings('MEDIUM', 'SENSOR_ANALOG16', '0', 'PAYLOAD', 'ANY')

        bit_str = BitString()
        bit_str.push(*TIMESTAMP_2.encode(12.345))
        bit_str.push(*Numeric('value', 16).encode(3300))
        msg_data = bit_str.pop(bit_str.length)

        result = _ParsleyParseInternal.parse_to_object(msg_sid, msg_data)
        res = self._to_dict(result)

        expected_res = {
            'msg_type': 'SENSOR_ANALOG16',
            'board_type_id': 'PAYLOAD',
            'board_inst_id': 'ANY',
            'msg_prio': 'MEDIUM',
            'msg_metadata': 'SENSOR_5V_VOLT',
            'data': {
                'time': utilities.approx(12.345),
                'value': 3300
            }
        }

        assert res == expected_res

    def test_parse_nonzero_metadata(self):
        # metadata=42
        msg_sid = utilities.create_msg_sid_from_strings('LOW', 'DEBUG_RAW', '42', 'GPS', 'ROCKET')

        bit_str = BitString()
        bit_str.push(*TIMESTAMP_2.encode(1.0))
        bit_str.push(*ASCII('string', 48).encode('abc'))
        msg_data = bit_str.pop(bit_str.length)

        result = _ParsleyParseInternal.parse_to_object(msg_sid, msg_data)
        res = self._to_dict(result)

        assert res['msg_metadata'] == 42
        assert res['msg_type'] == 'DEBUG_RAW'

    def test_parse_actuator_cmd_metadata(self):
        # metadata carries ACTUATOR_FUEL_INJECTOR_VALVE (0x01)
        actuator_id_val = mt.actuator_id['ACTUATOR_FUEL_INJECTOR_VALVE']
        msg_sid = utilities.create_msg_sid_from_strings('HIGH', 'ACTUATOR_CMD', str(actuator_id_val), 'INJECTOR', 'ROCKET')

        bit_str = BitString()
        bit_str.push(*TIMESTAMP_2.encode(2.0))
        bit_str.push(*Enum('cmd_state', 8, mt.actuator_state).encode('ACT_STATE_ON'))
        msg_data = bit_str.pop(bit_str.length)

        result = _ParsleyParseInternal.parse_to_object(msg_sid, msg_data)
        res = self._to_dict(result)

        assert res['msg_metadata'] == 'ACTUATOR_FUEL_INJECTOR_VALVE'
        assert res['data']['cmd_state'] == 'ACT_STATE_ON'

    def test_parse_sensor_analog16_metadata(self):
        # metadata carries SENSOR_5V_CURR (0x01)
        sensor_id_val = mt.analog_sensor_id['SENSOR_5V_CURR']
        msg_sid = utilities.create_msg_sid_from_strings('MEDIUM', 'SENSOR_ANALOG16', str(sensor_id_val), 'POWER', 'ROCKET')

        bit_str = BitString()
        bit_str.push(*TIMESTAMP_2.encode(5.0))
        bit_str.push(*Numeric('value', 16).encode(4800))
        msg_data = bit_str.pop(bit_str.length)

        result = _ParsleyParseInternal.parse_to_object(msg_sid, msg_data)
        res = self._to_dict(result)

        assert res['msg_metadata'] == 'SENSOR_5V_CURR'
        assert res['data']['value'] == 4800

    def test_parse_alt_arm_cmd_metadata(self):
        # metadata carries ALTIMETER_STRATOLOGGER (0x01)
        alt_id_val = mt.altimeter_id['ALTIMETER_STRATOLOGGER']
        msg_sid = utilities.create_msg_sid_from_strings('HIGH', 'ALT_ARM_CMD', str(alt_id_val), 'ALTIMETER', 'ROCKET')

        bit_str = BitString()
        bit_str.push(*TIMESTAMP_2.encode(1.0))
        bit_str.push(*Enum('alt_arm_state', 8, mt.alt_arm_state).encode('ALT_ARM_STATE_ARMED'))
        msg_data = bit_str.pop(bit_str.length)

        result = _ParsleyParseInternal.parse_to_object(msg_sid, msg_data)
        res = self._to_dict(result)

        assert res['msg_metadata'] == 'ALTIMETER_STRATOLOGGER'
        assert res['data']['alt_arm_state'] == 'ALT_ARM_STATE_ARMED'

    def test_parse_stream_data_metadata(self):
        # metadata carries SEQ_ID = 5
        seq_id = 5
        msg_sid = utilities.create_msg_sid_from_strings('LOW', 'STREAM_DATA', str(seq_id), 'LOGGER', 'ROCKET')

        bit_str = BitString()
        bit_str.push(*TIMESTAMP_2.encode(3.0))
        bit_str.push(*ASCII('data', 48).encode('hello!'))
        msg_data = bit_str.pop(bit_str.length)

        result = _ParsleyParseInternal.parse_to_object(msg_sid, msg_data)
        res = self._to_dict(result)

        assert res['msg_metadata'] == seq_id
        assert res['data']['data'] == 'hello!'

    def test_parse_sensor_2d_analog24_metadata(self):
        # metadata carries DEM_2D_SENSOR_CANARD_MS5611_BARO_TEMP (0x00)
        dem_id_val = mt.dem_2d_sensor_id['DEM_2D_SENSOR_CANARD_MS5611_BARO_TEMP']
        msg_sid = utilities.create_msg_sid_from_strings('MEDIUM', 'SENSOR_2D_ANALOG24', str(dem_id_val), 'CANARD', 'ROCKET')

        bit_str = BitString()
        bit_str.push(*TIMESTAMP_2.encode(1.5))
        bit_str.push(*Numeric('value_x', 24).encode(500))
        bit_str.push(*Numeric('value_y', 24).encode(1000))
        msg_data = bit_str.pop(bit_str.length)

        result = _ParsleyParseInternal.parse_to_object(msg_sid, msg_data)
        res = self._to_dict(result)

        assert res['msg_metadata'] == 'DEM_2D_SENSOR_CANARD_MS5611_BARO_TEMP'
        assert res['data']['value_x'] == 500
        assert res['data']['value_y'] == 1000

    def test_parse_sensor_3d_analog16_metadata(self):
        # metadata carries DEM_3D_SENSOR_CANARD_LSM6DSV32X_ACCEL (0x04)
        dem_id_val = mt.dem_3d_sensor_id['DEM_3D_SENSOR_CANARD_LSM6DSV32X_ACCEL']
        msg_sid = utilities.create_msg_sid_from_strings('MEDIUM', 'SENSOR_3D_ANALOG16', str(dem_id_val), 'CANARD', 'ROCKET')

        bit_str = BitString()
        bit_str.push(*TIMESTAMP_2.encode(1.5))
        bit_str.push(*Numeric('value_x', 16).encode(100))
        bit_str.push(*Numeric('value_y', 16).encode(200))
        bit_str.push(*Numeric('value_z', 16).encode(300))
        msg_data = bit_str.pop(bit_str.length)

        result = _ParsleyParseInternal.parse_to_object(msg_sid, msg_data)
        res = self._to_dict(result)

        assert res['msg_metadata'] == 'DEM_3D_SENSOR_CANARD_LSM6DSV32X_ACCEL'
        assert res['data']['value_x'] == 100
        assert res['data']['value_y'] == 200
        assert res['data']['value_z'] == 300

    def test_parse_corrupt_enum_metadata_falls_back_to_int(self):
        # ACTUATOR_CMD uses actuator_id enum for metadata, but 0xFF is not a valid actuator_id
        # -> should fall back to raw int instead of raising
        bit_msg_sid = BitString()
        bit_msg_sid.push(*MESSAGE_PRIO.encode('HIGH'))
        bit_msg_sid.push(*MESSAGE_TYPE.encode('ACTUATOR_CMD'))
        bit_msg_sid.push(*BOARD_TYPE_ID.encode('INJECTOR'))
        bit_msg_sid.push(*BOARD_INST_ID.encode('ROCKET'))
        bit_msg_sid.push(b'\xFF', MESSAGE_METADATA.length)  # 0xFF not in actuator_id enum
        msg_sid = bit_msg_sid.pop(MESSAGE_SID.length)

        bit_str = BitString()
        bit_str.push(*TIMESTAMP_2.encode(1.0))
        bit_str.push(*Enum('cmd_state', 8, mt.actuator_state).encode('ACT_STATE_ON'))
        msg_data = bit_str.pop(bit_str.length)

        result = _ParsleyParseInternal.parse_to_object(msg_sid, msg_data)
        res = self._to_dict(result)

        assert isinstance(result, ParsleyObject)
        assert res['msg_metadata'] == 255  # falls back to raw int 0xFF
        assert res['msg_type'] == 'ACTUATOR_CMD'
        assert res['data']['cmd_state'] == 'ACT_STATE_ON'

    def test_parse_bad_msg_type(self):
        msg_sid = b'\x00\x00'
        msg_data = b'\xAB\xCD\xEF\x00'
        result = _ParsleyParseInternal.parse_to_object(msg_sid, msg_data)
        assert isinstance(result, ParsleyError)
        assert 'error' in result.error

    def test_parse_empty(self):
        msg_sid = b''
        msg_data = b''
        result = _ParsleyParseInternal.parse_to_object(msg_sid, msg_data)
        assert isinstance(result, ParsleyError)
        assert 'error' in result.error

    def test_parse_messed_up_SID(self):
        msg_sid = b'\xFF\xFF\xFF\xFF'  # Invalid SID
        msg_data = b'\x00\x00\x00\x00'  # Dummy data
        result = _ParsleyParseInternal.parse_to_object(msg_sid, msg_data)
        assert isinstance(result, ParsleyError)
        assert 'error' in result.error

    def test_parse_bad_board_type_id(self):
        # manually build message since using BOARD_TYPE_ID from message_definitions will throw an error for b'\x1F' as it is invalid
        bit_msg_sid = BitString()
        bit_msg_sid.push(*MESSAGE_PRIO.encode('LOW'))
        bit_msg_sid.push(*MESSAGE_TYPE.encode('LEDS_ON'))
        bit_msg_sid.push(b'\x1F', BOARD_TYPE_ID.length)  # invalid board_type
        bit_msg_sid.push(b'\x00', BOARD_INST_ID.length)  # dummy board instance
        bit_msg_sid.push(*MESSAGE_METADATA.encode(0))    # metadata
        msg_sid = bit_msg_sid.pop(MESSAGE_SID.length)

        result = _ParsleyParseInternal.parse_to_object(msg_sid, b'')
        assert isinstance(result, ParsleyObject)
        assert str(result.board_type_id) == "0x1F"
        assert str(result.board_inst_id) == "ANY"
        assert result.msg_prio == "LOW"
        assert result.msg_type == "LEDS_ON"

    def test_parse_bad_msg_data(self):
        msg_sid = utilities.create_msg_sid_from_strings('MEDIUM', 'ALT_ARM_STATUS', '0', 'ALTIMETER', 'ANY')

        msg_data = b'\x00\x00\x01'  # truncated, missing drogue_v and main_v

        result = _ParsleyParseInternal.parse_to_object(msg_sid, msg_data)
        assert isinstance(result, ParsleyError)
        assert 'error' in result.error

    def test_bad_board_instance(self):
        bit_msg_sid = BitString()
        bit_msg_sid.push(*MESSAGE_PRIO.encode('LOW'))
        bit_msg_sid.push(*MESSAGE_TYPE.encode('LEDS_ON'))
        bit_msg_sid.push(*BOARD_TYPE_ID.encode('GPS'))      # valid board type
        bit_msg_sid.push(b'\x1F', BOARD_INST_ID.length)    # invalid board instance
        bit_msg_sid.push(*MESSAGE_METADATA.encode(0))      # metadata
        msg_sid = bit_msg_sid.pop(MESSAGE_SID.length)

        result = _ParsleyParseInternal.parse_to_object(msg_sid, b'')
        assert isinstance(result, ParsleyObject)
        assert str(result.board_type_id) == "GPS"
        assert str(result.board_inst_id) == "0x1F"
        assert str(result.msg_prio) == "LOW"
        assert str(result.msg_type) == "LEDS_ON"

    def test_parse_bitstring(self):
        bit_str = BitString()
        bit_str.push(b'\x12\x34\x56\x78', 32)  # 32 bits of data
        bit_str.push(b'\x9A\xBC', 16)          # 16 bits of data
        result = BitstringParser().parse(bit_str)
        res = self._to_dict(result)
        # First 29 bits of 0x123456789ABC = 0x02468ACF
        # Remaining 19 bits = 0x9ABC -> message data should be 0x009abc when hexified
        assert res['msg_type'].startswith('0x')
        # convert to int for comparison to avoid issues with leading zeros in hex strings
        assert int(res['data']['msg_data'], 16) == int(b'\x00\x9a\xbc'.hex(), 16)
        
    def test_parse_bitstring_empty(self):
        bit_str = BitString() #just an empty bitstring
        with pytest.raises(IndexError) as e:
            BitstringParser().parse(bit_str)
        # message content is not asserted as an index error is expected
        
    def test_parse_bitstring_small(self):
        bit_str = BitString()
        bit_str.push(b'\xFF', 8) # only 8 bits, less than required 29 bits for SID
        with pytest.raises(IndexError) as e:
            BitstringParser().parse(bit_str)
        # message content is not asserted as an index error is expected
        
    def test_parse_bitstring_minimal(self):
        bit_str = BitString()
        bit_str.push(b'\x12\x34\x56\x78', 29)  # Exactly 29 bits for SID
        copy = BitString() #need a copy so that parse_bitstring can consume the copy
        copy.push(b'\x12\x34\x56\x78', 29)
        
        result = BitstringParser().parse(copy)
        res = self._to_dict(result)

        # object with empty data.
        assert isinstance(res['data'], dict)
        assert res['data']['msg_data'] == '0x0'
        
        
    def test_calculate_msg_bit_length(self):
        msg = CAN_MESSAGE.get_fields('GENERAL_BOARD_STATUS')
        bit_len = _ParsleyParseInternal.calculate_msg_bit_len(msg)
        # GENERAL_BOARD_STATUS fields: msg_prio (2) + board_type_id (6) + board_inst_id (6) + msg_metadata (8) + time (16) + board_error_bitfield (32) = 70 bits
        assert bit_len == 70
        
    def test_format_line(self):
        parsed_data = {
            'msg_prio': 'HIGH',
            'msg_type': 'GENERAL_BOARD_STATUS',
            'board_type_id': 'RLCS_RELAY',
            'board_inst_id': 'ROCKET',
            'msg_metadata': 0,
            'data': {
                'time': 1.234,
                'board_error_bitfield': 'E_5V_OVER_VOLT|E_5V_EFUSE_FAULT'
            }
        }
        line = _ParsleyParseInternal.format_line(parsed_data)
        header, body = utilities.split_format_line(line)
        assert header == ['HIGH', 'GENERAL_BOARD_STATUS', 'RLCS_RELAY', 'ROCKET', '0']
        assert body == {'time': '1.234', 'board_error_bitfield': 'E_5V_OVER_VOLT|E_5V_EFUSE_FAULT'}

    def test_format_line_includes_sensor_metadata(self):
        # SENSOR_ANALOG16 should have'SENSOR_PT_CHANNEL_1' as a string for msg_metadata.
        parsed_data = {
            'msg_prio': 'LOW',
            'msg_type': 'SENSOR_ANALOG16',
            'board_type_id': 'LOGGER',
            'board_inst_id': 'ROCKET',
            'msg_metadata': 'SENSOR_PT_CHANNEL_1',
            'data': {'time': 22.473, 'value': 13923},
        }
        line = _ParsleyParseInternal.format_line(parsed_data)
        assert 'SENSOR_PT_CHANNEL_1' in line

    def test_format_line_includes_actuator_metadata(self):
        parsed_data = {
            'msg_prio': 'MEDIUM',
            'msg_type': 'ACTUATOR_CMD',
            'board_type_id': 'INJECTOR',
            'board_inst_id': 'ROCKET',
            'msg_metadata': next(iter(mt.actuator_id)),
            'data': {'time': 1.0, 'cmd_state': next(iter(mt.actuator_state))},
        }
        line = _ParsleyParseInternal.format_line(parsed_data)
        assert next(iter(mt.actuator_id)) in line

    def test_format_line_includes_altimeter_metadata(self):
        parsed_data = {
            'msg_prio': 'MEDIUM',
            'msg_type': 'ALT_ARM_CMD',
            'board_type_id': 'PAYLOAD',
            'board_inst_id': 'ROCKET',
            'msg_metadata': next(iter(mt.altimeter_id)),
            'data': {'time': 1.0, 'alt_arm_state': next(iter(mt.alt_arm_state))},
        }
        line = _ParsleyParseInternal.format_line(parsed_data)
        assert next(iter(mt.altimeter_id)) in line
        
    def test_encode_data(self):
        parsed_data = {
            'msg_prio': 'MEDIUM',
            'msg_type': 'ALT_ARM_STATUS',
            'board_type_id': 'ALTIMETER',
            'board_inst_id': 'ROCKET',
            'msg_metadata': 'ALTIMETER_RAVEN',
            'time': 5.678,
            'alt_arm_state': 'ALT_ARM_STATE_ARMED',
            'drogue_v': 4095,
            'main_v': 2048
        }
        msg_sid, msg_data = _ParsleyParseInternal.encode_data(parsed_data)

        # MEDIUM=0x2, ALT_ARM_STATUS=0x009, ALTIMETER=0x08, ROCKET(inst)=0x02, metadata=0x00 (ALTIMETER_RAVEN)
        # padded: 000 10000 10010010 00000011 00000000 = 0x10920300
        assert msg_sid == int.from_bytes(b'\x10\x92\x02\x00', byteorder='big')

        bit_str = BitString()
        bit_str.push(*TIMESTAMP_2.encode(5.678))
        bit_str.push(*Enum('alt_arm_state', 8, mt.alt_arm_state).encode('ALT_ARM_STATE_ARMED'))
        bit_str.push(*Numeric('drogue_v', 16).encode(4095))
        bit_str.push(*Numeric('main_v', 16).encode(2048))

        expected_msg_data = bytes(bit_str.pop(bit_str.length))
        assert msg_data == list(expected_msg_data)
    
    def test_encode_parse_actuator_cmd_metadata(self):
        # ACTUATOR_CMD uses msg_metadata to carry the actuator_id
        parsed_data = {
            'msg_prio': 'HIGH',
            'msg_type': 'ACTUATOR_CMD',
            'board_type_id': 'INJECTOR',
            'board_inst_id': 'ROCKET',
            'msg_metadata': 'ACTUATOR_FUEL_INJECTOR_VALVE',
            'time': 1.0,
            'cmd_state': 'ACT_STATE_ON',
        }
        msg_sid, msg_data = _ParsleyParseInternal.encode_data(parsed_data)
        result = _ParsleyParseInternal.parse_to_object(msg_sid, msg_data)
        res = self._to_dict(result)

        assert res['msg_metadata'] == 'ACTUATOR_FUEL_INJECTOR_VALVE'
        assert res['msg_type'] == 'ACTUATOR_CMD'

    def test_encode_corrupt_metadata_falls_back_to_numeric(self):
        flat = {
            'msg_prio': 'HIGH',
            'msg_type': 'ACTUATOR_CMD',
            'board_type_id': 'INJECTOR',
            'board_inst_id': 'ROCKET',
            'msg_metadata': 0xFF,  # not a valid actuator_id name
            'time': 0.0,
            'cmd_state': 'ACT_STATE_ON',
        }
        msg_sid, _ = _ParsleyParseInternal.encode_data(flat)

        bit_str_msg_sid = BitString(msg_sid.to_bytes(4, 'big'), MESSAGE_SID.length)
        bit_str_msg_sid.pop(MESSAGE_PRIO.length)
        bit_str_msg_sid.pop(MESSAGE_TYPE.length)
        bit_str_msg_sid.pop(BOARD_TYPE_ID.length)
        bit_str_msg_sid.pop(BOARD_INST_ID.length)
        assert MESSAGE_METADATA.decode(bit_str_msg_sid.pop(MESSAGE_METADATA.length)) == 0xFF

    def test_parsley_error_carries_msg_prio(self):
        bit_sid = BitString()
        bit_sid.push(*MESSAGE_PRIO.encode('LOW'))
        bit_sid.push(b'\x7F', MESSAGE_TYPE.length)  # 0x7F is not a known msg_type
        bit_sid.push(*BOARD_TYPE_ID.encode('GPS'))
        bit_sid.push(*BOARD_INST_ID.encode('ROCKET'))
        bit_sid.push(*MESSAGE_METADATA.encode(0))
        msg_sid = bit_sid.pop(MESSAGE_SID.length)

        result = _ParsleyParseInternal.parse_to_object(msg_sid, b'')
        assert isinstance(result, ParsleyError)
        assert result.msg_prio == 'LOW'

    def test_parse_usb_debug(self):
        line = "$1234ABCD:12,34,56,78\r\n\0"
        #you get \x12\x34\xAB\xCD as SID and \x12\x34\x56\x78 as data (first part vs second part)
        result = USBDebugParser().parse(line)
        res = self._to_dict(result)
        # msg_data should be hexified in the parsed result
        assert int(res['data']['msg_data'], 16) == int(b'\x12\x34\x56\x78'.hex(), 16)
        
    def test_parse_usb_data_empty(self):
        line = "$ABCD1234"
        result = USBDebugParser().parse(line)
        res = self._to_dict(result)
       
        assert isinstance(res['data'], dict)
        assert(res['data'].get('msg_data') == '0x0')
        
    def test_parse_usb_debug_invalid_format(self): # need a $ at start 
        line = "1234:AA,BB"
        with pytest.raises(ValueError) as e:
            USBDebugParser().parse(line)
        assert "Incorrect line format" in str(e.value)
            
    def test_parse_usb_debug_empty_line(self):
        line = ""
        with pytest.raises(ValueError) as e:
            USBDebugParser().parse(line)
        assert "Incorrect line format" in str(e.value)
        
    def test_parse_logger(self):
        buf = bytearray(PARSE_LOGGER_PAGE_SIZE)
        
        log_header = b"LOG" # correct LOG_MAGIC bytes
        sequence_number = 0x64 #page number of data | 100 in decimal

        buf[0:3] = log_header
        buf[3] = sequence_number

        header_length = len(log_header) + 1  # 4 bytes: 3 for "LOG" + 1 for sequence number
        offset = header_length
        
        messages = [
            (0x111, 0x222, [0x01, 0x02]),
            (0x333, 0x444, [0x03, 0x04, 0x05]),
            (0x555, 0x666, [0x06])
        ]
        
        CAN_MSG_HEADER_SIZE = 9  # 4 bytes SID + 4 bytes timestamp + 1 byte DLC
        for sid, timestamp, data in messages:
            data_length_code = len(data) # number of data bytes
            struct.pack_into("<IIB", buf, offset, sid, timestamp, data_length_code)
            offset += CAN_MSG_HEADER_SIZE
            buf[offset:offset+data_length_code] = data
            offset += data_length_code

        # Fill unused bytes after last message with 0xff
        buf[offset:] = b"\xff" * (len(buf) - offset)
        
        results = list(LoggerParser().parse(bytes(buf), 0x64))
        assert len(results) == 3

        r0 = self._to_dict(results[0])
        r1 = self._to_dict(results[1])
        r2 = self._to_dict(results[2])

        assert r0['msg_type'].startswith('0x')
        assert int(r0['data']['msg_data'], 16) == int(b'\x01\x02'.hex(), 16)
        
        assert r1['msg_type'].startswith('0x')
        assert int(r1['data']['msg_data'], 16) == int(b'\x03\x04\x05'.hex(), 16)
        
        assert r2['msg_type'].startswith('0x')
        assert int(r2['data']['msg_data'], 16) == int(b'\x06'.hex(), 16)
        
        
    def test_parse_logger_wrong_size(self):
        buf = b"LOG" + b"\x00" * (PARSE_LOGGER_PAGE_SIZE - 4)  # only 4095 bytes (3 for 'LOG', 1 for sequence)

        assert len(buf) < PARSE_LOGGER_PAGE_SIZE

        with pytest.raises(ValueError) as e:
            list(LoggerParser().parse(buf, 0))
        assert "exactly 4096 bytes" in str(e.value)
            
    def test_parse_logger_wrong_signature(self): # wrong LOG_MAGIC bytes
        buf = b"BAD" + b"\x00" * 4093
        with pytest.raises(ValueError) as e:
            list(LoggerParser().parse(buf, 0))
        assert "Missing 'LOG' signature" in str(e.value)
            
    def test_parse_logger_wrong_page_number(self):
        buf = b"LOG\x05" + b"\x00" * 4092  # Page 5 in buffer
        with pytest.raises(ValueError) as e:
            list(LoggerParser().parse(buf, 10))  # Expect page 10
        assert "Page number mismatch" in str(e.value)

    def test_parse_logger_empty(self):
        buf = bytearray(PARSE_LOGGER_PAGE_SIZE)
        buf[0:3] = b"LOG"
        buf[3] = 0
        
        buf[4:] = b"\xff" * (len(buf) - 4) # Fill unused bytes with 0xff

        results = list(LoggerParser().parse(bytes(buf), 0))
        assert len(results) == 0
    
    def test_parse_live_telemetry_basic(self):
        frame = bytearray()
        frame.append(0x02) #header must be 0x02
        frame.append(10) #frame length
        
        sid = 0x12345678
        frame.append((sid >> 24) & 0x1F) #first 5 bits of SID
        frame.append((sid >> 16) & 0xFF) #next 8 bits of SID
        frame.append((sid >> 8) & 0xFF) #next 8 bits of SID
        frame.append(sid & 0xFF) #last 8 bits of SID

        frame.extend([0xAA, 0xBB, 0xCC]) #payload data
    
        frame[1] = len(frame) + 1  #makes length +1 cause cyclic redundancy check byte
        
        crc = crc8.crc8(frame).digest()[0]
        frame.append(crc) #actually adds the crc byte

        result = LiveTelemetryParser().parse(bytes(frame))
        res = self._to_dict(result)
        expected_val = int.from_bytes(b'\xaa\xbb\xcc', 'big')
        assert res['msg_type'].startswith('0x')
        assert int(res['data']['msg_data'], 16) == expected_val
        
    def test_parse_live_telemetry_too_short(self):
        frame = b'\x02\x06\x12\x34'  #4 bytes, need at least 7
        with pytest.raises(ValueError) as e:
            LiveTelemetryParser().parse(frame)
        assert "Incorrect frame length" in str(e.value)

    def test_parse_live_telemetry_frame_len_zero_rejected(self):
        body = bytearray([0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0xAA, 0xBB, 0xCC])
        crc = crc8.crc8(bytes(body)).digest()[0]
        frame = bytes(body) + bytes([crc])
        with pytest.raises(ValueError) as e:
            LiveTelemetryParser().parse(frame)
        assert "Incorrect frame length" in str(e.value)

    def test_parse_live_telemetry_frame_len_too_large_rejected(self):
        frame = bytes([0x02, 0xFF, 0x12, 0x34, 0x56, 0x78, 0xAA, 0xBB])
        with pytest.raises(ValueError) as e:
            LiveTelemetryParser().parse(frame)
        assert "Incorrect frame length" in str(e.value)

    def test_parse_live_telemetry_wrong_header(self):
        frame = b'\x03\x08\x12\x34\x56\x78\xAA\x00'  #header = 0x03 instead of 0x02
        with pytest.raises(ValueError) as e:
            LiveTelemetryParser().parse(frame)
        assert "Incorrect frame header" in str(e.value)
            
    def test_parse_live_telemetry_bad_crc(self):
        
        frame = bytearray([0x02, 0x08, 0x12, 0x34, 0x56, 0x78, 0xAA, 0xFF])  # wrong CRC
        
        with pytest.raises(ValueError) as e:
            LiveTelemetryParser().parse(bytes(frame))
        assert "Bad checksum" in str(e.value)
