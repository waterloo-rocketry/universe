import { useState } from 'react';
import { EMPTY_FILTER, filterChannels } from '../data/channel-filter';
import { useTelemetry } from '../data/useTelemetry';
import { ChannelFilters } from './ChannelFilters';
import { ChannelList } from './ChannelList';

interface TelemetryMonitorProps {
  /** Telemetry event stream URL. */
  url: string;
}

export function TelemetryMonitor({ url }: TelemetryMonitorProps) {
  const { state, nowMs } = useTelemetry({ url });
  const [filter, setFilter] = useState(EMPTY_FILTER);

  const content = () => {
    if (!state) return <p>Waiting for channels</p>;
    const channels = Object.values(state.channels);
    if (channels.length === 0) return <p>No channels configured</p>;
    return (
      <>
        <ChannelFilters filter={filter} onChange={setFilter} />
        <ChannelList
          channels={filterChannels(channels, filter, nowMs)}
          nowMs={nowMs}
          emptyMessage="No channels match the filters"
          onHide={(signalId) =>
            setFilter((current) => ({
              ...current,
              hidden: new Set(current.hidden).add(signalId),
            }))
          }
        />
      </>
    );
  };

  return (
    <section aria-label="Telemetry monitor">
      <h2>Telemetry monitor</h2>
      {content()}
    </section>
  );
}
