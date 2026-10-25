import { createServer } from 'node:http';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { WorkerConfig } from './config.js';
import type { JudgeRepository } from './data/judge-repository.js';
import type { JudgeBackend } from './judging/judge-backend.js';
import type { Submission } from './types.js';
import { SubmissionQueue } from './submissions/submission-queue.js';
import { SubmissionService } from './submissions/submission-service.js';

export class WorkerApp {
  private readonly startedAt = Date.now();
  private readonly queue: SubmissionQueue;
  private stopping = false;
  private started = false;
  private lastPollAt = 0;
  private lastHeartbeatAt = 0;
  private lastPollDurationMs = 0;
  private lastPollError: string | null = null;
  private realtimeStatus = 'CONNECTING';
  private fatalError: Error | null = null;

  constructor(private readonly config: WorkerConfig, private readonly repository: JudgeRepository, private readonly judge: JudgeBackend) {
    const service = new SubmissionService(repository, judge);
    this.queue = new SubmissionQueue((submission) => service.process(submission));
  }

  stop(): void {
    this.stopping = true;
    this.queue.stop();
  }

  async start(): Promise<void> {
    if (this.started) throw new Error('WorkerApp can only be started once');
    this.started = true;
    console.log('🚀 Judge Worker Daemon started (realtime + polling).');
    const health = createServer((req, res) => {
      if (req.url !== '/health') { res.writeHead(404).end(); return; }
      const ready = !this.stopping && this.judge.isReady()
        && Date.now() - this.lastPollAt < Math.max(15000, this.config.pollIntervalMs * 3);
      res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ready, stopping: this.stopping, mode: this.judge.mode, realtime: this.realtimeStatus,
        queued: this.queue.queuedCount, processing: this.queue.activeIds.size, lastPollAt: this.lastPollAt || null,
        startedAt: this.startedAt, lastPollDurationMs: this.lastPollDurationMs, lastPollError: this.lastPollError }));
    });
    let channel: RealtimeChannel | undefined;
    let initialized = false;
    let operationFailed = false;
    try {
      await this.preflightCheck();
      // Khởi động engine mode nếu cấu hình; không fallback khi engine hỏng.
      await this.judge.initialize();
      initialized = true;
      await new Promise<void>((resolve, reject) => {
        health.once('error', reject);
        health.listen(this.config.healthPort, this.config.healthBind, () => {
          health.removeListener('error', reject);
          resolve();
        });
      });
      await this.repository.recoverStale(this.queue.activeIds);
      channel = this.repository.subscribe((submission) => this.enqueue(submission), (status) => {
        this.realtimeStatus = status;
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Worker] Realtime CHANNEL_ERROR — chưa nối được máy chủ (xem lỗi poll bên dưới). Worker sẽ tự thử lại.');
        } else {
          console.log(`[Worker] Realtime channel status: ${status}`);
        }
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await this.poll();
      if (this.fatalError) throw this.fatalError;
    } catch (err) {
      operationFailed = true;
      throw err;
    } finally {
      this.stop();
      console.log('[Worker] Draining active submission before shutdown.');
      try {
        await this.queue.waitForIdle();
      } finally {
        const cleanup = await Promise.allSettled([
          initialized ? this.repository.heartbeat(this.config.workerId, this.judge.mode, false, 0, 0) : Promise.resolve(),
          channel ? this.repository.unsubscribe(channel) : Promise.resolve(),
          this.judge.close(),
          new Promise<void>((resolve) => health.close(() => resolve())),
        ]);
        // Attempt every cleanup even when a dependency is unavailable.
        for (const result of cleanup) {
          if (result.status === 'rejected') console.error('[Worker] Shutdown cleanup failed:', result.reason);
        }
        const failed = cleanup.find((result) => result.status === 'rejected');
        if (!operationFailed && failed?.status === 'rejected') throw failed.reason;
      }
    }
  }

  private enqueue(submission: Submission): void {
    void this.queue.enqueue(submission).catch((err) => {
      this.fatalError = err instanceof Error ? err : new Error(String(err));
      this.stop();
    });
  }

  private async poll(): Promise<void> {
    let lastHint = '';
    let failStreak = 0;
    while (!this.stopping) {
      const pollStarted = performance.now();
      let pending: Submission[];
      try {
        pending = await this.repository.getPending();
      } catch (err) {
        failStreak++;
        const hint = classifyNetworkError(err);
        this.lastPollDurationMs = Math.round(performance.now() - pollStarted);
        this.lastPollError = hint;
        if (hint !== lastHint || failStreak === 1 || failStreak % 15 === 0) {
          console.error(`[Worker] Lỗi lấy bài PENDING (lần #${failStreak}): ${hint}`);
          if (failStreak === 5) {
            const url = this.config.supabaseUrl.replace(/\/+$/, '');
            console.error(`[Worker] Gợi ý: chạy "curl -I --max-time 8 ${url}/rest/v1/" để kiểm tra kết nối.`);
          }
        }
        lastHint = hint;
        await new Promise((resolve) => setTimeout(resolve, this.config.pollIntervalMs));
        continue;
      }
      if (failStreak > 0) console.log('[Worker] Kết nối Supabase đã hồi phục ✅');
      failStreak = 0;
      lastHint = '';
      this.lastPollAt = Date.now();
      this.lastPollDurationMs = Math.round(performance.now() - pollStarted);
      this.lastPollError = null;
      for (const submission of pending) this.enqueue(submission);
      try {
        if (Date.now() - this.lastHeartbeatAt >= 10000) {
          await this.repository.recoverStale(this.queue.activeIds);
          try {
            await this.repository.heartbeat(this.config.workerId, this.judge.mode,
              !this.stopping && this.judge.isReady(), this.queue.queuedCount, this.queue.activeIds.size);
            this.lastHeartbeatAt = Date.now();
          } catch (err) { console.error('[Worker]', err); }
        }
      } catch (err) { console.error('[Worker] Loop error:', classifyNetworkError(err)); }
      await new Promise((resolve) => setTimeout(resolve, this.config.pollIntervalMs));
    }
  }

  private async preflightCheck(): Promise<void> {
    const url = this.config.supabaseUrl.replace(/\/+$/, '');
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
      console.warn(`⚠️ SUPABASE_URL có dạng bất thường: "${url}" — chuẩn là https://<project-ref>.supabase.co`);
    }
    try {
      const res = await fetch(`${url}/rest/v1/`, {
        headers: { apikey: this.config.serviceRoleKey }, signal: AbortSignal.timeout(8000),
      });
      if (res.status === 401) {
        console.error('❌ Supabase từ chối key (HTTP 401) — SUPABASE_SERVICE_ROLE_KEY sai hoặc đang dán nhầm anon key.');
      } else {
        console.log(`✅ Đã kết nối Supabase REST (HTTP ${res.status}).`);
      }
    } catch (err) {
      console.error(`❌ KHÔNG KẾT NỐI ĐƯỢC Supabase (${url})`);
      console.error(`   Nguyên nhân: ${classifyNetworkError(err)}`);
      console.error('   Kiểm tra thủ công: curl -I --max-time 8 <SUPABASE_URL>/rest/v1/');
    }
  }
}

