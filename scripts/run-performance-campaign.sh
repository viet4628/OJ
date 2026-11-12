#!/usr/bin/env bash
# One campaign at a time; use the existing single worker, never start another daemon.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p docs/reports
exec 9>/tmp/codejudge-performance-campaign.lock
flock -n 9
campaign="docs/reports/performance-campaign-$(date -u +%Y%m%dT%H%M%SZ)"
status_file="${campaign}.status.json"
stage=starting
child=
run_node() {
  node "$@" &
  child=$!
  wait "$child"
  child=
}
stop() {
  if [[ -n "$child" ]]; then kill -TERM "$child" 2>/dev/null || true; wait "$child" || true; fi
  exit 143
}
update_status() {
  node -e 'const fs=require("node:fs");const [file,status,stage,code,pid]=process.argv.slice(1);fs.writeFileSync(file,JSON.stringify({at:new Date().toISOString(),status,stage,exitCode:Number(code),pid:Number(pid)},null,2),{mode:0o600});' "$status_file" "$1" "$stage" "$2" "$$"
}
finish() {
  code=$?
  if ((code == 0)); then update_status completed "$code"; else update_status failed "$code"; fi
}
trap finish EXIT
trap stop TERM INT
stage=health-30m
update_status running 0
run_node scripts/health.mjs --duration 1800 --interval 15 --output "${campaign}-health.jsonl" > "${campaign}-health-summary.json"
# Do not overlap standalone load/smoke scripts with this campaign's load stages.
for round in 1 2; do
  for users in 5 10 20; do
    stage="load-${users}-round-${round}"
    update_status running 0
    run_node apps/judge-worker/scripts/load-staging.mjs --users "$users" --duration 600 \
      --languages cpp,python,rust --cases 10 --storage --input-bytes 65536 --tle-every 10 \
      --output "${campaign}-${stage}.json"
  done
done
stage=soak-24h
update_status running 0
run_node apps/judge-worker/scripts/load-staging.mjs --users 5 --duration 86400 \
  --languages cpp,python,rust --cases 10 --storage --input-bytes 65536 --tle-every 10 \
  --output "${campaign}-${stage}.json"
stage=complete
