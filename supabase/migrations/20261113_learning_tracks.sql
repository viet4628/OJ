BEGIN;

-- Learning tracks: curated, ordered problem sets ("Nhập môn lập trình",
-- "Sắp xếp", ...). Ownership mirrors contests/problems: a teacher manages the
-- tracks they created, admins manage all. Learners see public tracks only.
CREATE TABLE IF NOT EXISTS public.learning_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 100),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 5000),
  sort_order INT NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by UUID DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.learning_track_problems (
  track_id UUID NOT NULL REFERENCES public.learning_tracks(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (track_id, problem_id)
);
CREATE INDEX IF NOT EXISTS idx_learning_track_problems_problem ON public.learning_track_problems(problem_id);
ALTER TABLE public.learning_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_track_problems ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_track(p_track_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_user_permission('problems.manage') AND EXISTS (
    SELECT 1 FROM public.learning_tracks t WHERE t.id = p_track_id AND (
      t.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );
$$;
REVOKE ALL ON FUNCTION public.can_manage_track(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_track(UUID) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Public or managed tracks are readable" ON public.learning_tracks;
CREATE POLICY "Public or managed tracks are readable" ON public.learning_tracks FOR SELECT
  USING (is_public OR public.can_manage_track(id));
DROP POLICY IF EXISTS "Track managers delete" ON public.learning_tracks;
CREATE POLICY "Track managers delete" ON public.learning_tracks FOR DELETE USING (public.can_manage_track(id));
DROP POLICY IF EXISTS "Track problems follow track visibility" ON public.learning_track_problems;
CREATE POLICY "Track problems follow track visibility" ON public.learning_track_problems FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.learning_tracks t WHERE t.id = track_id AND (t.is_public OR public.can_manage_track(t.id))));
-- Writes go through save_learning_track (atomic, validated); deletion via RLS.
REVOKE ALL ON public.learning_tracks, public.learning_track_problems FROM anon, authenticated;
GRANT SELECT ON public.learning_tracks, public.learning_track_problems TO anon, authenticated;
GRANT DELETE ON public.learning_tracks TO authenticated;
GRANT ALL ON public.learning_tracks, public.learning_track_problems TO service_role;
DO $$ DECLARE v_table TEXT; BEGIN
  FOREACH v_table IN ARRAY ARRAY['learning_tracks','learning_track_problems'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS guard_active_actor ON public.%I', v_table);
    EXECUTE format('CREATE TRIGGER guard_active_actor BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_active_actor()', v_table);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.save_learning_track(p_track_id UUID, p_track JSONB, p_problem_ids UUID[])
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID := COALESCE(p_track_id, gen_random_uuid());
  v_problem UUID;
  v_position INT := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_user_permission('problems.manage') THEN
    RAISE EXCEPTION 'Bạn không có quyền quản lý lộ trình';
  END IF;
  IF p_track_id IS NOT NULL AND NOT public.can_manage_track(p_track_id) THEN
    RAISE EXCEPTION 'Bạn chỉ sửa được lộ trình do mình tạo';
  END IF;
  IF p_track IS NULL OR jsonb_typeof(p_track) <> 'object' OR cardinality(COALESCE(p_problem_ids, '{}')) > 200 THEN
    RAISE EXCEPTION 'Dữ liệu lộ trình không hợp lệ (tối đa 200 bài)';
  END IF;
  INSERT INTO public.learning_tracks (id, slug, title, description, sort_order, is_public, created_by)
  VALUES (v_id, p_track->>'slug', trim(COALESCE(p_track->>'title', '')), COALESCE(p_track->>'description', ''),
    COALESCE((p_track->>'sort_order')::int, 0), COALESCE((p_track->>'is_public')::boolean, false), auth.uid())
  ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, title = EXCLUDED.title, description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order, is_public = EXCLUDED.is_public;
  DELETE FROM public.learning_track_problems WHERE track_id = v_id;
  FOREACH v_problem IN ARRAY COALESCE(p_problem_ids, '{}') LOOP
    IF NOT EXISTS (SELECT 1 FROM public.problems p WHERE p.id = v_problem AND (p.is_public OR public.can_manage_problem(p.id))) THEN
      RAISE EXCEPTION 'Chỉ thêm được đề công khai hoặc đề do bạn tạo';
    END IF;
    INSERT INTO public.learning_track_problems (track_id, problem_id, sort_order) VALUES (v_id, v_problem, v_position)
      ON CONFLICT (track_id, problem_id) DO NOTHING;
    v_position := v_position + 1;
  END LOOP;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_learning_track(UUID, JSONB, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_learning_track(UUID, JSONB, UUID[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
