type QueueTask<T> = {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function humanDelay(): Promise<void> {
  // Base delay with jitter to mimic natural browsing rhythm.
  // Occasionally adds a longer pause like a user pausing to read.
  const base = 1200 + Math.random() * 1300;
  const readPause = Math.random() < 0.15 ? 1000 + Math.random() * 2000 : 0;
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
