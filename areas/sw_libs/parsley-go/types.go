package parsley

import "fmt"

// Any decoded value. The value's own Go type says what it is (like Python's
// plain int/str). Use a type switch.
type Value interface {
	String() string // what FormatLine and the CAN log print
}

type Int int64   // int fields
type Uint uint64 // uint fields
type Text string // ascii fields

func (i Int) String() string {
	return fmt.Sprintf("%d", i)
}

func (i Uint) String() string {
	return fmt.Sprintf("%d", i)
}

func (t Text) String() string {
	return string(t)
}

// Raw (#116), Bitfield (#115) and every generated enum type also implement Value.

// Every generated enum type (ActuatorState, BoardType, ...) implements Enum,
// so generic code can handle any enum without knowing which one.
type Enum interface {
	Value
	Number() uint64 // the raw number, kept even when it has no name
	Known() bool    // false if the number isn't in the yaml (prints as "0x05")
}

// since YAML specifies the MsgPrio, BoardType, and BoardInst explicitly, it would be better
// if we leave them as general Enum types here and use the parsed definition from YAML
// MsgType is also implictly defined in the YAML.
type MsgPrio Enum
type BoardType Enum
type BoardInst Enum
type MsgType Enum

// One decoded frame. The header is everything in the SID, like Python's
// ParsleyObject (msg_prio, board_type_id, board_inst_id, msg_metadata).
type Message struct {
	Prio      MsgPrio   // ENUM
	BoardType BoardType // ENUM
	BoardInst BoardInst // ENUM
	Metadata  Value     // the message's metadata enum (e.g. ActuatorID), or Int when it's UNUSED
	TimeMs    uint16    // raw board counter; the bridge unwraps it
	Payload   Payload   // *SensorAnalog16, *ActuatorStatus, ... (generated)
	Issues    []Issue   // problems that didn't stop the decode
}

func (m Message) MsgType() MsgType     { return m.Payload.MsgType() } // the payload's type is the message type
func (m Message) TimeSeconds() float64 { return float64(m.TimeMs) / 1000.0 }

// Every generated message struct implements this.
type Payload interface {
	MsgType() MsgType
	Fields() []Field // in yaml order, TIMESTAMP not included
}

type Field struct {
	Name  string
	Value Value
}

type Issue struct{ Field, Reason string } // e.g. {"BOARD_TYPE", "unknown board_type 0x1F"}

// Fatal problems.
type FrameErrorKind uint8

const (
	ErrSyntax FrameErrorKind = iota + 1
	ErrHeader
	ErrLength
	ErrCRC
)

// the line/frame itself is broken
type FrameError struct {
	Kind   FrameErrorKind
	Reason string
}

// like Python's ParsleyError
type DecodeError struct {
	SID       uint32
	Data      []byte
	Prio      MsgPrio
	MsgType   MsgType // prints 0x.. if unknown
	BoardType BoardType
	BoardInst BoardInst
	Metadata  uint8 // the raw metadata byte
	Reason    string
}

func (e *FrameError) Error() string {
	return fmt.Sprintf("Frame Error: %s (Error Code: %d)", e.Reason, e.Kind)
}

// decode error may result in partial body with some fields being nil. We need to check that
func (e *DecodeError) Error() string {
	msgType := "Unknown Type"
	msgPrio := "Unknown Prio"
	if e.MsgType != nil {
		msgType = e.MsgType.String()
	}
	if e.Prio != nil {
		msgPrio = e.Prio.String()
	}
	return fmt.Sprintf("Decode Error for message type %s. Priority: %s. Reason: %s", msgType, msgPrio, e.Reason)
}

// The spec tables the generator fills in (#121). One spec type per yaml field
// type, each holding only what that kind needs, so nothing is ever left empty.
type FieldSpec interface{ base() *FieldBase }

type FieldBase struct {
	Name  string // yaml name, e.g. "ACTUATOR_CMD_STATE"
	Bytes int    // yaml bytes:
}

func (f *FieldBase) base() *FieldBase { return f }

type UintSpec struct {
	FieldBase
	Unit string
}
type IntSpec struct {
	FieldBase
	Unit string
}
type EnumSpec struct {
	FieldBase
	Enum *EnumTable
}
type BitfieldSpec struct {
	FieldBase
	Bits []BitSpec
}
type ASCIISpec struct{ FieldBase }
type RawSpec struct{ FieldBase }

// One yaml enum: its names, and how to make its typed Go value.
type EnumTable struct {
	Name       string              // "actuator_state"
	Names      map[uint64]string   // 0x00 → "ON", 0x01 → "OFF", ...
	FromNumber func(n uint64) Enum // makes the typed value: ActuatorState(n)
}

type BitSpec struct {
	Name string
	Bit  uint8
} // one named bit of a bitfield

type MessageSpec struct {
	Name       string
	Type       MsgType
	Metadata   *EnumTable                   // which enum the SID's metadata byte uses; nil when UNUSED (decodes as Int)
	Fields     []FieldSpec                  // yaml order, TIMESTAMP first
	FromFields func(fields []Field) Payload // builds this message's object from its decoded fields
}
