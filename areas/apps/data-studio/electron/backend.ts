import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { Dataset } from '../shared/api';

interface Pending {
  resolve: (value: Dataset) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}
export class Backend {
  private child: ChildProcessWithoutNullStreams;
  private pending = new Map<number, Pending>();
  private nextId = 0;
  private failure?: Error;

  constructor(binary: string) {
    this.child = spawn(binary, [], { stdio: 'pipe', windowsHide: true });
    const lines = createInterface({ input: this.child.stdout });
    this.child.stderr.on('data', (chunk: Buffer) =>
      console.error('[Go]', chunk.toString()),
    );
    this.child.on('error', (error) => this.fail(error));
    this.child.on('exit', (code, signal) =>
      this.fail(new Error(`Go backend exited (${signal ?? code})`)),
    );
    lines.on('line', (line) => {
      try {
        const reply = JSON.parse(line) as {
          id: number;
          result?: Dataset;
          error?: string;
        };
        const request = this.pending.get(reply.id);
        if (!request) return;
        clearTimeout(request.timer);
        this.pending.delete(reply.id);
        if (reply.error) request.reject(new Error(reply.error));
        else if (reply.result) request.resolve(reply.result);
        else request.reject(new Error('Invalid backend response'));
      } catch {
        this.fail(new Error('Invalid JSON from Go backend'));
        this.child.kill();
      }
    });
  }

  loadSample(): Promise<Dataset> {
    if (this.failure) return Promise.reject(this.failure);
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Go backend timed out'));
      }, 10000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(
        JSON.stringify({ id, method: 'dataset.sample' }) + '\n',
        (error) => {
          if (error) this.fail(error);
        },
      );
    });
  }

  private fail(error: Error): void {
    this.failure = error;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
  }

  close(): void {
    this.fail(new Error('Application is closing'));
    this.child.stdin.end();
    const timer = setTimeout(() => this.child.kill(), 1000);
    timer.unref();
  }
}
