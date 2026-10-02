/** Launch App's provisional component-facing contract, not a backend protocol. */
export type SignalValue = number | boolean | string;
export type ReadingQuality = 'good' | 'missing' | 'invalid';

export interface SignalDefinition {
  id: string;
  label: string;
  kind: 'number' | 'boolean' | 'string';
  /** Explicit engineering unit; empty for dimensionless or categorical signals. */
  unit: string;
}

export type SignalReading = {
  signalId: string;
  /** Unix epoch milliseconds at measurement time, not frame delivery time. */
  timestampMs: number;
} & (
  | { quality: 'good'; value: SignalValue }
  | { quality: 'missing' | 'invalid'; value: null }
);

export interface DataFrame {
  schemaVersion: 1;
  sourceId: string;
  sequence: number;
  /** Unix epoch milliseconds for this frame. */
  timestampMs: number;
  connection: 'connected' | 'disconnected';
  readings: SignalReading[];
}

/** Consumers receive plain objects and own their display/history/state logic. */
export interface DataSource {
  readonly signals: readonly SignalDefinition[];
  /** Subscribe explicitly; unsubscribe releases that subscription's resources. */
  subscribe(listener: (frame: DataFrame) => void): () => void;
}

/** Validate network JSON before declaring a working data connection. */
export function isDataFrame(value: unknown): value is DataFrame {
  if (typeof value !== 'object' || value === null) return false;
  const frame = value as Record<string, unknown>;
  if (
    frame.schemaVersion !== 1 ||
    typeof frame.sourceId !== 'string' ||
    frame.sourceId.length === 0 ||
    !Number.isSafeInteger(frame.sequence) ||
    (frame.sequence as number) < 0 ||
    !Number.isSafeInteger(frame.timestampMs) ||
    (frame.connection !== 'connected' && frame.connection !== 'disconnected') ||
    !Array.isArray(frame.readings)
  )
    return false;
  return frame.readings.every((item: unknown) => {
    if (typeof item !== 'object' || item === null) return false;
    const reading = item as Record<string, unknown>;
    if (
      typeof reading.signalId !== 'string' ||
      reading.signalId.length === 0 ||
      !Number.isSafeInteger(reading.timestampMs)
    )
      return false;
    if (reading.quality === 'missing' || reading.quality === 'invalid')
      return reading.value === null;
    return (
      reading.quality === 'good' &&
      (typeof reading.value === 'boolean' ||
        typeof reading.value === 'string' ||
        (typeof reading.value === 'number' && Number.isFinite(reading.value)))
    );
  });
}
