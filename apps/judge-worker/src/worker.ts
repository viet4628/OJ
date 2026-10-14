import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import WebSocket from 'ws';
import { Submission, Testcase, SubmissionStatus, TestcaseResult } from './types.js';
import { SandboxEngine } from './sandbox/rsjudge.js';
import { compareOutput } from './comparator.js';
import { RsjudgeEngineClient, LANG_TO_ENGINE, SubmitEvent } from './engine/rsjudge-client.js';
import { CasesProviderServer, ProviderProblem } from './engine/cases-provider.js';

if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = WebSocket;
}

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// rsjudge engine mode: khi đặt biến này, worker chỉ điều phối qua engine Rust
// (compile/run trong engine), còn tự phục vụ testcase qua cases-provider gRPC.
const RSJUDGE_ENDPOINT = process.env.RSJUDGE_ENDPOINT || '';
const RSJUDGE_PROVIDER_BIND = process.env.RSJUDGE_PROVIDER_BIND || '0.0.0.0:50052';

let engine: RsjudgeEngineClient | null = null;
let provider: CasesProviderServer | null = null;
const problemIntByUuid = new Map<string, number>();
let nextCasesIntId = 1;

function problemIntId(problemUuid: string): number {
  let id = problemIntByUuid.get(problemUuid);
  if (id === undefined) {
    const handlerUuid = problemUuid;
    id = provider!.register(async () => loadProviderProblem(handlerUuid));
    problemIntByUuid.set(problemUuid, id);
  }
  return id;
}

async function loadProviderProblem(problemUuid: string): Promise<ProviderProblem> {
  const { data: problem, error: probErr } = await supabase
    .from('problems')
    .select('time_limit_ms, memory_limit_mb')
    .eq('id', problemUuid)
    .single();
  if (probErr || !problem) {
    throw new Error(`problem not found (${problemUuid}): ${probErr?.message ?? 'no row'}`);
  }

  const { data: testcases, error: tcErr } = await supabase
    .from('testcases')
    .select('*')
    .eq('problem_id', problemUuid)
    .order('created_at', { ascending: true });
  if (tcErr || !testcases || testcases.length === 0) {
    throw new Error(`no testcases for problem ${problemUuid}`);
  }

  const cases: ProviderProblem['cases'] = [];
  let totalScore = 0;
  for (const tc of testcases as Testcase[]) {
    const content = await resolveTestcaseContent(tc);
    if (content.contentError) throw new Error(content.contentError);
    cases.push({ input: content.inputContent, output: content.outputContent });
    totalScore += tc.score ?? 0;
  }

  return {
    timeLimitMs: problem.time_limit_ms,
    memoryLimitMb: problem.memory_limit_mb,
    totalScore: totalScore > 0 ? totalScore : 100,
    cases,
  };
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in environment!');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  realtime: { params: { eventsPerSecond: 2 } },
});

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

async function preflightCheck(): Promise<void> {
  const url = SUPABASE_URL.replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    console.warn(`⚠️ SUPABASE_URL có dạng bất thường: "${url}" — chuẩn là https://<project-ref>.supabase.co`);
  }
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY },
      signal: AbortSignal.timeout(8000),
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

const sandbox = new SandboxEngine();

const processing = new Set<string>();
const pendingQueue: Submission[] = [];
let queueRunning = false;

function enqueue(submission: Submission) {
  if (processing.has(submission.id)) return;
  const exists = pendingQueue.some((s) => s.id === submission.id);
  if (!exists) pendingQueue.push(submission);
  void drainQueue();
}

async function drainQueue() {
  if (queueRunning) return;
  queueRunning = true;
  try {
    while (pendingQueue.length > 0) {
      const submission = pendingQueue.shift();
      if (!submission) continue;
      if (processing.has(submission.id)) continue;
      processing.add(submission.id);
      try {
        await processSubmission(submission);
      } finally {
        processing.delete(submission.id);
      }
    }
  } finally {
    queueRunning = false;
  }
}

function protoStatusToSubmission(proto: string): SubmissionStatus {
  switch (proto) {
    case 'ACCEPTED':
      return 'ACCEPTED';
    case 'WRONG_ANSWER':
    case 'PRESENTATION_ERROR':
      return 'WRONG_ANSWER';
    case 'TIME_LIMIT_EXCEEDED':
      return 'TIME_LIMIT_EXCEEDED';
    case 'MEMORY_LIMIT_EXCEEDED':
      return 'MEMORY_LIMIT_EXCEEDED';
    case 'COMPILE_ERROR':
      return 'COMPILE_ERROR';
    default:
      return 'RUNTIME_ERROR';
  }
}

