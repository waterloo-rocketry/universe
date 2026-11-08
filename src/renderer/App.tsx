import { APP_NAME } from '../shared';
import { Header } from './components/Header';
import { MockConnectionStatus } from './components/MockConnectionStatus';
import { TelemetryMonitor } from './components/TelemetryMonitor';
import { ChannelReadout } from './components/ChannelReadout';
import { TelemetryProvider } from './data/TelemetryProvider';

// Vite proxies this to the standalone mock server during development.
const MOCK_TELEMETRY_URL = '/mock-api/events';

export default function App() {
  return (
    <div className="app-shell">
      <Header title={APP_NAME} />
      <main>
        {import.meta.env.DEV && <MockConnectionStatus />}
        {/* Development only until a production telemetry backend exists. */}
        {import.meta.env.DEV && <TelemetryMonitor url={MOCK_TELEMETRY_URL} />}

        {/* Demo for issue #28: a widget bound to one channel via useChannel. */}
        {import.meta.env.DEV && (
          <TelemetryProvider url={MOCK_TELEMETRY_URL}>
            <ChannelReadout signalId="test.pressure" />
          </TelemetryProvider>
        )}

        <section aria-label="Dashboard">
          <p>Dashboard coming soon</p>
        </section>
      </main>
    </div>
  );
}
