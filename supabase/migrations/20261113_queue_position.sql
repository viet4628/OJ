BEGIN;

-- Queue feedback: position of the caller's own PENDING submission (1 = next).
-- Uses the partial PENDING index; reveals only a count, never other rows.
CREATE OR REPLACE FUNCTION public.get_queue_position(p_submission_id UUID)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*) FROM public.submissions q
          WHERE q.status = 'PENDING' AND (q.created_at, q.id) < (s.created_at, s.id))::int + 1
  FROM public.submissions s
  WHERE s.id = p_submission_id AND s.status = 'PENDING' AND s.user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_queue_position(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_queue_position(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
