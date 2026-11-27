package parsley

import (
	"math"
	"testing"
)

/*
	Test helper functions
*/

func bytesEqual(a []byte, b []byte) bool {
	if len(a) != len(b) {
		return false
	}

	for i := 0; i < len(a); i++ {
		if a[i] != b[i] {
			return false
		}
	}

	return true
}

func testUint(b []byte, i uint64, t *testing.T) {
	t.Helper()

	// test readUint
	val, err := readUint(b)
	if val != i || err != nil {
		t.Errorf("readUint failed to decode %d in length %d. decoded: %d", i, len(b), val)
	}

	// test putUint
	temp := [8]byte{0, 0, 0, 0, 0, 0, 0, 0}
	tempSliced := temp[:len(b)]
	err = putUint(tempSliced, i)
	if !bytesEqual(b, tempSliced) {
		t.Errorf("putUint failed to encode %d in length %d", i, len(b))
	}

	// readUint -> putUint roundtrip
	val, err = readUint(b)
	putUint(tempSliced, val)
	if !bytesEqual(b, tempSliced) {
		t.Errorf("readUint -> putUint roundtrip failed for %d in length %d", i, len(b))
	}

	// putUint -> readUint roundtrip
	putUint(tempSliced, val)
	val, err = readUint(tempSliced)
	if val != i {
		t.Errorf("putUint -> readUint roundtrip failed for %d in length %d", i, len(b))
	}
}

func testInt(b []byte, i int64, t *testing.T) {
	t.Helper()
	// test readInt
	val, err := readInt(b)
	if val != i || err != nil {
		t.Errorf("readInt failed to decode %d in length %d. decoded: %d", i, len(b), val)
	}

	// test putInt
	temp := [8]byte{0, 0, 0, 0, 0, 0, 0, 0}
	tempSliced := temp[:len(b)]
	err = putInt(tempSliced, i)
	if !bytesEqual(b, tempSliced) {
		t.Errorf("putInt failed to encode %d in length %d", i, len(b))
	}

	// readInt -> putInt roundtrip
	val, err = readInt(b)
	putInt(tempSliced, val)
	if !bytesEqual(b, tempSliced) {
		t.Errorf("readInt -> putInt roundtrip failed for %d in length %d", i, len(b))
	}

	// putInt -> readInt roundtrip
	putInt(tempSliced, val)
	val, err = readInt(tempSliced)
	if val != i {
		t.Errorf("putInt -> readInt roundtrip failed for %d in length %d", i, len(b))
	}
}

func expectIntToFail(b []byte, i int64, t *testing.T) {
	t.Helper()
	err := putInt(b, i)
	if err == nil {
		t.Error("putInt failed to identify incorrect input")
	}
}

func expectUintToFail(b []byte, i uint64, t *testing.T) {
	t.Helper()
	err := putUint(b, i)
	if err == nil {
		t.Error("putUint failed to identify incorrect input")
	}
}

/*
	codec test begin
*/

func TestReadPutUint(t *testing.T) {
	testUint([]byte{0xFF}, 255, t)
	testUint([]byte{0xFF, 0xFF}, 65535, t)
	testUint([]byte{0xFF, 0xFF, 0xFF}, 16777215, t)
	testUint([]byte{0xFF, 0xFF, 0xFF, 0xFF}, math.MaxUint32, t)
	testUint([]byte{0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}, math.MaxUint64, t)
}

func TestReadUintIncorrectLength(t *testing.T) {
	_, err := readUint([]byte{})
	if err == nil {
		t.Error("readuint failed to identify incorrect input")
	}

	_, err = readUint([]byte{0, 0, 0, 0, 0, 0, 0, 0, 0})
	if err == nil {
		t.Error("readuint failed to identify incorrect input")
	}
}

func TestPutUintIncorrectLength(t *testing.T) {
	var b = [8]byte{}
	expectUintToFail(b[:1], 256, t)
	expectUintToFail(b[:2], 65536, t)
	expectUintToFail(b[:3], 16777216, t)
	expectUintToFail(b[:4], 4294967296, t)
}

