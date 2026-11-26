package main

// Demo only: the example-* commands show how the generated Orion API code is
// used, with a server, a client for a unary call and a client for a
// bidirectional stream. They're removed once the real Orion API lands.

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"connectrpc.com/connect"
	examplev1 "github.com/waterloo-rocketry/universe/areas/apis/orion/gen/go/orion/example/v1"
	"github.com/waterloo-rocketry/universe/areas/apis/orion/gen/go/orion/example/v1/examplev1connect"
)

// ================================= Shared ==================================

// exampleAddr is where the example server listens, and where the clients
// call it, unless --addr says otherwise.
const exampleAddr = "127.0.0.1:8080"

// ================================= Server ==================================

// answer is the server's logic: it decides the reply to every message, for
// both Send and Stream. "ping" gets "pong"; anything else gets the server's
// own reply, saying what it got and when.
func answer(message string) string {
	if message == "ping" {
		return "pong"
	}
	return fmt.Sprintf("server got %q at %s", message, time.Now().Format("15:04:05"))
}

// exampleServer implements the example ExampleService.
type exampleServer struct{}

// Send answers one message.
func (exampleServer) Send(_ context.Context, req *connect.Request[examplev1.SendRequest]) (*connect.Response[examplev1.SendResponse], error) {
	return connect.NewResponse(&examplev1.SendResponse{Reply: answer(req.Msg.GetMessage())}), nil
}

// Stream answers each message on the stream as it arrives, until the client
// closes its side.
func (exampleServer) Stream(_ context.Context, stream *connect.BidiStream[examplev1.StreamRequest, examplev1.StreamResponse]) error {
	for {
		req, err := stream.Receive()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
		if err := stream.Send(&examplev1.StreamResponse{Reply: answer(req.GetMessage())}); err != nil {
			return err
		}
	}
}

// serveExample serves the example ExampleService on listener until ctx is
// cancelled. It speaks HTTP/1.1, which the unary call uses, and HTTP/2
// without TLS (h2c), which the bidirectional stream needs.
func serveExample(ctx context.Context, listener net.Listener) error {
	// The generated constructor returns the URL path prefix the service is
	// served under (/orion.example.v1.ExampleService/) and the handler for it.
	path, handler := examplev1connect.NewExampleServiceHandler(exampleServer{})
	mux := http.NewServeMux()
	mux.Handle(path, handler)
	var protocols http.Protocols
	protocols.SetHTTP1(true)
	protocols.SetUnencryptedHTTP2(true)
	server := &http.Server{Handler: mux, Protocols: &protocols}
	stop := context.AfterFunc(ctx, func() { server.Close() })
	defer stop()
	if err := server.Serve(listener); !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// ================================= Client ==================================

// sendExample makes one Send call to the server at addr and returns its
// answer. A unary call needs only plain HTTP/1.1, so it uses Go's ordinary
// client.
func sendExample(ctx context.Context, addr, message string) (string, error) {
	client := examplev1connect.NewExampleServiceClient(http.DefaultClient, "http://"+addr)
	res, err := client.Send(ctx, connect.NewRequest(&examplev1.SendRequest{Message: message}))
	if err != nil {
		return "", err
	}
	return res.Msg.GetReply(), nil
}

// streamExample opens one Stream to the server at addr, sends each message
// and prints the server's answer to it before sending the next, then closes
// the stream. A bidirectional stream needs HTTP/2, so it uses a client that
// speaks HTTP/2 without TLS (h2c).
func streamExample(ctx context.Context, addr string, messages []string, out io.Writer) error {
	var protocols http.Protocols
	protocols.SetUnencryptedHTTP2(true)
	httpClient := &http.Client{Transport: &http.Transport{Protocols: &protocols}}
	client := examplev1connect.NewExampleServiceClient(httpClient, "http://"+addr)

	stream := client.Stream(ctx)
	for _, message := range messages {
		if err := stream.Send(&examplev1.StreamRequest{Message: message}); err != nil {
			return err
		}
		res, err := stream.Receive()
		if err != nil {
			return err
		}
		fmt.Fprintln(out, res.GetReply())
	}
	if err := stream.CloseRequest(); err != nil {
		return err
	}
	return stream.CloseResponse()
}

// ================================ Commands =================================

// runExampleServer is `orion example-server`: it serves until Ctrl-C or
// SIGTERM.
func runExampleServer(addr string, stdout, stderr io.Writer) int {
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		fmt.Fprintln(stderr, "orion example-server:", err)
		return exitRuntime
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	fmt.Fprintf(stdout, "serving the example service on http://%s (Ctrl-C to stop)\n", listener.Addr())
	if err := serveExample(ctx, listener); err != nil {
		fmt.Fprintln(stderr, "orion example-server:", err)
		return exitRuntime
	}
	fmt.Fprintln(stdout, "stopped")
	return exitOK
}

// runExample runs one of the example-* commands. An optional leading
// --addr <address> picks the server.
func runExample(cmd string, args []string, stdout, stderr io.Writer) int {
	addr := exampleAddr
	if len(args) >= 2 && args[0] == "--addr" {
		addr, args = args[1], args[2:]
	}

	ctx := context.Background()
	var err error
	switch {
	case cmd == "example-server" && len(args) == 0:
		return runExampleServer(addr, stdout, stderr)
	case cmd == "example-client" && len(args) == 1:
		var reply string
		if reply, err = sendExample(ctx, addr, args[0]); err == nil {
			fmt.Fprintln(stdout, reply)
		}
	case cmd == "example-stream-client" && len(args) > 0:
		err = streamExample(ctx, addr, args, stdout)
	default:
		fmt.Fprint(stderr, usage)
		return exitConfig
	}
	if err != nil {
		fmt.Fprintf(stderr, "orion %s: %v\n", cmd, err)
		return exitRuntime
	}
	return exitOK
}
