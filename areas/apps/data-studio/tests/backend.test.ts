import { afterEach, expect, test } from 'vitest';
import path from 'node:path';
import { Backend } from '../electron/backend';
const clients: Backend[] = [];
afterEach(() => {
  for (const client of clients.splice(0)) client.close();
});
test('TypeScript bridge exchanges correlated requests with the real Go process', async () => {
  const client = new Backend(
    path.resolve(
      'build/backend/data-studio-backend' +
        (process.platform === 'win32' ? '.exe' : ''),
    ),
  );
  clients.push(client);
  const datasets = await Promise.all([
    client.loadSample(),
    client.loadSample(),
  ]);
  for (const dataset of datasets) {
    expect(dataset.name).toBe('Synthetic pressure run');
    expect(dataset.series[0]?.samples).toEqual([
      { time: 0, value: 101.3 },
      { time: 0.5, value: 103.2 },
      { time: 1, value: 102.4 },
    ]);
    expect(dataset.series[0]?.unit).toBe('kPa');
    expect(dataset.warnings).toEqual([]);
  }
});
test('missing backend rejects requests instead of hanging', async () => {
  const client = new Backend(path.resolve('build/no-such-backend'));
  clients.push(client);
  await expect(client.loadSample()).rejects.toThrow();
});
