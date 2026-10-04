import pytest
from parsley.bitstring import BitString

class TestBitString:
    def test_bitstring(self):
        bit_str = BitString()
        bit_str.push(b'\xAA', 8)
        bit_str.push(b'\xBB', 8)
        bit_str.push(b'\xCC', 8)
        assert bit_str.pop(24) == b'\xAA\xBB\xCC'

    def test_bitstring_direct_init(self):
        bit_str = BitString(b'\x31\x41')
        assert bit_str.pop(16) == b'\x31\x41'

    def test_bitstring_direct_init_padding(self):
        bit_str = BitString(b'\x03\x14')
        assert bit_str.pop(4) == b'\x00'
        assert bit_str.pop(12) == b'\x03\x14'

    # direct initialization of non-byte-aligned data may induce unintentional malding
    # please specify the desired bit_length if you end up using direct initialization
    def test_bitstring_direct_init_size(self):
        bit_str = BitString(b'\x03\x14', 12)
        assert bit_str.pop(12) == b'\x03\x14'

    def test_bitstring_empty(self):
        bit_str = BitString()
        assert bit_str.pop(0) == b''

    def test_bitstring_LSB(self):
        bit_str = BitString()
        bit_str.push(b'\x00\x10', 16)
        assert bit_str.pop(8) == b'\x00'
        assert bit_str.pop(8) == b'\x10'

    def test_bitstring_non_octet(self):
        bit_str = BitString()
        bit_str.push(b'\x15', 5) # ___1 0101
        bit_str.push(b'\x03', 2) #      __11
        bit_str.push(b'\x01', 2) #      __01
        assert bit_str.pop(9) == b'\x01\x5D' #___1 0101 1101

    def test_bitstring_padding(self):
        bit_str = BitString()
        bit_str.push(b'\xFF', 32)
        assert bit_str.pop(24) == b'\x00\x00\x00'
        assert bit_str.pop(8) == b'\xFF'

    def test_bitstring_push_pop_push(self):
        bit_str = BitString()
        bit_str.push(b'\x81', 8) # 1000 0001
        assert bit_str.pop(6) == b'\x20' # __10 0000
        bit_str.push(b'\x3C', 6) # __11 1100
        assert bit_str.pop(8) == b'\x7C' # 0111 11000

    def test_bitstring_error(self):
        bit_str = BitString()
        bit_str.push(b'\x12', 8) # 0001 0010
        with pytest.raises(IndexError):
            bit_str.pop(16)

    def test_pop_with_variable_length(self):
        bit_str = BitString()
        bit_str.push(b'\xFF', 8) # 1111 1111
        res = bit_str.pop(16, variable_length=True) 
        assert res == b'\xFF'

    def test_push_front(self):
        bit_str = BitString()
        bit_str.push(b'\xAA', 8) # 1010 1010
        bit_str.push_front(b'\x01', 4) # 0001
        res = bit_str.pop(12)
        assert res == b'\x01\xAA' # 0001 1010 1010
