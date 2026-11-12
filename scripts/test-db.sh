#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="codejudge-db-test-$$"
log=$(mktemp)
trap 'docker rm -f "$container" >/dev/null 2>&1; rm -f "$log"' EXIT
# No host port, no persistent volume, no production credentials.
docker run -d --name "$container" -e POSTGRES_PASSWORD=local-test-only postgres:15-alpine > /dev/null
for attempt in {1..30}; do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
for file in supabase/tests/bootstrap.sql supabase/schema.sql supabase/seed.sql supabase/schema.sql supabase/seed.sql supabase/migrations/20261025_starter_codes.sql supabase/migrations/20261025_starter_codes.sql supabase/migrations/20261025_contest_ownership.sql supabase/migrations/20261025_contest_ownership.sql supabase/migrations/20261025_contest_owner_visibility.sql supabase/migrations/20261025_contest_owner_visibility.sql supabase/migrations/20261025_performance.sql supabase/migrations/20261025_performance.sql supabase/migrations/20261113_problem_write_path.sql supabase/migrations/20261113_problem_write_path.sql supabase/migrations/20261113_problem_ownership.sql supabase/migrations/20261113_problem_ownership.sql supabase/migrations/20261113_queue_position.sql supabase/migrations/20261113_queue_position.sql supabase/migrations/20261113_learning_tracks.sql supabase/migrations/20261113_learning_tracks.sql supabase/tests/security.sql supabase/tests/contest-ownership.sql supabase/tests/performance.sql supabase/tests/problem-ownership.sql supabase/tests/learning-tracks.sql; do
  if ! docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < "$file" > "$log" 2>&1; then
    cat "$log"
    exit 1
  fi
  echo "PASS $file"
done
