def hexify(data: bytes, is_msg_type: bool = False):
    """
    Formats byte strings into its respective hexadecimal strings.

    For perspective, printing the byte string b'\x12\x34\x42' will output b'\x124B' since
    \x34 and \x42 represent the ASCII character '4' and 'B' respectively, which can be misleading.
    hexify() will instead return '0x123442' which visually is much more intuitive.
    """
    value = int.from_bytes(data, byteorder='big')
    if is_msg_type:
        value = value << 5
    hex_str = f'0x{value:X}' # uppercase hexadecimal
    return hex_str
