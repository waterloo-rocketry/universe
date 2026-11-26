// Package delivery is the sender that connects a source to the Orion Server:
// Hello, Register, the telemetry and health streams, acknowledgements,
// backfill after a reconnect, and the reconnect itself. Acks are a
// per-source switch.
package delivery
