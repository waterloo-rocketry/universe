import { useState } from 'react';
import type { Dataset } from '../shared/api';
export function App() {
  const [dataset, setDataset] = useState<Dataset>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function loadSample() {
    setLoading(true);
    setError('');
    try {
      setDataset(await window.dataStudio.loadSample());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }
  return (
    <main>
      <p className="eyebrow">WATERLOO ROCKETRY</p>
      <h1>Data Studio</h1>
      <p>
        Explore recorded telemetry. Start with the synthetic sample to check
        your setup.
      </p>
      <button disabled={loading} onClick={() => void loadSample()}>
        {loading ? 'Loading…' : 'Load sample dataset'}
      </button>
      {error && <p role="alert">{error}</p>}
      {dataset && (
        <section>
          <h2>{dataset.name}</h2>
          <p>{dataset.provenance}</p>
          {dataset.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          {dataset.series.map((series) => (
            <article key={`${series.sourceId}/${series.channelId}`}>
              <h3>
                {series.sourceId} / {series.channelId}
              </h3>
              <p>
                {series.samples.length} samples · {series.unit} ·{' '}
                {series.timeBasis}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Time (s)</th>
                    <th>Value ({series.unit})</th>
                  </tr>
                </thead>
                <tbody>
                  {series.samples.map((sample, index) => (
                    <tr key={index}>
                      <td>{sample.time}</td>
                      <td>{sample.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
