import { useChannel } from '../data/telemetry-context';
import BaseComponent from './BaseComponent';

interface ChannelReadoutProps {
  /** Channel to display, e.g. "test.pressure". */
  signalId: string;
}

/** Shows one channel's latest value inside the shared widget container. */
export function ChannelReadout({ signalId }: ChannelReadoutProps) {
  // get the channel's data
  const data = useChannel(signalId);
  const latest = data?.latest;
  const unit = data?.channel.signal.unit;

  return (
    <BaseComponent
      id={signalId}
      componentType="numeric"
      channel={data?.channel}
      currentTime={data?.nowMs ?? 0}
    >
      {latest?.quality === 'good' && (
        <p>{unit ? `${latest.value} ${unit}` : String(latest.value)}</p>
      )}
    </BaseComponent>
  );
}