function classifyNetworkError(err: unknown): string {
  const e = err as { message?: string; code?: string; cause?: { code?: string; message?: string } };
  const code = e?.code || e?.cause?.code || '';
  const msg = `${e?.message || ''} ${e?.cause?.message || ''}`;
  if (code === 'ENOTFOUND' || /ENOTFOUND|getaddrinfo/i.test(msg)) {
    return 'DNS thất bại — hostname không tồn tại. Kiểm tra SUPABASE_URL trong .env (đừng để placeholder "your-project.supabase.co") và kết nối mạng.';
  }
  if (code === 'ECONNREFUSED') {
    return 'Kết nối bị từ chối — firewall/proxy chặn cổng 443?';
  }
  if (code === 'ECONNRESET' || code === 'EPIPE') {
    return 'Kết nối bị reset giữa chừng — mạng không ổn định hoặc proxy chặn HTTPS.';
  }
  if (code === 'ETIMEDOUT' || /timed?\s*out|abort/i.test(msg)) {
    return 'Hết thời gian chờ phản hồi — mạng chậm hoặc bị chặn.';
  }
  if (/certificate|TLS|SSL/i.test(msg + code)) {
    return 'Lỗi chứng chỉ TLS — thường do VPN/proxy/captive portal can thiệp.';
  }
  return msg.trim() || 'Lỗi mạng không rõ nguyên nhân';
}

