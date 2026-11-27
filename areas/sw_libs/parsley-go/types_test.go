package parsley

import (
	"errors"
	"testing"
)

type TestEnum struct {
	number uint64
	name   string
}

func (e *TestEnum) Number() uint64 {
	return e.number
}

func (e *TestEnum) String() string {
	return e.name
}

func (e *TestEnum) Known() bool {
	return true
}

func GetError(errorType string) error {
	switch errorType {
	case "no error":
		return nil
	case "FrameError":
		return &FrameError{67, "Test Frame Error"}
	case "DecodeError":
		return &DecodeError{
			SID:       67,
			Prio:      &TestEnum{1, "high"},
			MsgType:   &TestEnum{1, "test message"},
			BoardType: &TestEnum{1, "test type"},
			BoardInst: &TestEnum{1, "test board"},
			Metadata:  0,
			Reason:    "Test Decode Error",
		}
	case "IncompleteError":
		return &DecodeError{}
	default:
		return errors.New("Unknown Error Type")
	}
}

// test can format frame error correctly
func TestFrameError(t *testing.T) {
	frameError := GetError("FrameError")
	if frameError.Error() != "Frame Error: Test Frame Error (Error Code: 67)" {
		t.Errorf("Incorrect error formatting. Found: %s", frameError.Error())
	}
}

// test can format decode error correctly
func TestDecodeError(t *testing.T) {
	decodeError := GetError("DecodeError")
	if decodeError.Error() != "Decode Error for message type test message. Priority: high. Reason: Test Decode Error" {
		t.Errorf("Incorrect error formatting. Found: %s", decodeError.Error())
	}
}

// test our format still works even on partial error body
func TestDecodeErrorOnIncompleteBody(t *testing.T) {
	DecodeError := GetError("IncompleteError")
	_ = DecodeError.Error()
}

func TestTypeString(t *testing.T) {
	i := Int(67)
	if i.String() != "Int 67" {
		t.Error("Int.String() failed to format value")
	}

	te := Text("test")
	if te.String() != "test" {
		t.Error("Text.String() failed to format value")
	}
}
