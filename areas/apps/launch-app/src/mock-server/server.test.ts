// @vitest-environment node
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createMockServer } from './server';
import { isDataFrame } from '../shared/data-source';

let mock: ReturnType<typeof createMockServer> | undefined;
afterEach(async () => {
  await mock?.close();
  mock = undefined;
});

async function start() {
  mock = createMockServer({ seed: 42, intervalMs: 20, startTimeMs: 1_000_000 });
  mock.server.listen(0, '127.0.0.1');
  await once(mock.server, 'listening');
  return `http://127.0.0.1:${(mock.server.address() as AddressInfo).port}`;
}

describe('standalone mock server', () => {
  it('serves health checks and rejects unsupported endpoints and methods', async () => {
    const base = await start();
    expect(await (await fetch(`${base}/health`)).json()).toEqual({
      service: 'launch-app-mock',
      status: 'ok',
    });
    expect((await fetch(`${base}/unknown`)).status).toBe(404);
    expect((await fetch(`${base}/events`, { method: 'POST' })).status).toBe(
      405,
    );
  });

  it('streams signal definitions and valid advancing JSON frames over HTTP', async () => {
    const base = await start();
    const response = await fetch(`${base}/events`, {
      signal: AbortSignal.timeout(3000),
    });
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    const reader = response.body!.getReader();
    let body = '';
    const decoder = new TextDecoder();
    while ((body.match(/event: frame/g) ?? []).length < 3) {
      const { value, done } = await reader.read();
      if (done) throw new Error('Stream ended before frames arrived');
      body += decoder.decode(value, { stream: true });
    }
    await reader.cancel();
    expect(body).toContain('event: signals');
    const frames = body
      .split('\n\n')
      .filter((block) => block.startsWith('event: frame'))
      .map((block) => JSON.parse(block.split('data: ')[1]) as unknown);
    expect(frames.every(isDataFrame)).toBe(true);
    const valid = frames.filter(isDataFrame);
    expect(valid.at(-1)!.sequence).toBeGreaterThan(valid[0].sequence);
    expect(valid.at(-1)!.timestampMs).toBeGreaterThan(valid[0].timestampMs);
  });

  it('shuts down with an active stream', async () => {
    const base = await start();
    const response = await fetch(`${base}/events`);
    const reader = response.body!.getReader();
    await reader.read();
    await mock!.close();
    expect(mock!.server.listening).toBe(false);
    mock = undefined;
    await reader.cancel();
  });
});
