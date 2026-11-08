import { useChannel } from '../data/telemetry-context';

interface ChannelReadoutProps {
  /** Channel to display, e.g. "test.pressure". */
  signalId: string;
}

/** Shows one channel's latest value, or its status when the value can't be trusted. */
export function ChannelReadout({ signalId }: ChannelReadoutProps) {
  // get the channel's data
  const data = useChannel(signalId);

  // if there's no data, show "unavailable"
  if (!data) {
    return <p className="channel-readout">{signalId}: unavailable</p>;
  }

  // unpack the pieces you need
  const { channel, latest, status } = data;
  const { label, unit } = channel.signal;

  let valueText = status.replace('-', ' ');
  if (latest && latest.quality === 'good') {
    valueText = unit ? `${latest.value} ${unit}` : String(latest.value);
    if (status !== 'active') valueText += ` (${status})`;
  }

  return (
    <p className={`channel-readout channel-readout--${status}`}>
      <strong>{label}:</strong> {valueText}
    </p>
  );
}
