import { createServer, type ServerResponse } from 'node:http';
import type { DataFrame } from '../shared/data-source';
import {
  createMockDataSource,
  type MockSourceOptions,
} from '../renderer/data/mock/source';

/** Local, one-way JSON stream. All clients observe the same mock timeline. */
export function createMockServer(options: MockSourceOptions = {}) {
  const source = createMockDataSource({ startTimeMs: Date.now(), ...options });
  const clients = new Set<ServerResponse>();
  let latest: DataFrame | undefined;
  let unsubscribe: (() => void) | undefined;

  function send(response: ServerResponse, event: string, data: unknown) {
    if (!response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) {
      // Disconnect slow clients instead of retaining unbounded queued samples.
      response.destroy();
      clients.delete(response);
    }
  }

  const server = createServer((request, response) => {
    if (request.method !== 'GET') {
      response.writeHead(405, { Allow: 'GET' }).end();
      return;
    }
    const path = request.url?.split('?')[0];
    if (path === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({ service: 'launch-app-mock', status: 'ok' }),
      );
    } else if (path === '/events') {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      response.flushHeaders();
      response.write('retry: 1000\n\n');
      clients.add(response);
      response.on('close', () => clients.delete(response));
      send(response, 'signals', source.signals);
      if (latest) send(response, 'frame', latest);
    } else {
      response.writeHead(404).end();
    }
  });

  server.on('listening', () => {
    unsubscribe = source.subscribe((frame) => {
      latest = frame;
      for (const client of clients) send(client, 'frame', frame);
    });
  });

  function stopStream() {
    unsubscribe?.();
    unsubscribe = undefined;
    for (const client of clients) client.end();
    clients.clear();
  }
  server.on('close', stopStream);

  return {
    server,
    close(): Promise<void> {
      stopStream();
      return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
    },
  };
}
