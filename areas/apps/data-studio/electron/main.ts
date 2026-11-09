import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Backend } from './backend';
import { SAMPLE_CHANNEL } from '../shared/api';

let backend: Backend | undefined;
const devURL = !app.isPackaged ? process.env.DATA_STUDIO_DEV_URL : undefined;
const indexPath = path.join(__dirname, '../renderer/index.html');
const rendererURL = devURL ?? pathToFileURL(indexPath).href;

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  void window.loadURL(rendererURL);
}

void app
  .whenReady()
  .then(() => {
    const binaryName =
      process.platform === 'win32'
        ? 'data-studio-backend.exe'
        : 'data-studio-backend';
    const binary = app.isPackaged
      ? path.join(process.resourcesPath, 'backend', binaryName)
      : path.join(app.getAppPath(), 'build/backend', binaryName);
    backend = new Backend(binary);
    ipcMain.handle(SAMPLE_CHANNEL, (event) => {
      if (
        event.senderFrame !== event.sender.mainFrame ||
        event.senderFrame.url !== rendererURL
      )
        throw new Error('Untrusted IPC sender');
      return backend!.loadSample();
    });
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((error: unknown) => {
    console.error(error);
    app.quit();
  });
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => backend?.close());
