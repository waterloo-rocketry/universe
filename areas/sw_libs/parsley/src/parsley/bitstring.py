class BitString:
    """
    Stores the message data bits that we have yet to parse and lets us read arbitrary-length
    bits from the front. We need to operate at the bit level since some fields are
    non-byte-aligned (eg. DEBUG_MSG's 4-bit DEBUG_LEVEL and DEBUG_MSG's 12-bit LINE_NUM)
    """
    def __init__(self, data: bytes = b'', data_bit_length: int = 0):
        self.length = data_bit_length or len(data) * 8 # length in bits
        # store the data as an int which is unbounded and lets us do bitwise manipulations
        self.data = int.from_bytes(data, byteorder='big')

    def pop(self, field_length: int, variable_length: bool = False) -> bytes:
        """
        Returns the next field_length most significant bits of data as a bytes object.

        The data returned will be LSB-aligned, so for example, asking for 12 bits will return:
        0000BBBB BBBBBBBB
        where B represents a data bit.
        """
        if self.length < field_length:
            if not variable_length:
                raise IndexError
            else:
                field_length = self.length
        self.length -= field_length
        res = self.data >> (self.length) # extract the field_length most significant bits
        self.data = self.data & ((1 << self.length) - 1) # and then mask them out
        return res.to_bytes((field_length + 7) // 8, byteorder='big') # and convert to a bytes object

    def push(self, value: bytes, field_length: int):
        """
        Appends the next field_length least significant bits of data from value (to the back).

        So for example, appending 6 bits from:
        10110000
        will append only 110000
        """
        self.length += field_length
        val_int = int.from_bytes(value, byteorder='big') # convert to int to do bitwise maniuplations
        val_int = val_int & ((1 << field_length) - 1) # extract the field_length least significant bits
        self.data = (self.data << field_length) | val_int # and then append value to the back of data

    def push_front(self, value: bytes, field_length: int):
        """
        Prepends the next field_length least significant bits of data from value (to the front).
        """
        val_int = int.from_bytes(value, byteorder='big')
        self.data = (val_int << self.length) | self.data # prepend value to the front of data
        self.length += field_length
