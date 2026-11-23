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

func (f *LineFramer) AddError() {
	f.errorCount++
}

func (f *LineFramer) Feed(chunk []byte) [][]byte {
	var lines [][]byte

	for _, b := range chunk {
		if b == '\n' {
			if len(f.buffer) <= maxLine {
				line := append([]byte{}, f.buffer...)
				lines = append(lines, line)
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