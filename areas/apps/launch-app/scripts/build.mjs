import { rm } from 'node:fs/promises';
import { build } from 'vite';
import { buildElectron } from './electron-build.mjs';

await rm(new URL('../dist/', import.meta.url), {
  recursive: true,
  force: true,
});
await buildElectron();
await build();
