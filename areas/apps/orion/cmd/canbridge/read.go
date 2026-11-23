package main

const maxLine = 64

type Frame struct {
	SID  uint32
	Data []byte
}

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

func (f *LineFramer) Feed(chunk []byte) [][]byte {
	var lines [][]byte

	for _, b := range chunk {
		if b == '\n' {
			if f.discardLine {
				f.discardLine = false
				f.buffer = nil
				continue
			}

			line := append([]byte{}, f.buffer...)
			lines = append(lines, line)
			f.buffer = nil
			continue
		}


	}

	return lines
}