import type { Submission } from '../types.js';

export class SubmissionQueue {
  private readonly pending: Submission[] = [];
  private readonly processing = new Set<string>();
  private running: Promise<void> | null = null;
  private stopped = false;
  private failure: unknown = null;
  private signal: (() => void) | null = null;

  constructor(private readonly processSubmission: (submission: Submission) => Promise<void>, private readonly concurrency = 1) {}

  get activeIds(): ReadonlySet<string> { return this.processing; }
  get queuedCount(): number { return this.pending.length; }

  enqueue(submission: Submission): Promise<void> {
    if (this.stopped || submission.status !== 'PENDING' || this.processing.has(submission.id)) return Promise.resolve();
    if (!this.pending.some((item) => item.id === submission.id)) this.pending.push(submission);
    // Wake the drain loop so a free slot is used without waiting for the running job.
    this.signal?.();
    this.signal = null;
    if (!this.running) this.running = this.drain().finally(() => { this.running = null; });
    return this.running;
  }

  stop(): void {
    this.stopped = true;
    this.pending.length = 0;
  }

  async waitForIdle(): Promise<void> {
    await this.running;
  }

  private async drain(): Promise<void> {
    const inflight = new Set<Promise<void>>();
    for (;;) {
      while (!this.stopped && this.pending.length > 0 && inflight.size < this.concurrency) {
        const submission = this.pending.shift()!;
        this.processing.add(submission.id);
        let task: Promise<void>;
        task = this.processSubmission(submission)
          .catch((err) => { this.failure ??= err; this.stopped = true; })
          .finally(() => { this.processing.delete(submission.id); inflight.delete(task); });
        inflight.add(task);
      }
      if (inflight.size === 0) break;
      await Promise.race([...inflight, this.workArrived()]);
    }
    if (this.failure) throw this.failure;
  }

  /** Resolves as soon as new work is enqueued while the drain loop waits. */
  private workArrived(): Promise<void> {
    return new Promise<void>((resolve) => { this.signal = resolve; });
  }
}
