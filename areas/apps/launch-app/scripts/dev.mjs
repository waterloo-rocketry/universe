import { spawn } from 'node:child_process';
import electron from 'electron';
import { createServer } from 'vite';
import { buildElectron } from './electron-build.mjs';

let server;
let child;
let stopping = false;

async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  if (child && child.exitCode === null) child.kill();
  await server?.close();
  process.exitCode = code;
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

try {
  await buildElectron();
  server = await createServer();
  await server.listen();
  server.printUrls();
  const url = server.resolvedUrls.local[0];
  const env = { ...process.env, VITE_DEV_SERVER_URL: url };
  delete env.ELECTRON_RUN_AS_NODE;
  child = spawn(electron, ['.', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env,
  });
  child.on('error', (error) => {
    console.error(error);
    void shutdown(1);
  });
  child.on('exit', (code) => void shutdown(code ?? 0));
} catch (error) {
  console.error(error);
  await shutdown(1);
}
