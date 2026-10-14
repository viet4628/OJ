import { execFileSync, spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { SubmissionStatus } from '../types.js';

export interface ExecutionResult {
  status: SubmissionStatus;
  stdout: string;
  stderr: string;
  timeMs: number;
  memoryMb: number;
  error?: string;
}

const MAX_OUTPUT_BYTES = 1024 * 1024;
const MAX_STDERR_BYTES = 256 * 1024;
const COMPILE_TIMEOUT_MS = 120_000;
const BWRAP_PROBE_TIMEOUT_MS = 5_000;
const JAVA_RSS_ALLOWANCE_MB = 128;
const BWRAP_CANDIDATES = ['/usr/bin/bwrap', '/bin/bwrap', '/usr/local/bin/bwrap'];

async function resolveBwrapPath(): Promise<string> {
  for (const candidate of BWRAP_CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      /* thử đường kế tiếp */
    }
  }
  throw new Error('bwrap binary not found');
}

export class SandboxEngine {
  private timeBinaryAvailable: boolean | null = null;
  private timeoutBinaryAvailable: boolean | null = null;
  private bwrapUsable: boolean | null = null;
  private bwrapPath = '/usr/bin/bwrap';

  /**
   * Bubblewrap: cách ly user code bằng namespaces (net/pid/ipc/uts), filesystem
   * read-only trừ thư mục bài làm và /tmp, xoá toàn bộ env của worker.
   * Không có bwrap (hoặc kernel chặn user namespaces) → fallback chạy trực tiếp
   * như trước (chỉ còn time/timeout), và cảnh báo đúng một lần.
   */
  private async bwrapReady(): Promise<boolean> {
    if (this.bwrapUsable === null) {
      try {
        this.bwrapPath = await resolveBwrapPath();
        const probeArgs = [...(await this.bwrapArgs(os.tmpdir())), '/bin/sh', '-c', ':'];
        execFileSync(this.bwrapPath, probeArgs, {
          timeout: BWRAP_PROBE_TIMEOUT_MS,
          stdio: ['ignore', 'ignore', 'ignore'],
        });
        this.bwrapUsable = true;
        console.log('[Sandbox] bwrap sandbox enabled (namespaces: net/pid/ipc/uts, fs read-only).');
      } catch {
        this.bwrapUsable = false;
        console.warn(
          '[Sandbox] bwrap KHÔNG khả dụng (thiếu binary hoặc user namespaces bị chặn, ' +
            'ví dụ Docker seccomp mặc định). Code user sẽ chạy KHÔNG có cách ly namespace — ' +
            'chỉ giới hạn time/memory/output.'
        );
      }
    }
    return this.bwrapUsable;
  }

  private async bwrapArgs(jobDir: string): Promise<string[]> {
    const args = [
      // Isolation: tách hết namespaces, chết theo cha, session mới (không ctl terminal)
      '--unshare-all',
      '--die-with-parent',
      '--new-session',
      // Filesystem tối thiểu cho compiler/runtime, toàn bộ read-only
      '--ro-bind', '/usr', '/usr',
      '--dev', '/dev',
      '--proc', '/proc',
      '--tmpfs', '/tmp',
      // Thư mục bài làm: đọc ghi được (binary, class, __pycache__)
      '--bind', jobDir, jobDir,
      '--chdir', jobDir,
      // Xoá env của worker, chỉ giữ bộ tối thiểu
      '--clearenv',
      '--setenv', 'PATH', '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      '--setenv', 'HOME', '/tmp',
      '--setenv', 'TMPDIR', '/tmp',
      '--setenv', 'LANG', 'C.UTF-8',
      '--setenv', 'PYTHONDONTWRITEBYTECODE', '1',
    ];
    // Đường tồn tại tuỳ hệ thống: usrmerge (/bin -> /usr/bin), runtime loaders, java alternatives
    for (const p of ['/bin', '/lib', '/lib64']) args.push('--ro-bind-try', p, p);
    for (const p of ['/etc/alternatives', '/etc/ld.so.cache', '/etc/ld.so.conf', '/etc/ld.so.conf.d'])
      args.push('--ro-bind-try', p, p);
    return args;
  }

