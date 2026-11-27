// Package mockfault runs the fault schedule on a mock: source: it wraps a
// driver and applies each [[source.mock_fault]] (kind, at_s, for_s) at its
// time, in the same vocabulary for every source.
package mockfault
