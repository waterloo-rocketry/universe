package main

import (
	"fmt"
	"github.com/waterloo-rocketry/universe/areas/apps/data-studio/backend/internal/protocol"
	"os"
)

func main() {
	if err := protocol.Serve(os.Stdin, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
