import { useTelemetry } from '../data/useTelemetry';
import { TelemetryContext } from '../data/telemetry-context';
import { DashboardGrid } from './DashboardGrid';
import { FilteredChannelList } from './FilteredChannelList';
import { DEFAULT_LAYOUT, type dashboardLayout } from '../Layout';

interface TelemetryMonitorProps {
  /** Telemetry event stream URL. */
  url: string;
  /**
   * Dashboard layout to show. Pass the same object on every render: a
   * different object makes the grid start over from it.
   */
  layout?: dashboardLayout;
}

export function TelemetryMonitor({
  url,
  layout = DEFAULT_LAYOUT,
}: TelemetryMonitorProps) {
  // One stream for the whole monitor: the channel list reads it directly,
  // and grid widgets read it through the context below.
  const telemetry = useTelemetry({ url });
  const { state, nowMs } = telemetry;

  const content = () => {
    if (!state) return <p>Waiting for channels</p>;
    const channels = Object.values(state.channels);
    if (channels.length === 0) return <p>No channels configured</p>;
    return (
      <>
        <FilteredChannelList channels={channels} nowMs={nowMs} />
        <DashboardGrid layout={layout} />
      </>
    );
  };

  return (
    <TelemetryContext.Provider value={telemetry}>
      <section aria-label="Telemetry monitor">
        <h2>Telemetry monitor</h2>
        {content()}
      </section>
    </TelemetryContext.Provider>
  );
}
