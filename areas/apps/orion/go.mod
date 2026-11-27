module github.com/waterloo-rocketry/universe/areas/apps/orion

go 1.27.0

toolchain go1.27.4

require (
	connectrpc.com/connect v1.21.1
	github.com/BurntSushi/toml v1.6.0
	github.com/waterloo-rocketry/universe/areas/apis/orion v0.0.0
)

require google.golang.org/protobuf v1.36.12 // indirect

replace github.com/waterloo-rocketry/universe/areas/apis/orion => ../../apis/orion