func TestReadPutInt(t *testing.T) {
	testInt([]byte{0xFF}, -1, t)
	testInt([]byte{0xFF, 0xFF}, -1, t)
	testInt([]byte{0xFF, 0xFF, 0xFF}, -1, t)
	testInt([]byte{0xFF, 0xFF, 0xFF, 0xFF}, -1, t)
	testInt([]byte{0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}, -1, t)

	testInt([]byte{0x7F}, 127, t)
	testInt([]byte{0x7F, 0xFF}, 32767, t)
	testInt([]byte{0x7F, 0xFF, 0xFF}, 8388607, t)
	testInt([]byte{0x7F, 0xFF, 0xFF, 0xFF}, 2147483647, t)
	testInt([]byte{0x7F, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}, math.MaxInt64, t)

	testInt([]byte{0x80}, -128, t)
	testInt([]byte{0x80, 0x00}, -32768, t)
	testInt([]byte{0x80, 0x00, 0x00}, -8388608, t)
	testInt([]byte{0x80, 0x00, 0x00, 0x00}, -2147483648, t)
	testInt([]byte{0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00}, math.MinInt64, t)
}

func TestReadIntIncorrectLength(t *testing.T) {
	_, err := readUint([]byte{})
	if err == nil {
		t.Error("readInt failed to identify incorrect input")
	}

	_, err = readUint([]byte{0, 0, 0, 0, 0, 0, 0, 0, 0})
	if err == nil {
		t.Error("readInt failed to identify incorrect input")
	}
}

func TestPutIntIncorrectLength(t *testing.T) {
	var b = [8]byte{}
	expectIntToFail(b[:1], 128, t)
	expectIntToFail(b[:2], 32768, t)
	expectIntToFail(b[:3], 8388608, t)
	expectIntToFail(b[:4], 2147483648, t)
	expectIntToFail(b[:1], -129, t)
	expectIntToFail(b[:2], -32769, t)
	expectIntToFail(b[:3], -8388609, t)
	expectIntToFail(b[:4], -2147483649, t)
}

/*
decode test
*/

type TestEnumType struct {
	val   uint64
	state string
}

func (t *TestEnumType) String() string {
	return t.state
}

func (t *TestEnumType) Number() uint64 {
	return t.val
}

func (t *TestEnumType) Known() bool {
	return t.val == 1
}

func TestDecode(t *testing.T) {
	intF := &IntSpec{FieldBase{"TEST_STATE", 3}, "kPa"}
	b := []byte{0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0}
	val, iss, err := decodeField(intF, b)

	i, ok := val.(Int)
	if !ok || i != 0x123456 || iss != nil || err != nil {
		t.Error("IntSpec failed to parse")
	}

	uintF := &UintSpec{FieldBase{"TEST_STATE", 3}, "kPa"}
	val, iss, err = decodeField(uintF, b)

	u, ok := val.(Uint)
	if !ok || u != 0x123456 || iss != nil || err != nil {
		t.Error("IntSpec failed to parse")
	}

	enumMap := map[uint64]string{1: "state_1"}
	enumF := &EnumSpec{
		FieldBase{"TEST_STATE", 1},
		&EnumTable{"test_state", enumMap, func(u uint64) Enum { return &TestEnumType{u, enumMap[u]} }},
	}

	val, iss, err = decodeField(enumF, b)
	if iss == nil || err != nil {
		t.Error("decodeField failed to identify unknown enum")
	}

	b[0] = 1
	val, iss, err = decodeField(enumF, b)
	if iss != nil {
		t.Errorf("EnumSpec failed to parse. Issue found: %s", iss.Reason)
	}

	// errs on unknown spec
	unknownF := &BitfieldSpec{FieldBase{"TEST_STATE", 1}, []BitSpec{}}
	val, iss, err = decodeField(unknownF, b)
	if err == nil {
		t.Errorf("decodeField failed to identify unknown spec")
	}
}
