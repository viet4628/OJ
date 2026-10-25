#!/usr/bin/env node
// Synthetic query plans on a disposable local PostgreSQL; never reads deployment credentials.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: { output: { type: 'string', default: 'docs/reports/db-performance.json' } } });
const name = `oj-perf-db-${process.pid}`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const sql = text => execFileSync('docker', ['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'],
  { input: text, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const report = { at: new Date().toISOString(), database: 'postgres:15-alpine; local synthetic data; SQL timing, excludes HTTP', runs: [] };
try {
  docker('run', '-d', '--name', name, '-e', 'POSTGRES_PASSWORD=local-test-only', 'postgres:15-alpine');
  for (let i = 0; i < 30; i++) {
    try { docker('exec', name, 'pg_isready', '-U', 'postgres'); break; } catch { await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  const schema = readFileSync('supabase/schema.sql', 'utf8');
  for (const file of ['supabase/tests/bootstrap.sql', 'supabase/schema.sql']) sql(readFileSync(file, 'utf8'));
  const rankDefinitions = [...schema.matchAll(/CREATE OR REPLACE FUNCTION public\.get_contest_rank\(p_contest_id UUID\)[\s\S]*?\n\$\$;/g)];
  sql(rankDefinitions.at(-2)[0].replace('public.get_contest_rank', 'public.perf_legacy_contest_rank'));
  sql(`INSERT INTO auth.users(id,email) SELECT md5('perf-user-'||n)::uuid,'perf-'||n||'@example.invalid' FROM generate_series(1,100) n;
    INSERT INTO problems(id,slug,title,description) SELECT md5('perf-problem-'||n)::uuid,'perf-'||n,'Perf '||n,'Synthetic' FROM generate_series(1,10) n;
    INSERT INTO contests(id,title,description,start_time,end_time) VALUES(md5('perf-contest')::uuid,'Perf','Synthetic',now()-interval '1 day',now()+interval '1 day');
    INSERT INTO contest_problems(contest_id,problem_id) SELECT md5('perf-contest')::uuid,id FROM problems;
    ALTER TABLE submissions DISABLE TRIGGER USER;`);
  for (const rows of [10000, 100000]) {
    sql(`TRUNCATE submissions CASCADE;
      INSERT INTO submissions(user_id,problem_id,contest_id,language,code,status,score,created_at)
      SELECT md5('perf-user-'||(1+(n%100)))::uuid,md5('perf-problem-'||(1+((n/100)%10)))::uuid,md5('perf-contest')::uuid,
        'cpp','int main(){}',CASE WHEN n%7=0 THEN 'ACCEPTED'::submission_status ELSE 'WRONG_ANSWER'::submission_status END,
        CASE WHEN n%7=0 THEN 100 ELSE 0 END,now()-interval '1 hour'+(n%3000)*interval '1 second' FROM generate_series(1,${rows}) n;
      ANALYZE;`);
    const equivalence = [];
    for (const rule of ['ACM', 'OI']) {
      for (const frozen of [false, true]) {
        sql(`UPDATE contests SET rule_type='${rule}',freeze_at=${frozen ? "now()-interval '30 minutes'" : 'NULL'};`);
        const same = sql(`WITH legacy AS (SELECT * FROM perf_legacy_contest_rank(md5('perf-contest')::uuid)),
          current_rank AS (SELECT * FROM get_contest_rank(md5('perf-contest')::uuid))
          SELECT NOT EXISTS ((SELECT * FROM legacy EXCEPT SELECT * FROM current_rank) UNION ALL
            (SELECT * FROM current_rank EXCEPT SELECT * FROM legacy));`);
        if (same !== 't') throw new Error(`Rank changed: ${rule}, freeze=${frozen}`);
        equivalence.push({ rule, frozen, equal: true });
      }
    }
    report.runs.push({ rows, equivalence });
    sql("UPDATE contests SET rule_type='ACM',freeze_at=NULL;");
    for (const [query, statement] of Object.entries({
      contestRank: "SELECT * FROM get_contest_rank(md5('perf-contest')::uuid)",
      contestRankLegacy: "SELECT * FROM public.perf_legacy_contest_rank(md5('perf-contest')::uuid)",
      globalRank: 'SELECT * FROM user_rank ORDER BY accepted_number DESC,user_id LIMIT 50',
      problemPage: "SELECT get_problem_page(0,20,'','ALL','','ALL','title',false)",
    })) {
      const plans = [];
      for (let i = 0; i < 3; i++) plans.push(JSON.parse(sql(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${statement};`))[0]);
      report.runs.push({ rows, query, executionMs: plans.map(plan => plan['Execution Time']), plans });
      console.log(JSON.stringify({ rows, query, executionMs: plans.map(plan => plan['Execution Time']) }));
    }
  }
  writeFileSync(values.output, JSON.stringify(report, null, 2), { mode: 0o600 });
} finally { docker('rm', '-f', name); }
