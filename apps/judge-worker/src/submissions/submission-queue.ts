import type { Submission } from '../types.js';

export class SubmissionQueue {
  private readonly pending: Submission[] = [];
  private readonly processing = new Set<string>();
  private running: Promise<void> | null = null;
  private stopped = false;

  constructor(private readonly processSubmission: (submission: Submission) => Promise<void>) {}

  get activeIds(): ReadonlySet<string> { return this.processing; }
  get queuedCount(): number { return this.pending.length; }

  enqueue(submission: Submission): Promise<void> {
    if (this.stopped || submission.status !== 'PENDING' || this.processing.has(submission.id)) return Promise.resolve();
    if (!this.pending.some((item) => item.id === submission.id)) this.pending.push(submission);
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
    while (!this.stopped && this.pending.length > 0) {
      const submission = this.pending.shift()!;
      this.processing.add(submission.id);
      try {
        await this.processSubmission(submission);
      } finally {
        this.processing.delete(submission.id);
      }
    }
  }
}
