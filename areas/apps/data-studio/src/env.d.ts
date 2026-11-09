import type { DataStudioAPI } from '../shared/api';
declare global {
  interface Window {
    dataStudio: DataStudioAPI;
  }
}
