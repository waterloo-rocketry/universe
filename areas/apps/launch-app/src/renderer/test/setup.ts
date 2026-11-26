import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { TestEventSource } from './event-source';

beforeEach(() => {
  TestEventSource.instances = [];
  vi.stubGlobal('EventSource', TestEventSource);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
