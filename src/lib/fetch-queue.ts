import {
  FETCH_BASE_DELAY_MS,
  FETCH_JITTER_MS,
  FETCH_READ_PAUSE_CHANCE,
  FETCH_READ_PAUSE_MIN_MS,
  FETCH_READ_PAUSE_JITTER_MS,
} from "./constants";

type QueueTask<T> = {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function humanDelay(): Promise<void> {
  const base = FETCH_BASE_DELAY_MS + Math.random() * FETCH_JITTER_MS;
  const readPause = Math.random() < FETCH_READ_PAUSE_CHANCE ? FETCH_READ_PAUSE_MIN_MS + Math.random() * FETCH_READ_PAUSE_JITTER_MS : 0;
  return new Promise((resolve) => setTimeout(resolve, base + readPause));
}

export class FetchQueue {
  private tasks: QueueTask<unknown>[] = [];
  private draining = false;
  private aborted = false;

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    if (this.aborted) return Promise.reject(new Error("Queue aborted"));

    return new Promise<T>((resolve, reject) => {
      this.tasks.push({
        execute: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.drain();
    });
  }

  private async drain() {
    if (this.draining) return;
    this.draining = true;

    while (this.tasks.length > 0 && !this.aborted) {
      const task = this.tasks.shift()!;
      try {
        const result = await task.execute();
        task.resolve(result);
      } catch (err) {
        task.reject(err);
      }

      if (this.tasks.length > 0 && !this.aborted) {
        await humanDelay();
      }
    }

    this.draining = false;
  }

  abort() {
    this.aborted = true;
    for (const task of this.tasks) {
      task.reject(new Error("Queue aborted"));
    }
    this.tasks = [];
  }

  get pending() {
    return this.tasks.length;
  }

  get isAborted() {
    return this.aborted;
  }
}
