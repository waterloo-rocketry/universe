import { useEffect, useState } from 'react';
import { isDataFrame, isSignalDefinitionList } from '../../shared/data-source';
import {
  applyFrame,
  createTelemetryState,
  DEFAULT_HISTORY_SIZE,
  disconnectAll,
  updateSignals,
  type TelemetryState,
} from './channel-store';

/** Health of the event stream itself, separate from any source's connection. */
export type StreamStatus =
  'connecting' | 'connected' | 'disconnected' | 'invalid';

export interface TelemetryOptions {
  /** Event stream to read; the caller decides between the mock and a real backend. */
  url: string;
  /** Read once when the stream opens; change `url` or remount to apply a new size. */
  historySize?: number;
  /** How often `nowMs` advances so channels turn stale even when frames stop. */
  clockIntervalMs?: number;
}

export interface Telemetry {
  stream: StreamStatus;
  /** Null until the signal catalogue arrives. */
  state: TelemetryState | null;
  /** Pass to `getChannelStatus` to judge staleness. */
  nowMs: number;
}

export function useTelemetry({
  url,
  historySize = DEFAULT_HISTORY_SIZE,
  clockIntervalMs = 500,
}: TelemetryOptions): Telemetry {
  const [stream, setStream] = useState<StreamStatus>('connecting');
  const [state, setState] = useState<TelemetryState | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), clockIntervalMs);
    return () => clearInterval(timer);
  }, [clockIntervalMs]);

  useEffect(() => {
    const events = new EventSource(url);

    const parse = (event: MessageEvent<string>): unknown => {
      try {
        return JSON.parse(event.data);
      } catch {
        return undefined;
      }
    };

    // The server resends the catalogue on every (re)connect.
    const onSignals = (event: MessageEvent<string>) => {
      const signals = parse(event);
      if (!isSignalDefinitionList(signals)) {
        setStream('invalid');
        return;
      }
      setState((previous) =>
        previous
          ? updateSignals(previous, signals)
          : createTelemetryState(signals, historySize),
      );
    };

    const onFrame = (event: MessageEvent<string>) => {
      const frame = parse(event);
      if (!isDataFrame(frame)) {
        setStream('invalid');
        return;
      }
      setStream('connected');
      // Frames before the catalogue have no channels to land in.
      setState((previous) => previous && applyFrame(previous, frame));
      setNowMs(Date.now());
    };

    events.addEventListener('signals', onSignals);
    events.addEventListener('frame', onFrame);
    // EventSource retries automatically; keep history and show it as disconnected.
    events.onerror = () => {
      setStream('disconnected');
      setState((previous) => previous && disconnectAll(previous));
    };
    return () => {
      events.removeEventListener('signals', onSignals);
      events.removeEventListener('frame', onFrame);
      events.close();
    };
    // historySize is deliberately read only when the stream opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return { stream, state, nowMs };
}
