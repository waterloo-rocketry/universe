import { useEffect, useState } from 'react';
import { isDataFrame } from '../../shared/data-source';

export function MockConnectionStatus() {
  const [status, setStatus] = useState('connecting to mock');

  useEffect(() => {
    const stream = new EventSource('/mock-api/events');
    const onFrame = (event: MessageEvent<string>) => {
      try {
        const frame: unknown = JSON.parse(event.data);
        setStatus(
          isDataFrame(frame) && frame.sourceId === 'mock-sensors'
            ? 'connected to mock'
            : 'invalid mock data',
        );
      } catch {
        setStatus('invalid mock data');
      }
    };
    // EventSource retries automatically, including when the server starts later.
    stream.addEventListener('frame', onFrame);
    stream.onerror = () => setStatus('disconnected from mock');
    return () => {
      stream.removeEventListener('frame', onFrame);
      stream.close();
    };
  }, []);

  return <p role="status">{status}</p>;
}
