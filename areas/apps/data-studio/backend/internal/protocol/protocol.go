// Package protocol implements newline-delimited JSON over stdin/stdout.
package protocol

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"

	"github.com/waterloo-rocketry/universe/areas/apps/data-studio/backend/fixtures"
	"github.com/waterloo-rocketry/universe/areas/apps/data-studio/backend/internal/dataset"
	"github.com/waterloo-rocketry/universe/areas/apps/data-studio/backend/internal/readers"
)

type Request struct {
	ID     int64  `json:"id"`
	Method string `json:"method"`
}
type Response struct {
	ID     int64            `json:"id"`
	Result *dataset.Dataset `json:"result,omitempty"`
	Error  string           `json:"error,omitempty"`
}

func Serve(input io.Reader, output io.Writer) error {
	scanner := bufio.NewScanner(input)
	scanner.Buffer(make([]byte, 4096), 1024*1024)
	encoder := json.NewEncoder(output)
	for scanner.Scan() {
		var request Request
		response := Response{}
		if err := json.Unmarshal(scanner.Bytes(), &request); err != nil {
			response.Error = "invalid request JSON"
		} else {
			response.ID = request.ID
			if request.Method != "dataset.sample" {
				response.Error = "unknown method: " + request.Method
			} else {
				result, err := readers.ReadBytes(fixtures.Sample)
				if err != nil {
					response.Error = err.Error()
				} else {
					response.Result = &result
				}
			}
		}
		if err := encoder.Encode(response); err != nil {
			return fmt.Errorf("write response: %w", err)
		}
	}
	return scanner.Err()
}
