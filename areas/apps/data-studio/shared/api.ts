// Keep this wire contract in sync with backend/internal/dataset and protocol.
export interface Sample {
  time: number;
  value: number;
}
export interface Series {
  sourceId: string;
  channelId: string;
  unit: string;
  timeBasis: string;
  samples: Sample[];
}
export interface Dataset {
  name: string;
  provenance: string;
  warnings: string[];
  series: Series[];
}
export interface DataStudioAPI {
  loadSample(): Promise<Dataset>;
}
export const SAMPLE_CHANNEL = 'dataset:sample';