  async compile(
    language: string,
    sourcePath: string,
    outputBinaryPath: string
  ): Promise<{ success: boolean; error?: string }> {
    const cmd = this.compileCommand(language, sourcePath, outputBinaryPath);
    if (cmd === null) {
      return { success: false, error: `Unsupported language: ${language}` };
    }
    if (cmd === '') {
      return { success: true };
    }

    if (language === 'java') {
      await fs.mkdir(outputBinaryPath, { recursive: true });
    }

    const jobDir = path.dirname(sourcePath);
    const useBwrap = await this.bwrapReady();
    const bin = useBwrap ? this.bwrapPath : '/bin/sh';
    const argv = useBwrap
      ? [...(await this.bwrapArgs(jobDir)), '/bin/sh', '-c', cmd]
      : ['/bin/sh', '-c', cmd];

    try {
      execFileSync(bin, argv, {
        cwd: jobDir,
        timeout: COMPILE_TIMEOUT_MS,
        maxBuffer: 4 * 1024 * 1024,
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: String(err.stderr || err.stdout || err.message || 'Compilation Error').slice(0, 8000),
      };
    }
  }

  async executeTestcase(
    language: string,
    executableOrScriptPath: string,
    inputContent: string,
    timeLimitMs: number,
    memoryLimitMb: number
  ): Promise<ExecutionResult> {
    let toolArgs: string[] | null = null;
    if (language === 'python') toolArgs = ['python3', executableOrScriptPath];
    else if (language === 'cpp' || language === 'rust') toolArgs = [executableOrScriptPath];
    else if (language === 'java')
      toolArgs = [
        'java',
        `-Xmx${Math.max(16, memoryLimitMb)}m`,
        '-XX:+UseSerialGC',
        '-cp',
        executableOrScriptPath,
        'Main',
      ];
    else {
      return {
        status: 'SYSTEM_ERROR',
        stdout: '',
        stderr: '',
        timeMs: 0,
        memoryMb: 0,
        error: `Unsupported language: ${language}`,
      };
    }

    const hasTime = await this.timeAvailable();
    const hasTimeout = await this.timeoutAvailable();
    const statDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oj-stat-'));
    const statFile = path.join(statDir, 'stats.txt');
    const startedAt = Date.now();

    const argv: string[] = [];
    if (hasTime) argv.push('/usr/bin/time', '-v', '-o', statFile);
    if (hasTimeout)
      argv.push('timeout', '--signal=KILL', String((timeLimitMs + 1500) / 1000));
    if (await this.bwrapReady()) {
      // Đường tuyệt đối để `timeout` không nhầm flag của bwrap làm option của nó
      argv.push(this.bwrapPath, ...(await this.bwrapArgs(path.dirname(executableOrScriptPath))));
    }
    argv.push(...toolArgs);

    const stdoutSink = { text: '', truncated: false };
    const stderrSink = { text: '', truncated: false };

    const appendSized = (
      sink: { text: string; truncated: boolean },
      data: Buffer,
      max: number
    ) => {
      const remaining = max - Buffer.byteLength(sink.text, 'utf8');
      if (remaining <= 0) {
        sink.truncated = true;
        return;
      }
      const take = Math.min(remaining, data.length);
      if (take < data.length) sink.truncated = true;
      sink.text += data.subarray(0, take).toString('utf8');
    };

    const child = spawn(argv[0], argv.slice(1), { detached: !hasTimeout });

    let fallbackTimer: NodeJS.Timeout | null = null;
    if (!hasTimeout) {
      fallbackTimer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
          if (child.pid) process.kill(-child.pid, 'SIGKILL');
        } catch {
          /* already exited */
        }
      }, timeLimitMs);
    }

    const result = await new Promise<ExecutionResult>((resolve) => {
      child.on('error', (err: Error) => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        resolve({
          status: 'SYSTEM_ERROR',
          stdout: '',
          stderr: '',
          timeMs: 0,
          memoryMb: 0,
          error: `Could not launch sandbox: ${err.message} (argv: ${argv.join(' ')})`,
        });
      });

      if (inputContent) {
        child.stdin.write(inputContent);
        child.stdin.end();
      }
      child.stdin.on('error', () => {});

      child.stdout.on('data', (data: Buffer) => appendSized(stdoutSink, data, MAX_OUTPUT_BYTES));
      child.stderr.on('data', (data: Buffer) => appendSized(stderrSink, data, MAX_STDERR_BYTES));

      child.on('close', async (code: number | null, signal: NodeJS.Signals | null) => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        const elapsedMs = Date.now() - startedAt;

        let maxRssKb = 0;
        let cpuSeconds = -1;
        if (hasTime) {
          try {
            const stats = await fs.readFile(statFile, 'utf-8');
            const mRss = stats.match(/Maximum resident set size \(kbytes\):\s*(\d+)/);
            if (mRss) maxRssKb = parseInt(mRss[1], 10);
            const mUser = stats.match(/User time \(seconds\):\s*([\d.]+)/);
            const mSys = stats.match(/System time \(seconds\):\s*([\d.]+)/);
            if (mUser && mSys) cpuSeconds = parseFloat(mUser[1]) + parseFloat(mSys[1]);
          } catch {
            /* stats file may not exist */
          }
        }
        await fs.rm(statDir, { recursive: true, force: true }).catch(() => {});

        const killedByTimeout =
          code === 124 ||
          ((signal === 'SIGKILL' || code === 137 || code === 124) && elapsedMs >= timeLimitMs - 200);

        let status: SubmissionStatus = 'ACCEPTED';
        if (code !== 0) {
          status = killedByTimeout ? 'TIME_LIMIT_EXCEEDED' : 'RUNTIME_ERROR';
        }
        if (
          status === 'RUNTIME_ERROR' &&
          /OutOfMemoryError|Cannot allocate memory|std::bad_alloc/.test(stderrSink.text)
        ) {
          status = 'MEMORY_LIMIT_EXCEEDED';
        }
        const rssAllowance =
          language === 'java' ? (memoryLimitMb + JAVA_RSS_ALLOWANCE_MB) * 1024 : memoryLimitMb * 1024;
        if (status !== 'TIME_LIMIT_EXCEEDED' && maxRssKb > rssAllowance) {
          status = 'MEMORY_LIMIT_EXCEEDED';
        }

        let error: string | undefined;
        if (status === 'TIME_LIMIT_EXCEEDED') {
          error = 'Time Limit Exceeded';
        } else if (status === 'MEMORY_LIMIT_EXCEEDED') {
          error = `Memory Limit Exceeded (${Math.round(maxRssKb / 1024)} MB)`;
        } else if (code !== 0) {
          error = stderrSink.text || (signal || `Exit code: ${code}`);
        }
        if (stdoutSink.truncated || stderrSink.truncated) {
          status = 'RUNTIME_ERROR';
          error = (error ? `${error}; ` : '') + 'Output too large';
        }

        const reportedMs =
          cpuSeconds >= 0 ? Math.round(cpuSeconds * 1000) : elapsedMs;

        resolve({
          status,
          stdout: stdoutSink.text,
          stderr: stderrSink.text,
          timeMs: Math.max(1, Math.min(reportedMs, Math.round(timeLimitMs + 1500))),
          memoryMb: Math.round(maxRssKb / 1024),
          error,
        });
      });
    });

    return result;
  }

  private compileCommand(language: string, sourcePath: string, binaryPath: string): string | null {
    const q = (p: string) => `'${p.replace(/'/g, `'\\''`)}'`;
    switch (language) {
      case 'cpp':
        return `g++ -O2 -std=c++17 ${q(sourcePath)} -o ${q(binaryPath)}`;
      case 'rust':
        return `rustc -O ${q(sourcePath)} -o ${q(binaryPath)}`;
      case 'java':
        return `javac -d ${q(binaryPath)} ${q(sourcePath)}`;
      case 'python':
        return '';
      default:
        return null;
    }
  }

  private async timeAvailable(): Promise<boolean> {
    if (this.timeBinaryAvailable === null) {
      try {
        await fs.access('/usr/bin/time');
        this.timeBinaryAvailable = true;
      } catch {
        this.timeBinaryAvailable = false;
      }
    }
    return this.timeBinaryAvailable;
  }

  private async timeoutAvailable(): Promise<boolean> {
    if (this.timeoutBinaryAvailable === null) {
      try {
        await fs.access('/usr/bin/timeout');
        this.timeoutBinaryAvailable = true;
      } catch {
        this.timeoutBinaryAvailable = false;
      }
    }
    return this.timeoutBinaryAvailable;
  }
}
