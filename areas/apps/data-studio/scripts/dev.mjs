import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import electron from 'electron';
const server = await createServer();
await server.listen();
const desktopEnv = {
  ...process.env,
  DATA_STUDIO_DEV_URL: 'http://127.0.0.1:5173/',
};
// Embedded terminals may inherit this flag from an Electron host.
delete desktopEnv.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: desktopEnv,
});
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  child.kill();
  await server.close();
  process.exit(code);
}
child.on('exit', (code) => void stop(code ?? 1));
child.on('error', (error) => {
  console.error(error);
  void stop(1);
});
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
