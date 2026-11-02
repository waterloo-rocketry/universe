from __future__ import annotations

from typing import Any, Literal
import struct

Number = int | float

class Field:
    """
    Abstract base class for all fields that can be transcoded.

    Note: data is assumed to be LSB-aligned to match the implementation of BitString.
    """
    def __init__(self, name: str, length: int, unit: str = ""):
        self.name = name
        self.length = length # length in bits
        self.unit = unit # optional unit description
        self.variable_length = False

    def decode(self, data: bytes) -> Any:
        """
        Converts `self.length` bits of `data` to the field's corresponding python value.
        This value could be an integer, string, etc. depending on the specific field type.
        """
        raise NotImplementedError

    def encode(self, value: Any) -> tuple[bytes, int]:
        """
        Converts value to `self.length` bits of data and returns a tuple of (encoded_value, self.length)
        or raises a ValueError with an appropiate message if this is not possible.

        self.length is returned in order to properly parse leading zeros. For example,
        the following cases are bit-level identical, but are not equilvalent for our purposes:
        2-bit: ______10
        4-bit: ____0010
        8-bit: 00000010 (<= they all look like this)
        """
        raise NotImplementedError

class ASCII(Field):
    """
    Transcodes binary data and ASCII text.

    For example:
    b'\x48\x65\x79' <=> 'Hey'
    """
    def __init__(self, name: str, length: int):
        super().__init__(name, length)
        self.variable_length = True

    def decode(self, data: bytes) -> str:
        return data.replace(b'\x00', b'').decode('ascii') # remove null bytes to return original data

    def encode(self, value: str) -> tuple[bytes, int]:
        if type(value) != str:
            raise ValueError(f'{value} is not a string')
        if not value.isascii():
            raise ValueError(f'{value} contains non-ascii character(s)')
        if self.length < 8*len(value.encode('ascii')):
            raise ValueError(f'{value} is too large for {self.length//8} character(s)')

        # we want strings to be left aligned after they're encoded so pad with trailing null bytes
        encoded_data = value.encode('ascii').ljust(self.length // 8, b'\x00')
        return (encoded_data, self.length)

class Enum(Field):
    """
    Transcodes binary data using a user-defined dictionary.

    This allows for customizable byte interpretations:
    dictionary: {'GENERAL_CMD': 0x060, 'RESET_CMD': 0x160}
    b'\x01\x60' <=> 'RESET_CMD'
    """
    def __init__(self, name: str, length: int, map_key_val: dict[Any, Any]):
        super().__init__(name, length)

        self.map_key_val = map_key_val
        self.map_val_key = {v: k for k, v in self.map_key_val.items()}

        # ensure map is bijective
        value_size = len(self.map_key_val.values())
        unique_value_size = len(set(self.map_key_val.values()))
        if value_size != unique_value_size:
            # weakening the proposition but this message should be clearer
            raise ValueError(f'Mapping "{self.name}" is not bijective: has {value_size} values but only {unique_value_size} are unique')

        for k, v in map_key_val.items():
            if v < 0:
                raise ValueError(f'Mapping value {v} for key {k} must be non-negative')
            if v >= 1 << self.length:
                raise ValueError(f'Mapping value {v} for key {k} is too large to fit in {self.length} bits')

    def decode(self, data: bytes):
        value = int.from_bytes(data, byteorder='big', signed=False)
        if value not in self.map_val_key:
            raise ValueError(f'Value "{value}" not found in map "{self.name}"')

        return self.map_val_key[value]

    def encode(self, value: Any) -> tuple[bytes, int]:
        if value not in self.map_key_val:
            raise ValueError(f'Key "{value}" not found in map "{self.name}"')

        encoded_data = self.map_key_val[value].to_bytes((self.length + 7) // 8, byteorder='big')
        return (encoded_data, self.length)

    def get_keys(self):
        return self.map_key_val.keys()

class Numeric(Field):
    """
    Transcodes binary data and numbers (ie. (un)signed and/or fixed point)
    with an optional scaling factor during transcoding.

    For example:
    b'\xFC' <=> -4 (two's complement)
    """
    def __init__(self, name: str, length: int, scale: float=1, signed: bool=False, big_endian: bool=True, unit: str=""):
        super().__init__(name, length, unit)
        self.scale = scale
        self.signed = signed
        self.endian: Literal['big', 'little'] = 'big' if big_endian else 'little'

    def decode(self, data: bytes) -> Number:
        value = int.from_bytes(data, byteorder=self.endian, signed = self.signed)
        return value * self.scale

    def encode(self, value: Number) -> tuple[bytes, int]:
        if not isinstance(value, (int, float)): # pyright: ignore[reportUnnecessaryIsInstance]
            raise ValueError(f'Value "{value}" is not a valid number')

        value = int(round(value / self.scale))
        hex_value = hex(value)
        if not self.signed:
            if value >= 1 << self.length:
                raise ValueError(f'Value "{value}" ({hex_value}) is too large for {self.length} unsigned bits')
            if value < 0:
                raise ValueError(f'Cannot encode negative value "{value}" in an unsigned field')
        else:
            if value >= 1 << (self.length - 1):
                raise ValueError(f'Value "{value}" ({hex_value}) is too large for {self.length} signed bits')
            if value < -1 << (self.length - 1):
                raise ValueError(f'Value "{value}" ({hex_value}) is too small for {self.length} signed bits')

        encoded_data = value.to_bytes((self.length + 7) // 8, byteorder=self.endian, signed=self.signed)
        return (encoded_data, self.length)

class Floating(Field):
    """
    Transcodes floating point numbers to 32 bit binary
    IEEE format
    - Source https://docs.python.org/3/library/struct.html

    For example:
    9.8125 -> b'A\x1d\x00\x00'

    (Note, byte order may be reversed depending on endianess)

    """
    def __init__(self, name: str, big_endian: bool=True, unit: str=""):
        super().__init__(name, 32, unit)
        self.endian = 'big' if big_endian else 'little'

    def decode(self, data: bytes) -> float:
        if self.endian == 'big':
            return struct.unpack('>f', data)[0]
        else:
            return struct.unpack('<f', data)[0]

    def encode(self, value: Number) -> tuple[bytes, int]:
        if not isinstance(value, (int, float)): # pyright: ignore[reportUnnecessaryIsInstance]
            raise ValueError(f'Value "{value}" is not a valid float')

        value = float(value)

        if self.endian == 'big':
            encoded_data = struct.pack('>f', value)
        else:
            encoded_data = struct.pack('<f', value)

        return (encoded_data, self.length)

class Switch(Enum):
    """
    An Enum wrapper to map binary data -> list of Fields using a user-defined dictionary.

    For perspective, our CAN messages are defined as a Switch that maps:
    binary data <=> string (message type) and then
    string -> list of Fields (the specific fields that are defined in the message type)
    """
    def __init__(self, name: str, length: int, map_key_val: dict[Any, Any], map_key_enum: dict[Any, Any]):
        super().__init__(name, length, map_key_val)
        self.map_key_enum = map_key_enum

    def get_fields(self, key: Any) -> Any:
        return self.map_key_enum[key]

    def get_keys(self):
        return self.map_key_val.keys()

class Bitfield(Field):
    """
    Transcodes binary data and bitfields using a user-defined dictionary.
    
    This is a bitfield, so the dictionary maps the bit position to the name of the field.
    For example:
    dictionary: {'E_NOMINAL': 0, 'E_5V_OVER_CURRENT': 1, 'E_5V_OVER_VOLTAGE': 2}
    b'\x01\x60' <=> 'E_5V_OVER_CURRENT|E_5V_OVER_VOLTAGE'
    """
    def __init__(self, name: str, length: int, default: str="DEFAULT_STRING", map_name_offset: dict[Any, Any] | None=None, unit: str=""):
        super().__init__(name, length, unit)
        self.default = default
        self.map_name_offset = map_name_offset

    def decode(self, data: bytes) -> str:
        if isinstance(data, str):
            data = bytes.fromhex(data)
            
        # For custom bitfields, just return the raw data
        if self.map_name_offset is None:
            return bin(int.from_bytes(data, byteorder='big', signed=False))

        bitfield_value = int.from_bytes(data, byteorder='big')

        status = [j for j, bit in self.map_name_offset.items() if bitfield_value & (1 << bit)]

        # unnamed bits shouldn't be silently dropped or reported as nominal
        named_mask = 0
        for bit in self.map_name_offset.values():
            named_mask |= 1 << bit
        unknown = bitfield_value & ~named_mask
        if unknown:
            status.append(f'UNKNOWN(0x{unknown:X})')

        if bitfield_value == 0:
            status.append(self.default)

        return f"{'|'.join(status)}"

    def encode(self, value: Any) -> tuple[bytes, int]:
        if not isinstance(value, str):
            raise ValueError(f'Value "{value}" is not a valid bitfield string')

        if self.map_name_offset is None: # Custom bitfield so value is a binary string like "0b110"
            try:
                bitfield_value = int(value, 0)
            except (TypeError, ValueError) as exc:
                raise ValueError(f'Value "{value}" is not a valid bitfield string') from exc
            if bitfield_value < 0 or bitfield_value >= (1 << self.length):
                raise ValueError(f'Value "{value}" does not fit in {self.length} bits')
            
            encoded_data = bitfield_value.to_bytes((self.length + 7) // 8, byteorder='big')
            return (encoded_data, self.length)
        
        # Named bitfield where value is a string of flag names seperated by "|"
        # Default string represents "no bits set" (bitmask == 0)
        if value == self.default:
            bitfield_value = 0
        else:
            bitfield_value = 0
            for name in value.split('|'):
                if name not in self.map_name_offset:
                    raise ValueError(f'Name "{name}" not found in bitfield "{self.name}"')
                bitfield_value |= (1 << self.map_name_offset[name])
        if bitfield_value >= (1 << self.length):
            raise ValueError(f'Value "{value}" does not fit in {self.length} bits')

        encoded_data = bitfield_value.to_bytes((self.length + 7) // 8, byteorder='big')
        return (encoded_data, self.length)