/** Chấm bài qua rsjudge engine (compile/run trong Rust sandbox). */
async function judgeWithEngine(
  submission: Submission,
  problem: { id: string; time_limit_ms: number; memory_limit_mb: number },
  testcases: Testcase[]
): Promise<void> {
  const pIntId = problemIntId(problem.id);
  const casesIntId = nextCasesIntId++;

  if (!Number.isInteger(pIntId) || pIntId < 1) {
    await updateSubmissionResult(
      submission.id,
      'SYSTEM_ERROR',
      0,
      0,
      0,
      `invalid problem int id ${pIntId} (engine registry desync)`,
      []
    );
    return;
  }
  console.log(`[Worker] Engine submit ${submission.id}: problem#${pIntId} cases#${casesIntId}`);

  let overallStatus: SubmissionStatus = 'SYSTEM_ERROR';
  let maxTimeMs = 0;
  let maxMemoryMb = 0;
  let totalScore = 0;
  const caseInfos = new Map<number, { status: SubmissionStatus; timeMs: number; memoryMb: number }>();
  let compileError: string | undefined;

  try {
    const events: SubmitEvent[] = [];
    for await (const event of engine!.submit({
      languageName: LANG_TO_ENGINE[submission.language],
      code: submission.code,
      problemIntId: pIntId,
      casesIntId,
    })) {
      events.push(event);

      if (event.kind === 'compile_info' && event.exitStatus !== 0) {
        compileError = (event.stderr || event.stdout || 'Compilation Failed').slice(0, 8000);
        break;
      }
      if (event.kind === 'case_info') {
        const info = event.info;
        caseInfos.set(info.case_id, {
          status: protoStatusToSubmission(info.result),
          timeMs: info.time_ms ?? 0,
          memoryMb: Math.ceil((info.memory_kib ?? 0) / 1024),
        });
        maxTimeMs = Math.max(maxTimeMs, info.time_ms ?? 0);
        maxMemoryMb = Math.max(maxMemoryMb, Math.ceil((info.memory_kib ?? 0) / 1024));
      }
      if (event.kind === 'summary') {
        overallStatus = protoStatusToSubmission(event.summary.result);
        totalScore = event.summary.score;
        if (event.summary.max_time_ms != null) maxTimeMs = event.summary.max_time_ms;
        if (event.summary.max_memory_kib != null) {
          maxMemoryMb = Math.max(maxMemoryMb, Math.ceil(event.summary.max_memory_kib / 1024));
        }
      }
    }

    if (compileError !== undefined) {
      console.log(`[Worker] Compile Error (engine) for submission: ${submission.id}`);
      await updateSubmissionResult(submission.id, 'COMPILE_ERROR', 0, 0, 0, compileError, []);
      return;
    }

    // Map case results back to testcases theo thứ tự archive (= created_at).
    const testcaseResults: TestcaseResult[] = testcases.map((tc, index) => {
      const info = caseInfos.get(index + 1);
      const status = info?.status ?? 'SYSTEM_ERROR';
      return {
        testcase_id: tc.id,
        status,
        time_ms: info?.timeMs ?? 0,
        memory_mb: info?.memoryMb ?? 0,
        error: undefined,
      };
    });

    await updateSubmissionResult(
      submission.id,
      overallStatus,
      maxTimeMs,
      maxMemoryMb,
      totalScore,
      null,
      testcaseResults
    );
    console.log(`[Worker] Finished judging (engine) submission ${submission.id}: ${overallStatus}`);
  } catch (err: any) {
    console.error(`[Worker] Engine judging failed for ${submission.id}:`, err?.message ?? err);
    await updateSubmissionResult(
      submission.id,
      'SYSTEM_ERROR',
      maxTimeMs,
      maxMemoryMb,
      0,
      `engine error: ${String(err?.message ?? err)}`.slice(0, 8000),
      []
    );
  }
}

