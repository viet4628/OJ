#!/usr/bin/env node
// Smoke test SandboxEngine: biên dịch + chạy code user qua lớp bwrap (nếu có).
// Usage: node scripts/smoke-sandbox.mjs   (chạy sau `npm run build`)
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { SandboxEngine } from '../dist/sandbox/rsjudge.js';

const results = [];
let failed = 0;
let skipped = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

async function inTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'oj-smoke-'));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function runCase(engine, language, sourcePath, binaryPath, input, tlMs = 5000) {
  const compile = await engine.compile(language, sourcePath, binaryPath);
  if (!compile.success) return { status: 'COMPILE_ERROR', error: compile.error };
  const target = language === 'python' ? sourcePath : binaryPath;
  return engine.executeTestcase(language, target, input, tlMs, 256);
}

const CPP_AB = `#include <bits/stdc++.h>
int main(){long long a,b; if(!(std::cin>>a>>b)) return 1; std::cout<<a+b<<"\\n";}`;

const PY_ECHO = `import sys
data = sys.stdin.read()
print(data.strip())`;

const PY_ENV_PROBE = `import os
secret = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
shadow = "read" if os.path.exists("/etc/shadow") else "absent"
print(f"env={len(secret)} shadow={shadow}")`;

const PY_NET_PROBE = `import socket, sys
try:
    s = socket.create_connection(("203.0.113.1", 81), timeout=3)
    print("connected")
except Exception as e:
    print(f"blocked:{type(e).__name__}", file=sys.stderr)
    sys.exit(3)`;

const CPP_LOOP = `int main(){ for(;;){} }`;

const RUST_AB = `use std::io::{self, Read};
fn main() {
    let mut s = String::new();
    io::stdin().read_to_string(&mut s).unwrap();
    let mut it = s.split_whitespace();
    let a: i64 = it.next().unwrap().parse().unwrap();
    let b: i64 = it.next().unwrap().parse().unwrap();
    println!("{}", a + b);
}`;

const JAVA_AB = `import java.util.*;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.println(sc.nextLong() + sc.nextLong());
    }
}`;

const engine = new SandboxEngine();

// 1) C++ A+B đúng
await inTempDir(async (dir) => {
  const src = path.join(dir, 'solution.cpp');
  const bin = path.join(dir, 'solution_exec');
  await fs.writeFile(src, CPP_AB);
  const r = await runCase(engine, 'cpp', src, bin, '3 4\n');
  record('cpp A+B -> ACCEPTED', r.status === 'ACCEPTED' && r.stdout.trim() === '7',
    JSON.stringify(r).slice(0, 200));
});

// 2) Python echo
await inTempDir(async (dir) => {
  const src = path.join(dir, 'solution.py');
  const bin = path.join(dir, 'unused');
  await fs.writeFile(src, PY_ECHO);
  const r = await runCase(engine, 'python', src, bin, 'hello sandbox\n');
  record('python echo -> ACCEPTED', r.status === 'ACCEPTED' && r.stdout.trim() === 'hello sandbox',
    JSON.stringify(r).slice(0, 200));
});

// 3) Vòng lặp vô hạn -> TLE
await inTempDir(async (dir) => {
  const src = path.join(dir, 'solution.cpp');
  const bin = path.join(dir, 'solution_exec');
  await fs.writeFile(src, CPP_LOOP);
  const t0 = Date.now();
  const r = await runCase(engine, 'cpp', src, bin, '', 1500);
  const wall = Date.now() - t0;
  record('infinite loop -> TIME_LIMIT_EXCEEDED', r.status === 'TIME_LIMIT_EXCEEDED' && wall < 6000,
    `status=${r.status} wall=${wall}ms`);
});

// 4) Env worker bị xoá + /etc/shadow không thấy
await inTempDir(async (dir) => {
  const src = path.join(dir, 'solution.py');
  const bin = path.join(dir, 'unused');
  await fs.writeFile(src, PY_ENV_PROBE);
  const r = await runCase(engine, 'python', src, bin, '');
  const out = r.stdout.trim();
  record('env cleared & /etc/shadow hidden',
    r.status === 'ACCEPTED' && /^env=0 shadow=absent/.test(out),
    `out="${out}"`);
});

