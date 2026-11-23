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