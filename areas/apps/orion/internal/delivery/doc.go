// Package delivery is the sender that connects a source to the Orion Server:
// Hello, Register, the telemetry and health streams, and reconnecting when
// the connection drops. DAQ and CAN also get acknowledged delivery: acks,
// backfill of anything not yet acknowledged, and resuming their session after
// a reconnect. Health isn't backfilled, and nothing the server sends to a
// source is ever re-sent.
package delivery
