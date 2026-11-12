#!/usr/bin/env node
// Aggregates judge worker timing logs into a percentile report.
// Usage: node scripts/worker-timings.mjs [--container online-judge-worker-1] [--since 30m] [--output report.json]
import { parseArgs } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const { values } = parseArgs({ options: {
  container: { type: 'string', default: 'online-judge-worker-1' },
  since: { type: 'string', default: '' },
  output: { type: 'string', default: '' },
} });
const run = promisify(execFile);

const GROUPS = {
  Timing: ['claimMs', 'loadMs', 'judgeMs', 'saveMs', 'totalMs'],
  CasesTiming: ['cases', 'loadMs', 'archiveMs', 'archiveBytes'],
  EngineTiming: ['compileRpcMs', 'afterCompileMs'],
};

const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))];
};

const args = ['logs'];
if (values.since) args.push('--since', values.since);
args.push(values.container);
const { stdout } = await run('docker', args, { timeout: 60000, maxBuffer: 128 * 1024 * 1024 });

const samples = new Map(Object.keys(GROUPS).map(key => [key, []]));
for (const line of stdout.split('\n')) {
  const bracket = line.indexOf('] ');
  if (!line.startsWith('[') || bracket < 0) continue;
  const group = line.slice(1, bracket);
  if (!samples.has(group)) continue;
  try {
    const payload = JSON.parse(line.slice(bracket + 2));
    samples.get(group).push(payload);
  } catch { /* non-JSON log line */ }
}

const metrics = {};
for (const [group, fields] of Object.entries(GROUPS)) {
  const rows = samples.get(group);
  const summary = { count: rows.length, fields: {} };
  for (const field of fields) {
    const values = rows.map(row => row[field]).filter(value => Number.isFinite(value));
    if (!values.length) continue;
    summary.fields[field] = { p50: percentile(values, 0.5), p95: percentile(values, 0.95), max: Math.max(...values) };
  }
  metrics[group] = summary;
}

const report = { at: new Date().toISOString(), container: values.container, since: values.since || 'all', metrics };
if (values.output) await writeFile(values.output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify(report, null, 2));
