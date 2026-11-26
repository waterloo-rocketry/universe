package main

const maxLine = 64

type Frame struct {
	SID  uint32
	Data []byte
}

// LineFramer joins chunks into newline-delimited lines
type LineFramer struct {
	buffer       []byte
	errorCount   uint64
	discardLine  bool
}

func NewLineFramer() *LineFramer {
	return &LineFramer{}
}

func (f *LineFramer) Reset() {
	f.buffer = nil
	f.errorCount = 0
	f.discardLine = false
}

func (f *LineFramer) ErrorCount() uint64 {
	return f.errorCount
}

func (f *LineFramer) AddError() {
	f.errorCount++
}

// Feed adds a chunk and returns complete lines.
func (f *LineFramer) Feed(chunk []byte) [][]byte {
	var lines [][]byte

	for _, b := range chunk {
		if b == '\n' {
			// Emit valid lines, drop oversized lines
			if len(f.buffer) <= maxLine {
				line := append([]byte{}, f.buffer...)
				lines = append(lines, line)
				// TODO: The USB read-loop caller should parse each returned line
				// once Parsley-go is available:
				// sid, data, parseErr := parsley.SplitUSBDebug(string(line))
				// if parseErr != nil {
				//     // Report or skip this malformed protocol line.
				// } else {
				//     frame := Frame{SID: sid, Data: data}
				//     // Pass frame to downstream processing.
				// }
			} else {
				if !f.discardLine {
					f.AddError()
				}
			}

			f.buffer = nil
			f.discardLine = false
			continue
		} else {
			if len(f.buffer) < maxLine {
				f.buffer = append(f.buffer, b)
			} else {
				// Record only first error in oversized line
				if !f.discardLine {
					f.discardLine = true
					f.buffer = append(f.buffer, b)
					f.AddError()
				}
			}
		}
	}

	return lines
}