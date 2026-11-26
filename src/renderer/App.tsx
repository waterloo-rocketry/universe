import { APP_NAME } from '../shared';
import { Header } from './components/Header';
import { MockConnectionStatus } from './components/MockConnectionStatus';
import { TelemetryMonitor } from './components/TelemetryMonitor';
import BaseComponent from './components/BaseComponent';
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
            <BaseComponent
              id={'pressure1'}
              componentType="progress-bar"
              channels={['test.pressure']}
              config={{ min: 0, max: 100 }}
              updateConfig={() => {}}
              setOverlay={() => {}}
            />
            <BaseComponent
              id={'pressure2'}
              componentType="progress-bar"
              channels={['test.pressure']}
              config={{ min: 30, max: 45 }}
              updateConfig={() => {}}
              setOverlay={() => {}}
            />
            <BaseComponent
              id={'temperature1'}
              componentType="progress-bar"
              channels={['test.temperature']}
              config={{ min: 0, max: 40 }}
              updateConfig={() => {}}
              setOverlay={() => {}}
            />
            <BaseComponent
              id={'pressure-gauge'}
              componentType="gauge"
              channels={['test.pressure']}
              config={{
                min: 40,
                max: 45,
                major_interval: 6,
                minor_interval: 3,
              }}
              updateConfig={() => {}}
              setOverlay={() => {}}
            />
            <BaseComponent
              id={'pressure-numeric'}
              componentType="numeric"
              channels={['test.temperature']}
              updateConfig={() => {}}
              setOverlay={() => {}}
            />
          </TelemetryProvider>
        )}

        <section aria-label="Dashboard">
          <p>Dashboard coming soon</p>
        </section>
      </main>
    </div>
  );
}