// 5) Mạng bị chặn (unshare-net): lỗi lập tức thay vì chờ timeout
await inTempDir(async (dir) => {
  const src = path.join(dir, 'solution.py');
  const bin = path.join(dir, 'unused');
  await fs.writeFile(src, PY_NET_PROBE);
  const t0 = Date.now();
  const r = await runCase(engine, 'python', src, bin, '', 8000);
  const wall = Date.now() - t0;
  record('network blocked (fails fast)', r.status === 'RUNTIME_ERROR' && wall < 5000,
    `status=${r.status} wall=${wall}ms err="${(r.error || '').slice(0, 120)}"`);
});

// 6) Rust A+B (bỏ qua nếu rustc không nằm trong /usr — ví dụ rustup ở ~/.cargo)
await inTempDir(async (dir) => {
  const src = path.join(dir, 'solution.rs');
  const bin = path.join(dir, 'solution_exec');
  await fs.writeFile(src, RUST_AB);
  let r;
  try {
    await fs.access('/usr/bin/rustc');
    r = await runCase(engine, 'rust', src, bin, '10 32\n');
  } catch {
    skipped++; console.log('SKIP rust: /usr/bin/rustc unavailable');
    return;
  }
  record('rust A+B -> ACCEPTED', r.status === 'ACCEPTED' && r.stdout.trim() === '42',
    JSON.stringify(r).slice(0, 200));
});

// 7) Java A+B (compile ra thư mục classes)
await inTempDir(async (dir) => {
  const src = path.join(dir, 'Main.java');
  const bin = path.join(dir, 'classes');
  await fs.writeFile(src, JAVA_AB);
  let r;
  try {
    await fs.access('/usr/bin/javac');
    r = await runCase(engine, 'java', src, bin, '-5 47\n');
  } catch {
    skipped++; console.log('SKIP java: /usr/bin/javac unavailable (not advertised by UI)');
    return;
  }
  record('java A+B -> ACCEPTED', r.status === 'ACCEPTED' && r.stdout.trim() === '42',
    JSON.stringify(r).slice(0, 200));
});

// Empty input must close stdin, and limits must apply rather than just report RSS.
await inTempDir(async (dir) => {
  const src = path.join(dir, 'empty.py');
  await fs.writeFile(src, 'import sys; print(len(sys.stdin.read()))');
  const r = await runCase(engine, 'python', src, '', '', 1000);
  record('empty stdin reaches EOF', r.status === 'ACCEPTED' && r.stdout.trim() === '0' && !r.stderr, JSON.stringify(r));
});
await inTempDir(async (dir) => {
  const src = path.join(dir, 'output.py');
  await fs.writeFile(src, 'print("x" * (2 * 1024 * 1024))');
  const r = await runCase(engine, 'python', src, '', '');
  record('output is capped at 1 MiB', r.status === 'RUNTIME_ERROR' && /Output too large/.test(r.error || '') && Buffer.byteLength(r.stdout) <= 1024 * 1024);
});
await inTempDir(async (dir) => {
  const src = path.join(dir, 'memory.py');
  await fs.writeFile(src, 'x = bytearray(1024 * 1024 * 1024)');
  const r = await runCase(engine, 'python', src, '', '');
  record('memory allocation is prevented', r.status !== 'ACCEPTED' && /MemoryError/.test(r.stderr), JSON.stringify(r));
});
await inTempDir(async (dir) => {
  const unavailable = new SandboxEngine();
  unavailable.bwrapUsable = false;
  const src = path.join(dir, 'failclosed.py');
  await fs.writeFile(src, 'print("must not execute")');
  let blocked = false;
  try { await unavailable.executeTestcase('python', src, '', 1000, 256); } catch { blocked = true; }
  record('unavailable sandbox refuses execution', blocked);
});
console.log(`\n${failed === 0 ? 'ALL PASS' : failed + ' FAILED'} (${results.length} executed, ${skipped} skipped)`);
process.exit(failed === 0 ? 0 : 1);
