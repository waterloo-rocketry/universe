// Package delivery is the sender that connects a source to the Orion Server:
// Hello, Register, the telemetry and health streams, and reconnecting when
// the connection drops. DAQ also gets acknowledged delivery: acks, backfill of
// anything not yet acknowledged, and resuming its session after a reconnect.
// CAN has none of these: after a reconnect it sends live data only, and what
// it read while disconnected is counted as lost.
package delivery
