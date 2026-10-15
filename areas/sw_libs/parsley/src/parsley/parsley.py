import crc8  # pyright: ignore[reportMissingTypeStubs]
from collections.abc import Iterator
from typing import Any
import struct
from parsley.bitstring import BitString
from parsley.fields import Field
from parsley.message_definitions import MESSAGE_SID
from deprecated import deprecated
from parsley.parse_to_object import _ParsleyParseInternal  # pyright: ignore[reportPrivateUsage]
from parsley.parsley_message import ParsleyError

@deprecated(version='2026.2', reason="Deprecated; use a ParsleyParser subclass (USBDebugParser, LiveTelemetryParser, LoggerParser, BitstringParser) from parsley.parse_to_object")
def parse_fields(bit_str: BitString, fields: list[Field]) -> dict[str, Any]:
    """
    Parses binary data stored in a BitString and decodes the data
    based on each field's decode() implementation. Returns a dictionary
    of each field's name to its decoded python value.
    """
    return _ParsleyParseInternal.parse_fields(bit_str, fields)

@deprecated(version='2026.2', reason="Deprecated; use a ParsleyParser subclass (USBDebugParser, LiveTelemetryParser, LoggerParser, BitstringParser) from parsley.parse_to_object")
def parse(msg_sid: bytes, msg_data: bytes) -> dict[str, Any]:
    """
    Extracts the message_type and board_id from msg_sid to construct a CAN message along with message_data.
    Upon reading poorly formatted data, the error is caught and returned in the dictionary.
    """

    result = _ParsleyParseInternal.parse_to_object(msg_sid, msg_data)
    
    if isinstance(result, ParsleyError):
        return {
            'msg_prio': result.msg_prio,
            'board_type_id': result.board_type_id,
            'board_inst_id': result.board_inst_id,
            'msg_type': result.msg_type,
            'msg_metadata': result.msg_metadata,
            'data': {
                'msg_data': result.msg_data,
                'error': result.error
            }
        }
    else:
        return result.model_dump(mode='json')

@deprecated(version='2026.2', reason="Deprecated; use BitstringParser.parse in the new BitstringParser object")
def parse_bitstring(bit_str: BitString) -> tuple[bytes, bytes]:
    msg_sid = int.from_bytes(bit_str.pop(MESSAGE_SID.length), byteorder='big')
    msg_data = [byte for byte in bit_str.pop(bit_str.length)]
    return format_can_message(msg_sid, list(msg_data))

@deprecated(version='2026.2', reason="Deprecated; use LiveTelemetryParser.parse in the new LiveTelemetryParser object")
def parse_live_telemetry(frame: bytes) -> tuple[bytes, bytes] | None:
    if len(frame) < 7:   raise ValueError("Incorrect frame length")
    if frame[0] != 0x02: raise ValueError("Incorrect frame header")

    frame_len = frame[1]
    if not 7 <= frame_len <= len(frame): raise ValueError("Incorrect frame length")
    msg_sid = int.from_bytes(bytes([frame[2] & 0x1F]) + frame[3:6], byteorder='big')
    msg_data = frame[6:frame_len-1]
    exp_crc = frame[frame_len-1]
    msg_crc = crc8.crc8(frame[:frame_len-1]).digest()[0]

    if msg_crc != exp_crc:
        raise ValueError(f'Bad checksum, expected {exp_crc:02X} but got {msg_crc:02X}')

    return format_can_message(msg_sid, list(msg_data))

@deprecated(version='2026.2', reason="Deprecated; use USBDebugParser.parse in the new USBDebugParser object")
def parse_usb_debug(line: str) -> tuple[bytes, bytes] | None:
    line = line.strip(' \0\r\n')
    if len(line) == 0 or line[0] != '$':
        raise ValueError("Incorrect line format")
    line = line[1:]

    if ':' in line:
        msg_sid, msg_data = line.split(':')
        msg_sid = int(msg_sid, 16)
        msg_data = [int(byte, 16) for byte in msg_data.split(',')]
    else:
        msg_sid = int(line, 16)
        msg_data = []

    return format_can_message(msg_sid, msg_data)

@deprecated(version='2026.2', reason="Deprecated; use LoggerParser.parse in the new LoggerParser object")
def parse_logger(buf: bytes, page_number: int) -> Iterator[tuple[bytes, bytes]]:
    """
    Parse one logger record.

    Layout  (little-endian unless stated):
        0  - 2  : ASCII 'L','O','G'
        3       : page number (uint8)
        4  - 12 : SID (uint32 LE) | timestamp (uint32 LE) | DLC (uint8)
        13 - .. : up to 8 bytes CAN payload
        -- ff-padding may follow, removed before parsing --

    Returns whatever `format_can_message()` returns.
    Raises ValueError on any structural problem.
    """

    LOG_MAGIC = b"LOG"          # ASCII “LOG” = 0x4c4f47
    HEADER_FMT = "<IIB"         # SID(uint32 LE), timestamp(uint32 LE), DLC(uint8)
    HEADER_LEN = struct.calcsize(HEADER_FMT)   # == 9

    # Strip the buffer to 4096 bytes, as required by the logger.
    if len(buf) != 4096:
        raise ValueError("Logger message must be exactly 4096 bytes")

    if not buf.startswith(LOG_MAGIC):
        raise ValueError("Missing 'LOG' signature")

    if buf[3] != page_number % 256:
        raise ValueError(f"Page number mismatch: expected {page_number % 256}, got {buf[3]}")
    
    offset = 4 # start of the header

    while (4096 - offset > HEADER_LEN): # at least one message
        sid, _, dlc = struct.unpack_from(HEADER_FMT, buf, offset)

        if sid & 0xE000_0000:
            break

        if not 0 <= dlc <= 8:
            raise ValueError(f"DLC out of range (0-8), got {dlc}")

        offset += HEADER_LEN

        data: list[int] = list(buf[offset: offset + dlc])

        offset += dlc

        yield format_can_message(sid, data)

# our three parsing functions create ints, but after the rewrite, they should return bytes
@deprecated(version='2026.2', reason="Deprecated; use a ParsleyParser subclass (USBDebugParser, LiveTelemetryParser, LoggerParser, BitstringParser) from parsley.parse_to_object")
def format_can_message(msg_sid: int, msg_data: list[int]) -> tuple[bytes, bytes]:
    return _ParsleyParseInternal.format_can_message(msg_sid, msg_data)

# given a dictionary of CAN message data, return the CAN message bits
@deprecated(version='2026.2', reason="Deprecated; use _ParsleyParseInternal.encode_data in parsley.parse_to_object")
def encode_data(parsed_data: dict[str, Any]) -> tuple[int, list[int]]:
    return _ParsleyParseInternal.encode_data(parsed_data)

# formats a parsed CAN message (dictionary) into a singular line
@deprecated(version='2026.2', reason="Deprecated; use _ParsleyParseInternal.format_line in parsley.parse_to_object")
def format_line(parsed_data: dict[str, Any]) -> str:
    return _ParsleyParseInternal.format_line(parsed_data)

# can_message is an array of parsley fields
@deprecated(version='2026.2', reason="Deprecated; use _ParsleyParseInternal.calculate_msg_bit_len in parsley.parse_to_object")
def calculate_msg_bit_len(can_message: list[Field]) -> int:
    return _ParsleyParseInternal.calculate_msg_bit_len(can_message)