/** Custom run qua engine SelfTest RPC. */
async function customRunWithEngine(submission: Submission, customInput: string): Promise<boolean> {
  try {
    const result = await engine!.selfTest({
      languageName: LANG_TO_ENGINE[submission.language],
      code: submission.code,
      stdin: customInput,
    });

    if (!result.compileOk) {
      await updateSubmissionResult(
        submission.id,
        'COMPILE_ERROR',
        0,
        0,
        0,
        (result.compileStderr || 'Compilation Failed').slice(0, 8000),
        []
      );
      return true;
    }

    const timedOut = result.verdictTimeMs == null;
    const status: SubmissionStatus =
      timedOut ? 'TIME_LIMIT_EXCEEDED' : result.exitStatus === 0 ? 'ACCEPTED' : 'RUNTIME_ERROR';
    const details: TestcaseResult[] = [
      {
        testcase_id: 'run',
        status,
        time_ms: result.verdictTimeMs ?? 0,
        memory_mb: 0,
        error: timedOut ? 'Time Limit Exceeded' : status === 'RUNTIME_ERROR' ? result.stderr.slice(0, 2000) : undefined,
        output: result.stdout.slice(0, 20000),
      },
    ];
    await updateSubmissionResult(
      submission.id,
      status,
      result.verdictTimeMs ?? 0,
      0,
      0,
      null,
      details
    );
    console.log(`[Worker] Finished engine run ${submission.id}: ${status}`);
    return true;
  } catch (err: any) {
    console.error(`[Worker] Engine custom-run failed for ${submission.id}:`, err?.message ?? err);
    return false;
  }
}

