package parsley

import (
	"fmt"
)

func readUint(b []byte) (uint64, error) {
	if len(b) > 8 || len(b) < 1 {
		return 0, fmt.Errorf("bytes too long: only support 1-8, got %d", len(b))
	}

	var read uint64 = 0
	// assuming big endian. That is, the first byte is the largest
	for i := 0; i < len(b); i++ {
		read <<= 8
		read |= uint64(b[i])
	}
	return read, nil
}

func putUint(b []byte, v uint64) error {
	// 1<<(len(b)*8) is one over the maximum num can be expressed by byte
	// to prevent overflow we first check if length is 8. If length is 8 then no needs for further checking
	if len(b) != 8 && v >= 1<<(len(b)*8) {
		return fmt.Errorf("%d is too large for the provided %d-bytes array.", v, len(b))
	}
	length := len(b)
	for i := 0; i < length; i++ {
		b[i] = byte(v >> ((length - i - 1) * 8))
	}
	return nil
}

func readInt(b []byte) (int64, error) {
	unsigned, err := readUint(b)
	gap := (8 - len(b)) * 8
	// arithematic right shift helps us sign extend the result
	return (int64(unsigned) << gap) >> gap, err
}

func putInt(b []byte, v int64) error {
	if len(b) != 8 && (v >= 1<<(len(b)*8-1) || v < -(1<<(len(b)*8-1))) {
		return fmt.Errorf("%d is too large for the provided %d-bytes array.", v, len(b))
	}
	length := len(b)
	for i := 0; i < length; i++ {
		b[i] = byte(v >> ((length - i - 1) * 8))
	}
	return nil
}

func decodeField(f FieldSpec, b []byte) (Value, *Issue, error) {
	switch t := f.(type) {
	case *UintSpec:
		val, err := readUint(b[:t.Bytes])
		return UInt(val), nil, err
	case *IntSpec:
		val, err := readInt(b[:t.Bytes])
		return Int(val), nil, err
	case *EnumSpec:
		val, err := readUint(b[:t.Bytes])
		enum := t.Enum.FromNumber(val)

		if !enum.Known() {
			return enum, &Issue{t.base().Name, fmt.Sprintf("unknown %s %X", t.Enum.Name, val)}, err
		}
		return enum, nil, err
	default:
		return nil, nil, fmt.Errorf("unknown type") // a spec type this switch doesn't handle
	}
}
