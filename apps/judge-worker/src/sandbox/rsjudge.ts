import { execFile, execFileSync, spawn } from 'child_process';
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
   * Không có bwrap (hoặc kernel chặn user namespaces) → từ chối chạy.
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
        console.error('[Sandbox] bwrap unavailable: refusing to execute user code.');
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
      '--cap-drop', 'ALL',
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
      '--setenv', 'LC_ALL', 'C',
      '--setenv', 'PYTHONDONTWRITEBYTECODE', '1',
    ];
    // Đường tồn tại tuỳ hệ thống: usrmerge (/bin -> /usr/bin), runtime loaders, java alternatives
    for (const p of ['/bin', '/lib', '/lib64']) args.push('--ro-bind-try', p, p);
    for (const p of ['/etc/alternatives', '/etc/ld.so.cache', '/etc/ld.so.conf', '/etc/ld.so.conf.d'])
      args.push('--ro-bind-try', p, p);
    return args;
  }

  async assertReady(): Promise<void> {
    if (!(await this.bwrapReady())) throw new Error('Sandbox isolation unavailable');
  }

  async compile(
    language: string,
    sourcePath: string,
    outputBinaryPath: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!(await this.bwrapReady())) throw new Error('Sandbox isolation unavailable');
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
    const bin = this.bwrapPath;
    const argv = [...(await this.bwrapArgs(jobDir)), '/bin/sh', '-c', `ulimit -t 120 && ulimit -v 2097152 && ulimit -f 262144 && ${cmd}`];

    try {
      await new Promise<void>((resolve, reject) => execFile(bin, argv, {
        cwd: jobDir,
        timeout: COMPILE_TIMEOUT_MS,
        maxBuffer: 4 * 1024 * 1024,
      }, (error, _stdout, stderr) => error ? reject(Object.assign(error, { stderr })) : resolve()));
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
    if (!(await this.bwrapReady())) throw new Error('Sandbox isolation unavailable');
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
    const jobDir = path.dirname(executableOrScriptPath);
    // GNU time chạy NGOÀI sandbox, báo cáo nằm cạnh (không bind vào) thư mục bài
    // nên chương trình không sửa được. `--as-pid-1` cho chương trình là con trực
    // tiếp của bwrap, nhờ đó usage của nó đi lên tới time qua wait4.
    const statFile = `${jobDir}.usage`;
    const startedAt = Date.now();

    const argv: string[] = [];
    if (hasTimeout)
      argv.push('timeout', '--signal=KILL', String((timeLimitMs + 1500) / 1000));
    if (hasTime) argv.push('/usr/bin/time', '-f', '%U %S %M', '-o', statFile);
    argv.push(this.bwrapPath, ...(await this.bwrapArgs(jobDir)), '--as-pid-1');
    // Apply limits inside the namespace; pass argv as positional arguments.
    const addressLimitKb = language === 'java' ? 4 * 1024 * 1024 : memoryLimitMb * 1024;
    argv.push('/bin/sh', '-c', `ulimit -t ${Math.max(1, Math.ceil(timeLimitMs / 1000))} && ulimit -v ${addressLimitKb} && ulimit -f 1024 && exec "$@"`, 'sandbox', ...toolArgs);

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

      child.stdin.on('error', () => {});
      child.stdin.end(inputContent);

      child.stdout.on('data', (data: Buffer) => {
        appendSized(stdoutSink, data, MAX_OUTPUT_BYTES);
        if (stdoutSink.truncated) child.kill('SIGKILL');
      });
      child.stderr.on('data', (data: Buffer) => {
        appendSized(stderrSink, data, MAX_STDERR_BYTES);
        if (stderrSink.truncated) child.kill('SIGKILL');
      });

      child.on('close', async (code: number | null, signal: NodeJS.Signals | null) => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        const elapsedMs = Date.now() - startedAt;

        let maxRssKb = 0;
        let cpuSeconds = -1;
        if (hasTime) {
          try {
            const stats = await fs.readFile(statFile, 'utf-8');
            const line = stats.split('\n').map(row => row.trim())
              .find(row => row.split(/\s+/).length === 3);
            if (line) {
              const [user, system, rss] = line.split(/\s+/);
              cpuSeconds = parseFloat(user) + parseFloat(system);
              maxRssKb = parseInt(rss, 10);
            }
          } catch {
            /* report may be missing when the program was killed */
          }
          await fs.rm(statFile, { force: true }).catch(() => {});
        }

        const killedByTimeout =
          code === 124 ||
          code === 152 || signal === 'SIGXCPU' ||
          ((signal === 'SIGKILL' || code === 137) && elapsedMs >= timeLimitMs - 200);

        let status: SubmissionStatus = 'ACCEPTED';
        if (code !== 0) {
          status = killedByTimeout ? 'TIME_LIMIT_EXCEEDED' : 'RUNTIME_ERROR';
        }
        if (cpuSeconds * 1000 > timeLimitMs) status = 'TIME_LIMIT_EXCEEDED';
        if (
          status === 'RUNTIME_ERROR' &&
          /OutOfMemoryError|MemoryError|Cannot allocate memory|std::bad_alloc/.test(stderrSink.text)
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