async function claimSubmission(submissionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('submissions')
    .update({ status: 'JUDGING' })
    .eq('id', submissionId)
    .eq('status', 'PENDING')
    .select('id');

  if (error) {
    console.error(`[Worker] Claim failed for ${submissionId}:`, error.message);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

async function processSubmission(submission: Submission) {
  console.log(`[Worker] Processing submission ID: ${submission.id} (Language: ${submission.language})`);

  if (!(await claimSubmission(submission.id))) {
    console.warn(`[Worker] Submission ${submission.id} already claimed by another worker.`);
    return;
  }

  try {
    // CHẠY THỬ: is_run + custom_input trong details → chỉ chạy 1 lần, không so đáp án
    const runInput = submission.is_run
      ? (submission.details as any)?.custom_input
      : undefined;

    if (typeof runInput === 'string' && engine) {
      await customRunWithEngine(submission, runInput);
      return;
    }
    if (typeof runInput === 'string') {
      await processCustomRun(submission, runInput);
      return;
    }

    const { data: problem, error: probErr } = await supabase
      .from('problems')
      .select('*')
      .eq('id', submission.problem_id)
      .single();

    if (probErr || !problem) {
      console.error(`[Worker] Problem not found: ${submission.problem_id}`, probErr);
      await updateSubmissionResult(submission.id, 'SYSTEM_ERROR', 0, 0, 0, 'Problem not found in database', []);
      return;
    }

    const { data: testcases, error: tcErr } = await supabase
      .from('testcases')
      .select('*')
      .eq('problem_id', submission.problem_id)
      .order('created_at', { ascending: true });

    if (tcErr || !testcases || testcases.length === 0) {
      console.error(`[Worker] No testcases found for problem: ${submission.problem_id}`);
      await updateSubmissionResult(submission.id, 'SYSTEM_ERROR', 0, 0, 0, 'No testcases available for this problem', []);
      return;
    }

    // Engine mode: compile + run trong rsjudge (Rust), worker chỉ điều phối.
    if (engine) {
      await judgeWithEngine(submission, problem, testcases as Testcase[]);
      return;
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oj-judge-'));
    const sourceExt =
      submission.language === 'cpp'
        ? '.cpp'
        : submission.language === 'rust'
          ? '.rs'
          : submission.language === 'java'
            ? '.java'
            : '.py';
    const sourcePath =
      submission.language === 'java'
        ? path.join(tempDir, 'Main.java')
        : path.join(tempDir, `solution${sourceExt}`);
    const binaryPath = path.join(tempDir, 'solution_exec');

    await fs.writeFile(sourcePath, submission.code, 'utf-8');

    const compileResult = await sandbox.compile(submission.language, sourcePath, binaryPath);
    if (!compileResult.success) {
      console.log(`[Worker] Compile Error for submission: ${submission.id}`);
      await updateSubmissionResult(submission.id, 'COMPILE_ERROR', 0, 0, 0, compileResult.error || 'Compilation Failed', []);
      await fs.rm(tempDir, { recursive: true, force: true });
      return;
    }

    const targetPath = submission.language === 'python' ? sourcePath : binaryPath;

    let overallStatus: SubmissionStatus = 'ACCEPTED';
    let maxTimeMs = 0;
    let maxMemoryMb = 0;
    let totalScore = 0;
    const testcaseResults: TestcaseResult[] = [];

    for (const tc of testcases as Testcase[]) {
      const { inputContent, outputContent, contentError } = await resolveTestcaseContent(tc);

      if (contentError) {
        testcaseResults.push({
          testcase_id: tc.id,
          status: 'SYSTEM_ERROR',
          time_ms: 0,
          memory_mb: 0,
          error: contentError,
        });
        overallStatus = 'SYSTEM_ERROR';
        continue;
      }

      const execResult = await sandbox.executeTestcase(
        submission.language,
        targetPath,
        inputContent,
        problem.time_limit_ms,
        problem.memory_limit_mb
      );

      let tcStatus: SubmissionStatus = execResult.status;

      if (tcStatus === 'ACCEPTED') {
        const isMatch = compareOutput(execResult.stdout, outputContent);
        if (!isMatch) {
          tcStatus = 'WRONG_ANSWER';
        } else {
          totalScore += tc.score;
        }
      }

      if (execResult.timeMs > maxTimeMs) maxTimeMs = execResult.timeMs;
      if (execResult.memoryMb > maxMemoryMb) maxMemoryMb = execResult.memoryMb;

      testcaseResults.push({
        testcase_id: tc.id,
        status: tcStatus,
        time_ms: execResult.timeMs,
        memory_mb: execResult.memoryMb,
        error: tcStatus === 'ACCEPTED' ? undefined : execResult.error,
      });

      if (tcStatus !== 'ACCEPTED' && overallStatus === 'ACCEPTED') {
        overallStatus = tcStatus;
      }
    }

    await updateSubmissionResult(submission.id, overallStatus, maxTimeMs, maxMemoryMb, totalScore, null, testcaseResults);
    await fs.rm(tempDir, { recursive: true, force: true });
    console.log(`[Worker] Finished judging submission ${submission.id}: Result = ${overallStatus}`);
  } catch (err: any) {
    console.error(`[Worker] Unexpected error for submission ${submission.id}:`, err);
    await updateSubmissionResult(submission.id, 'SYSTEM_ERROR', 0, 0, 0, String(err?.message || err), []);
  }
}

async function processCustomRun(submission: Submission, customInput: string) {
  console.log(`[Worker] Custom run for submission: ${submission.id}`);

  try {
    const { data: problem, error: probErr } = await supabase
      .from('problems')
      .select('*')
      .eq('id', submission.problem_id)
      .single();

    if (probErr || !problem) {
      await updateSubmissionResult(submission.id, 'SYSTEM_ERROR', 0, 0, 0, 'Problem not found in database', []);
      return;
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oj-run-'));
    const sourcePath =
      submission.language === 'java'
        ? path.join(tempDir, 'Main.java')
        : path.join(
            tempDir,
            `solution${
              submission.language === 'cpp' ? '.cpp' : submission.language === 'rust' ? '.rs' : '.py'
            }`
          );
    const binaryPath = path.join(tempDir, 'solution_exec');

    await fs.writeFile(sourcePath, submission.code, 'utf-8');

    const compileResult = await sandbox.compile(submission.language, sourcePath, binaryPath);
    if (!compileResult.success) {
      await updateSubmissionResult(submission.id, 'COMPILE_ERROR', 0, 0, 0, compileResult.error || 'Compilation Failed', []);
      await fs.rm(tempDir, { recursive: true, force: true });
      return;
    }

    const targetPath = submission.language === 'python' ? sourcePath : binaryPath;

    const execResult = await sandbox.executeTestcase(
      submission.language,
      targetPath,
      customInput,
      problem.time_limit_ms,
      problem.memory_limit_mb
    );

    const output = execResult.stdout ?? '';
    const details: TestcaseResult[] = [{
      testcase_id: 'run',
      status: execResult.status,
      time_ms: execResult.timeMs || 0,
      memory_mb: execResult.memoryMb || 0,
      error: execResult.error,
      output: output.slice(0, 20000),
    }];

    await updateSubmissionResult(submission.id, execResult.status, execResult.timeMs || 0, execResult.memoryMb || 0, 0, null, details);
    await fs.rm(tempDir, { recursive: true, force: true });
    console.log(`[Worker] Finished run ${submission.id}: ${execResult.status}`);
  } catch (err: any) {
    console.error(`[Worker] Unexpected error for run ${submission.id}:`, err);
    await updateSubmissionResult(submission.id, 'SYSTEM_ERROR', 0, 0, 0, String(err?.message || err), []);
  }
}

async function resolveTestcaseContent(tc: Testcase): Promise<{
  inputContent: string;
  outputContent: string;
  contentError?: string;
}> {
  let inputContent = tc.input_content != null ? tc.input_content : '';
  let outputContent = tc.output_content || '';

  if (tc.input_content == null && tc.output_content == null) {
    try {
      const [inputData, outputData] = await Promise.all([
        supabase.storage.from('testcases').download(tc.input_path),
        supabase.storage.from('testcases').download(tc.output_path),
      ]);
      const [i, o] = await Promise.all([
        inputData.data ? inputData.data.text() : Promise.resolve(''),
        outputData.data ? outputData.data.text() : Promise.resolve(''),
      ]);
      if (inputData.error || outputData.error) {
        throw new Error(inputData.error?.message || outputData.error?.message);
      }
      inputContent = i;
      outputContent = o;
    } catch (err) {
      return {
        inputContent: '',
        outputContent: '',
        contentError: `Cannot load testcase content (inline or storage): ${err}`,
      };
    }
  }

  return {
    inputContent: normalizeNewlines(inputContent),
    outputContent: normalizeNewlines(outputContent),
  };
}

function normalizeNewlines(content: string): string {
  const real = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (real.includes('\n')) return real;
  return real
    .replace(/\\r\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\n/g, '\n');
}

async function updateSubmissionResult(
  submissionId: string,
  status: SubmissionStatus,
  timeMs: number,
  memoryMb: number,
  score: number,
  errorLog: string | null,
  details: TestcaseResult[]
) {
  const { error } = await supabase
    .from('submissions')
    .update({
      status,
      time_used_ms: timeMs,
      memory_used_mb: memoryMb,
      score,
      error_log: errorLog,
      details,
    })
    .eq('id', submissionId);

  if (error) console.error(`[Worker] Failed to persist result for ${submissionId}:`, error.message);
}

function setupRealtime() {
  const channel: RealtimeChannel = supabase
    .channel('judge-worker-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'submissions' },
      (payload) => {
        enqueue(payload.new as Submission);
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('[Worker] Realtime CHANNEL_ERROR — chưa nối được máy chủ (xem lỗi poll bên dưới). Worker sẽ tự thử lại.');
      } else {
        console.log(`[Worker] Realtime channel status: ${status}`);
      }
    });

  return channel;
}

async function startWorker() {
  console.log('🚀 Judge Worker Daemon started (realtime + polling).');
  await preflightCheck();

  // Khởi động engine mode nếu cấu hình.
  if (RSJUDGE_ENDPOINT) {
    try {
      provider = new CasesProviderServer();
      await provider.start(RSJUDGE_PROVIDER_BIND);
      engine = new RsjudgeEngineClient(RSJUDGE_ENDPOINT);
      console.log(
        `⚙️ rsjudge engine mode ON: judge=${RSJUDGE_ENDPOINT}, cases-provider=${RSJUDGE_PROVIDER_BIND}`
      );
    } catch (err: any) {
      engine = null;
      provider = null;
      console.error(`❌ Không khởi động được rsjudge engine (${err?.message ?? err}) — fallback sandbox local.`);
    }
  } else {
    console.log('🧱 Sandbox local (bwrap/time/timeout) — đặt RSJUDGE_ENDPOINT để dùng engine Rust.');
  }

  const channel = setupRealtime();
  void channel;
  await new Promise((res) => setTimeout(res, 1500));

  let lastHint = '';
  let failStreak = 0;

  while (true) {
    try {
      const { data: pendingSubmissions, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true })
        .limit(10);

      if (error) {
        failStreak++;
        const hint = classifyNetworkError(error);
        if (hint !== lastHint || failStreak === 1 || failStreak % 15 === 0) {
          console.error(`[Worker] Lỗi lấy bài PENDING (lần #${failStreak}): ${hint}`);
          if (failStreak === 5) {
            const url = SUPABASE_URL.replace(/\/+$/, '');
            console.error(`[Worker] Gợi ý: chạy "curl -I --max-time 8 ${url}/rest/v1/" để kiểm tra kết nối.`);
          }
        }
        lastHint = hint;
      } else {
        if (failStreak > 0) console.log('[Worker] Kết nối Supabase đã hồi phục ✅');
        failStreak = 0;
        lastHint = '';

        if (pendingSubmissions && pendingSubmissions.length > 0) {
          for (const sub of pendingSubmissions as Submission[]) {
            enqueue(sub);
          }
        }
      }
    } catch (err) {
      console.error('[Worker] Loop error:', classifyNetworkError(err));
    }

    await new Promise((res) => setTimeout(res, 2000));
  }
}

startWorker();