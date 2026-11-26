import { build } from 'esbuild';

await build({
  entryPoints: ['src/mock-server/main.ts'],
  outfile: 'dist/mock/server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
await import(new URL('../dist/mock/server.mjs', import.meta.url));
