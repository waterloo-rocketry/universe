// Package component is the shared source runtime: every source (CAN, DAQ,
// RLCS, fake, replay) is a small driver on it. It holds the driver
// interfaces, the batch builder, the health reporter and counter names, the
// catalog builder, the command executor, containment, and the lifecycle
// every role shares (exit codes, SIGTERM order, readiness).
package component
