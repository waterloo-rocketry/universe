import type { SignalDefinition, SignalReading } from '../../shared/data-source';
import {
  getChannelStatus,
  getLatestReading,
  type ChannelState,
  type ChannelStatus,
} from '../data/channel-store';

const STATUS_LABELS: Record<ChannelStatus, string> = {
  'no-data': 'no data',
  active: 'active',
  stale: 'stale',
  missing: 'missing',
  invalid: 'invalid',
  disconnected: 'disconnected',
};

interface ChannelListProps {
  channels: readonly ChannelState[];
  nowMs: number;
  staleAfterMs?: number;
  emptyMessage?: string;
  /** Shows a hide button on each row when provided. */
  onHide?: (signalId: string) => void;
}

function formatValue(signal: SignalDefinition, reading?: SignalReading) {
  if (!reading || reading.quality !== 'good') return '—';
  const value = String(reading.value);
  return signal.unit ? `${value} ${signal.unit}` : value;
}

function formatAge(nowMs: number, reading?: SignalReading) {
  if (!reading) return '—';
  return `${(Math.max(0, nowMs - reading.timestampMs) / 1000).toFixed(1)} s ago`;
}

export function ChannelList({
  channels,
  nowMs,
  staleAfterMs,
  emptyMessage = 'No channels configured',
  onHide,
}: ChannelListProps) {
  if (channels.length === 0) return <p>{emptyMessage}</p>;

  return (
    <table className="channel-list">
      <thead>
        <tr>
          <th scope="col">Channel</th>
          <th scope="col">Status</th>
          <th scope="col">Latest value</th>
          <th scope="col">Updated</th>
          {onHide && <th scope="col" aria-label="Actions" />}
        </tr>
      </thead>
      <tbody>
        {channels.map((channel) => {
          const status = getChannelStatus(channel, nowMs, staleAfterMs);
          const latest = getLatestReading(channel);
          return (
            <tr key={channel.signal.id}>
              <th scope="row">{channel.signal.label}</th>
              <td>
                <span className={`channel-status channel-status--${status}`}>
                  {STATUS_LABELS[status]}
                </span>
              </td>
              <td>{formatValue(channel.signal, latest)}</td>
              <td>{formatAge(nowMs, latest)}</td>
              {onHide && (
                <td>
                  <button
                    type="button"
                    aria-label={`Hide ${channel.signal.label}`}
                    onClick={() => onHide(channel.signal.id)}
                  >
                    Hide
                  </button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
