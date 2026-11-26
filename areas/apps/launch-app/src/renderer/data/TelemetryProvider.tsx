import type { ReactNode } from 'react';
import { TelemetryContext } from './telemetry-context';
import { useTelemetry } from './useTelemetry';

interface TelemetryProviderProps {
  // telemetry event stream url
  url: string;
  children: ReactNode;
}

// Opens one telemetry stream & shares it with every widget inside
export function TelemetryProvider({ url, children }: TelemetryProviderProps) {
  const telemetry = useTelemetry({ url });
  return (
    <TelemetryContext.Provider value={telemetry}>
      {children}
    </TelemetryContext.Provider>
  );
}
