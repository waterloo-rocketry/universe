import { contextBridge, ipcRenderer } from 'electron';
import type { DataStudioAPI } from '../shared/api';
// Sandboxed preloads cannot require local modules; keep this channel literal
// aligned with shared/api.ts. Type-only imports are erased by TypeScript.
const api: DataStudioAPI = {
  loadSample: () => ipcRenderer.invoke('dataset:sample'),
};
contextBridge.exposeInMainWorld('dataStudio', api);
