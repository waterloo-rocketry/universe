import { app, BrowserWindow, session } from 'electron';
import { join } from 'node:path';
import { APP_NAME } from '../shared';

// Only the development runner supplies this URL. Packaged apps always load files.
const devServerUrl = !app.isPackaged
  ? process.env.VITE_DEV_SERVER_URL
  : undefined;

async function createWindow() {
  const window = new BrowserWindow({
    title: APP_NAME,
    width: 1100,
    height: 750,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-attach-webview', (event) =>
    event.preventDefault(),
  );

  if (devServerUrl) {
    await window.loadURL(devServerUrl);
  } else {
    await window.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function handleStartupError(error: unknown) {
  console.error('Unable to start Launch App:', error);
  app.exit(1);
}

app
  .whenReady()
  .then(async () => {
    session.defaultSession.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    await createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createWindow().catch(handleStartupError);
      }
    });
  })
  .catch(handleStartupError);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
