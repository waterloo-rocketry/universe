package canbridge

const maxLine = 64

type Frame struct {
	SID  uint32
	Data []byte
}