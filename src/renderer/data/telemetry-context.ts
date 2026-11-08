import { createContext, useContext } from 'react';
import {
  getChannelStatus,
  getLatestReading,
  type ChannelState,
  type ChannelStatus,
} from './channel-store';
import type { SignalReading } from '../../shared/data-source';
import type { Telemetry } from './useTelemetry';

// Shared telemetry for every widget
// null outside a TelemetryProvider
export const TelemetryContext = createContext<Telemetry | null>(null);

// Everything a widget needs to display one channel
export interface ChannelData {
  channel: ChannelState;

  // newest reading/undefined before any reading
  latest: SignalReading | undefined;

  // recent readings, oldest first
  history: readonly SignalReading[];
  status: ChannelStatus;
}

// Binds widget to one telemetry channel. Returns null until the signal catalogue arrives or if channel does not exist
export function useChannel(signalId: string): ChannelData | null {
  const telemetry = useContext(TelemetryContext);
  if (!telemetry) {
    throw new Error('useChannel must be used inside a TelemetryProvider');
  }
  const channel = telemetry.state?.channels[signalId];
  if (!channel) return null;
  return {
    channel,
    latest: getLatestReading(channel),
    history: channel.history,
    status: getChannelStatus(channel, telemetry.nowMs),
  };
}
