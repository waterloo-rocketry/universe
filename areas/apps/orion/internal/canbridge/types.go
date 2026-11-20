// Package canbridge is the part of Orion that talks to CAN hardware. One
// bridge per connection: it reads bytes, decodes them with Parsley-go, names
// them as Orion channels, and writes commands back out.
package canbridge

import (
	"context"
	"time"
)

// Value is one decoded value. It becomes parsley.Value once Parsley-go's
// shared types land.
type Value = any

// Link is where the bridge reads bytes from and writes bytes to: a serial
// port, a mock's port or a replay file. It knows nothing about CAN.
type Link interface {
	Read(ctx context.Context, buf []byte) (int, error)
	Write(ctx context.Context, b []byte) error // must give up by ctx's deadline
	Close() error
}

// NamedSample is one decoded reading, already named.
type NamedSample struct {
	DeviceID  string // "injector-rocket", "ox-injector-valve"
	ChannelID string // "pt-channel-1", "state"
	Value     Value
	// ReceivedAt is when the laptop got the frame (unix seconds). Everything
	// live uses this time.
	ReceivedAt float64
	BoardMs    uint16 // the board's raw clock, untouched. Analysis only, it wraps every 65.5 s
	FrameSeq   uint64 // counts every frame that splits OK; used to confirm commands
}

// RawFrame is a frame exactly as received, for the CAN log view.
type RawFrame struct {
	FrameSeq    uint64
	ReceivedAt  float64
	SID         uint32
	Data        []byte
	DecodedText string // FormatLine, or "" if it didn't decode
}

// LinkState says whether the hardware connection itself is open.
type LinkState string

const (
	LinkUp         LinkState = "UP"
	LinkDown       LinkState = "DOWN"
	LinkConnecting LinkState = "CONNECTING"
)

// Health is reported about once a second.
type Health struct {
	LinkState  LinkState
	Detail     string  // "USB up", "port COM4 not found"
	LastRxUnix float64 // last frame of any kind from the hardware
	QueueAgeMs uint32
	LogOK      bool
	Counters   map[string]uint64
}

// ChannelDef is a channel the bridge found, for the catalog.
type ChannelDef struct {
	DeviceID, ChannelID string
	Type                string // NUMBER, ENUM, TEXT
	Unit                string // "counts" for CAN numbers until scaling exists
	EnumValues          []string
	StaleAfterMs        uint32
}

// Sink is where the bridge puts everything it makes. The console sink prints
// it, the converter hands it to Orion core, and tests record it.
type Sink interface {
	Frame(raw RawFrame, samples []NamedSample, droppedBefore uint32) error
	Catalog(newChannels []ChannelDef) error
	Health(h Health) error
}

// SendRequest is what core asks the bridge to write. Exactly one of Command,
// RawMsg or RawBytes is set.
type SendRequest struct {
	RequestID string
	Deadline  time.Time // set by core from the command's remaining time
	Command   *GenericCommand
	RawMsg    *RawMessageForm
	RawBytes  *RawBytes
}

// GenericCommand is a catalog command, e.g. set-state ON on ox-injector-valve.
type GenericCommand struct {
	Target    string
	Operation string
	Params    map[string]Value
	SafeState bool // closing to its safe state: jumps the queue
}

// RawMessageForm is a message from the CAN sender, encoded by the bridge.
type RawMessageForm struct {
	MsgType  string
	Metadata Value
	Fields   map[string]Value
	// "" means the source's default (tx_board, tx_prio)
	BoardType, BoardInst, Prio string
}

// RawBytes is an exact frame, for sending odd frames on purpose.
type RawBytes struct {
	SID  uint32
	Data []byte
}

// SendState is how a send ended.
type SendState string

const (
	Written SendState = "WRITTEN" // the bytes went out
	Failed  SendState = "FAILED"  // refused, nothing written
	Expired SendState = "EXPIRED" // deadline passed, nothing written
	Unknown SendState = "UNKNOWN" // the write broke partway, bytes may be out
)

// SendResult is what goes back to core.
type SendResult struct {
	RequestID string
	State     SendState
	Reason    string
	// SeqAtWrite is the frame counter right after the write. Only frames after
	// it can confirm the command.
	SeqAtWrite uint64
	// SettleAfterSeq is the first frame at least confirm_settle_ms after the
	// write (0 means not yet).
	SettleAfterSeq uint64
}
