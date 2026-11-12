BEGIN;

-- Problem/testcase content is written only through save_problem_bundle, which
-- validates limits and refuses edits while submissions are judging. Direct
-- REST writes stay open for problem deletion (guarded) and service_role only.
-- NOT VALID: existing rows are not rechecked; any later update must comply.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.problems'::regclass AND conname='problems_resource_limits_valid') THEN
    ALTER TABLE public.problems ADD CONSTRAINT problems_resource_limits_valid
      CHECK (time_limit_ms BETWEEN 10 AND 30000 AND memory_limit_mb BETWEEN 16 AND 1024) NOT VALID;
  END IF;
END $$;
REVOKE INSERT, UPDATE, DELETE ON public.testcases FROM anon, authenticated;
REVOKE INSERT, UPDATE ON public.problems FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
