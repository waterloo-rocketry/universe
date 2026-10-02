import { vi } from 'vitest';

export class TestEventSource extends EventTarget {
  static instances: TestEventSource[] = [];
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(public url: string) {
    super();
    TestEventSource.instances.push(this);
  }

  frame(data: unknown) {
    this.dispatchEvent(
      new MessageEvent('frame', { data: JSON.stringify(data) }),
    );
  }
}
