// canbridge runs one CAN bridge on its own and prints what it decodes. It's
// for bench testing before the Orion server exists.
//
//	go run ./cmd/canbridge --port /tmp/mock-usb-debug --format usb
package main

import (
	"flag"
	"fmt"
	"os"
)

func main() {
	port := flag.String("port", "auto", `where the board is: "auto", a path like /dev/ttyACM0, usb:VID:PID:serial, mock:<path> or file:<log>`)
	format := flag.String("format", "usb", `what the bytes look like: "usb" or "telemetry"`)
	jsonOut := flag.Bool("json", false, "print one JSON object per frame instead of text")
	flag.Parse()

	fmt.Fprintf(os.Stderr, "canbridge: not wired up yet (port=%s format=%s json=%v)\n", *port, *format, *jsonOut)
	os.Exit(1)
}
