import { useState } from 'react';
import { EMPTY_FILTER, filterChannels } from '../data/channel-filter';
import { useTelemetry } from '../data/useTelemetry';
import { ChannelFilters } from './ChannelFilters';
import { ChannelList } from './ChannelList';
import { ProgressBar } from './ProgressBar';
import { Gauge } from './Gauge';

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
    // Temporary demo for issue #33: only the mock server has these channels.
    const pressure = state.channels['test.pressure'];
    const temperature = state.channels['test.temperature'];
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
        <div className="progress-bar-demo">
          {pressure && (
            <ProgressBar channel={pressure} min={0} max={100} nowMs={nowMs} />
          )}
          {pressure && (
            <ProgressBar channel={pressure} min={30} max={45} nowMs={nowMs} />
          )}
          {temperature && (
            <ProgressBar channel={temperature} min={0} max={40} nowMs={nowMs} />
          )}
        </div>
        <div className="gauge-demo">
          {pressure && (
            <div>
              <Gauge channel={pressure} min={0} max={100} nowMs={nowMs} />
              <Gauge
                channel={pressure}
                min={40}
                max={45}
                major_intervals={3}
                minor_intervals={6}
                nowMs={nowMs}
              />
            </div>
          )}
        </div>
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
