import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const command = process.argv[2];
const exe = process.platform === 'win32' ? '.exe' : '';
mkdirSync(new URL('../build/backend/', import.meta.url), { recursive: true });
const actions = {
  build: [
    'build',
    '-trimpath',
    '-ldflags=-s -w',
    '-o',
    `${root}build/backend/data-studio-backend${exe}`,
    './cmd/data-studio',
  ],
  test: ['test', './...'],
  vet: ['vet', './...'],
  format: ['fmt', './...'],
  'format:check': ['fmt', './...'],
};
if (!actions[command]) throw new Error(`Unknown Go action: ${command}`);
// gofmt -l is read-only; go fmt would rewrite files during a check.
const checking = command === 'format:check';
const result = spawnSync(
  checking ? 'gofmt' : 'go',
  checking ? ['-l', '.'] : actions[command],
  {
    cwd: new URL('../backend/', import.meta.url),
    encoding: 'utf8',
    env: { ...process.env, CGO_ENABLED: '0' },
  },
);
if (result.error) {
  console.error(
    'Install Go 1.27.3 and put go/gofmt on PATH.',
    result.error.message,
  );
  process.exit(1);
}
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
process.exit(result.status || (checking && result.stdout.trim() ? 1 : 0));
