import type {
  DataFrame,
  SignalDefinition,
  SignalReading,
} from '../../shared/data-source';

export type ChannelStatus =
  'no-data' | 'active' | 'stale' | 'missing' | 'invalid' | 'disconnected';

export interface ChannelState {
  signal: SignalDefinition;
  /** Source that last sent a reading for this channel; null until one arrives. */
  sourceId: string | null;
  sourceConnected: boolean;
  /** Recent readings, oldest first, capped at the store's history size. */
  history: readonly SignalReading[];
}

export interface TelemetryState {
  historySize: number;
  /** Keyed by signal ID; insertion order follows the signal catalogue. */
  channels: Readonly<Record<string, ChannelState>>;
}

export const DEFAULT_HISTORY_SIZE = 100;
export const DEFAULT_STALE_AFTER_MS = 2_000;

export function createTelemetryState(
  signals: readonly SignalDefinition[],
  historySize = DEFAULT_HISTORY_SIZE,
): TelemetryState {
  if (!Number.isSafeInteger(historySize) || historySize < 1) {
    throw new RangeError('historySize must be a positive integer');
  }
  const channels: Record<string, ChannelState> = {};
  for (const signal of signals) {
    channels[signal.id] = {
      signal,
      sourceId: null,
      sourceConnected: false,
      history: [],
    };
  }
  return { historySize, channels };
}

/**
 * Replaces the signal catalogue (e.g. after a reconnect), keeping the history
 * of channels that still exist and dropping channels that no longer do.
 */
export function updateSignals(
  state: TelemetryState,
  signals: readonly SignalDefinition[],
): TelemetryState {
  const next = createTelemetryState(signals, state.historySize);
  const channels = { ...next.channels };
  for (const signal of signals) {
    const previous = state.channels[signal.id];
    if (previous) channels[signal.id] = { ...previous, signal };
  }
  return { ...next, channels };
}

/** For when the stream itself drops, so no source can report its own state. */
export function disconnectAll(state: TelemetryState): TelemetryState {
  const channels = { ...state.channels };
  for (const [id, channel] of Object.entries(channels)) {
    if (channel.sourceConnected)
      channels[id] = { ...channel, sourceConnected: false };
  }
  return { ...state, channels };
}

/**
 * Returns a new state with the frame applied; unchanged channels keep their
 * object identity so React consumers can skip re-rendering them.
 */
export function applyFrame(
  state: TelemetryState,
  frame: DataFrame,
): TelemetryState {
  const channels = { ...state.channels };
  const connected = frame.connection === 'connected';

  for (const [id, channel] of Object.entries(channels)) {
    if (
      channel.sourceId === frame.sourceId &&
      channel.sourceConnected !== connected
    )
      channels[id] = { ...channel, sourceConnected: connected };
  }

  for (const reading of frame.readings) {
    const channel = channels[reading.signalId];
    // Readings for signals outside the catalogue have no label/unit to show.
    if (!channel) continue;
    const latest = channel.history.at(-1);
    // Stale sources repeat their last reading; out-of-order ones would break graphs.
    if (latest && reading.timestampMs <= latest.timestampMs) continue;
    channels[reading.signalId] = {
      ...channel,
      sourceId: frame.sourceId,
      sourceConnected: connected,
      history: [...channel.history, reading].slice(-state.historySize),
    };
  }

  return { ...state, channels };
}

export function getLatestReading(
  channel: ChannelState,
): SignalReading | undefined {
  return channel.history.at(-1);
}

export function getChannelStatus(
  channel: ChannelState,
  nowMs: number,
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
): ChannelStatus {
  const latest = getLatestReading(channel);
  if (!latest) return 'no-data';
  if (!channel.sourceConnected) return 'disconnected';
  if (latest.quality !== 'good') return latest.quality;
  return nowMs - latest.timestampMs > staleAfterMs ? 'stale' : 'active';
}

/** Readings newer than `sinceMs`. Ordered by oldest first.
 * For if you are making like a graph that requires past readings up to n ms ago. Remeber it's ms when using
 */
export function getRecentReadings(
  channel: ChannelState,
  sinceMs: number,
): readonly SignalReading[] {
  return channel.history.filter((r) => r.timestampMs >= sinceMs);
}
