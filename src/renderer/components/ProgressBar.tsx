import {
  getChannelStatus,
  getLatestReading,
  type ChannelState,
} from '../data/channel-store';

interface ProgressBarProps {
  channel: ChannelState; // Which sensor?
  min: number;
  max: number;
  nowMs: number; // Current time
}

const LAST_UPDATED_AFTER_MS = 3_000; // Starting showing a timer if there hasn't been an update in 3s. Might be changed later.

/** Works out how full the bar is and whether the value is outside min–max. */
function getFill(value: number, min: number, max: number) {
  let zone: 'below' | 'in' | 'above' = 'in';
  if (value < min) {
    zone = 'below';
  } else if (value > max) {
    zone = 'above';
  }

  const percent = ((value - min) / (max - min)) * 100;

  return {
    percent: Math.max(0, Math.min(100, percent)),
    zone,
  };
}

/** Draws the progress bar */
export function ProgressBar({ channel, min, max, nowMs }: ProgressBarProps) {
  const { label, unit, kind } = channel.signal;
  const status = getChannelStatus(channel, nowMs);
  const latest = getLatestReading(channel);

  // A true/false or text channel can't be drawn as a bar.
  if (kind !== 'number') {
    return (
      <div className="progress-bar progress-bar--error">
        <div className="progress-bar__header">
          <span className="progress-bar__label">{label}</span>
          <span className="progress-bar__value">not a numeric channel</span>
        </div>
      </div>
    );
  }

  // Check before displaying nonsense data
  if (min >= max) {
    return (
      <div className="progress-bar progress-bar--error">
        <div className="progress-bar__header">
          <span className="progress-bar__label">{label}</span>
          <span className="progress-bar__value">invalid range</span>
        </div>
      </div>
    );
  }

  // Only draw good numbers
  let value: number | null = null;
  if (latest && latest.quality === 'good' && typeof latest.value === 'number') {
    value = latest.value;
  }

  // Don't fill if there's no value
  const fill = value === null ? null : getFill(value, min, max);

  // The text on the right of the header, e.g. "42 kPa · stale".
  let valueText: string;
  if (value === null || fill === null) {
    valueText = status.replace('-', ' '); // Clean status: "no-data" -> "no data"
  } else {
    const rounded = Math.round(value * 1000) / 1000; // Rounding 3 decimals - can be changed
    valueText = unit ? `${rounded} ${unit}` : String(rounded);
    if (fill.zone === 'above') valueText += ' ▲ above range';
    if (fill.zone === 'below') valueText += ' ▼ below range';
    if (status === 'stale' || status === 'disconnected') {
      valueText += ` · ${status}`;
    }
  }

  // Show timer if there hasn't been an update in 3s
  const ageMs = latest ? nowMs - latest.timestampMs : 0;
  const lastUpdated =
    ageMs > LAST_UPDATED_AFTER_MS
      ? `updated ${(ageMs / 1000).toFixed(1)} s ago`
      : null;

  return (
    <div className={`progress-bar progress-bar--${status}`}>
      <div className="progress-bar__header">
        <span className="progress-bar__label">{label}</span>
        <span className="progress-bar__value">{valueText}</span>
      </div>
      <div className="progress-bar__track">
        {fill && (
          <div
            className={`progress-bar__fill progress-bar__fill--${fill.zone}`}
            style={{ width: `${fill.percent}%` }}
          />
        )}
      </div>
      <div className="progress-bar__scale">
        <span>{min}</span>
        {lastUpdated && (
          <span className="progress-bar__updated">{lastUpdated}</span>
        )}
        <span>{max}</span>
      </div>
    </div>
  );
}
