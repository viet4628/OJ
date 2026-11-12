BEGIN;

-- Contest reward catalog: cosmetics drawn by the web app from a stable id
-- (no uploads). Equipped items are public on profiles.
CREATE TABLE IF NOT EXISTS public.rewards (
  id TEXT PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind TEXT NOT NULL CHECK (kind IN ('frame', 'banner')),
  tier TEXT NOT NULL CHECK (tier IN ('gold', 'silver', 'bronze', 'participant')),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reward catalog is public" ON public.rewards;
CREATE POLICY "Reward catalog is public" ON public.rewards FOR SELECT USING (true);
REVOKE ALL ON public.rewards FROM anon, authenticated;
GRANT SELECT ON public.rewards TO anon, authenticated;
GRANT ALL ON public.rewards TO service_role;
INSERT INTO public.rewards (id, kind, tier, name, sort_order) VALUES
  ('frame-gold', 'frame', 'gold', 'Khung Vàng', 1),
  ('frame-silver', 'frame', 'silver', 'Khung Bạc', 2),
  ('frame-bronze', 'frame', 'bronze', 'Khung Đồng', 3),
  ('frame-participant', 'frame', 'participant', 'Khung Chiến binh', 4),
  ('banner-gold', 'banner', 'gold', 'Nền Hoàng kim', 5),
  ('banner-silver', 'banner', 'silver', 'Nền Bạch kim', 6),
  ('banner-bronze', 'banner', 'bronze', 'Nền Hổ phách', 7),
  ('banner-participant', 'banner', 'participant', 'Nền Chiến binh', 8)
ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, tier = EXCLUDED.tier, name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipped_frame TEXT REFERENCES public.rewards(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipped_banner TEXT REFERENCES public.rewards(id);

CREATE OR REPLACE VIEW public.profiles_public AS
SELECT id,
  CASE WHEN id = auth.uid() OR public.has_user_permission('users.manage') THEN email ELSE '' END AS email,
  COALESCE(NULLIF(full_name, email), 'user-' || left(id::text, 8)) AS full_name,
  avatar_url, role, created_at, equipped_frame, equipped_banner
FROM public.profiles;
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Contest rewards: the contest owner sets rank rules; after the contest ends
-- award_contest_rewards grants them from the final (unfrozen) ranking.
ALTER TABLE public.contests ADD COLUMN IF NOT EXISTS rewards_awarded_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS public.contest_rewards (
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  reward_id TEXT NOT NULL REFERENCES public.rewards(id),
  max_rank INT CHECK (max_rank IS NULL OR max_rank BETWEEN 1 AND 100000), -- NULL: every participant
  PRIMARY KEY (contest_id, reward_id)
);
CREATE TABLE IF NOT EXISTS public.user_rewards (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_id TEXT NOT NULL REFERENCES public.rewards(id),
  contest_id UUID REFERENCES public.contests(id) ON DELETE SET NULL,
  contest_title TEXT NOT NULL,
  rank INT NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_rewards_once ON public.user_rewards(user_id, reward_id, contest_id);
CREATE INDEX IF NOT EXISTS idx_user_rewards_user ON public.user_rewards(user_id, awarded_at DESC);
ALTER TABLE public.contest_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Contest rewards follow contest visibility" ON public.contest_rewards;
CREATE POLICY "Contest rewards follow contest visibility" ON public.contest_rewards FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.contests c WHERE c.id = contest_id));
DROP POLICY IF EXISTS "Earned rewards are public" ON public.user_rewards;
CREATE POLICY "Earned rewards are public" ON public.user_rewards FOR SELECT USING (true);
REVOKE ALL ON public.contest_rewards, public.user_rewards FROM anon, authenticated;
GRANT SELECT ON public.contest_rewards, public.user_rewards TO anon, authenticated;
GRANT ALL ON public.contest_rewards, public.user_rewards TO service_role;

CREATE OR REPLACE FUNCTION public.set_contest_rewards(p_contest_id UUID, p_rules JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rule JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Bạn không có quyền đặt phần thưởng cho kỳ thi này';
  END IF;
  IF p_rules IS NULL OR jsonb_typeof(p_rules) <> 'array' OR jsonb_array_length(p_rules) > 8 THEN
    RAISE EXCEPTION 'Luật phần thưởng không hợp lệ (tối đa 8 luật)';
  END IF;
  DELETE FROM public.contest_rewards WHERE contest_id = p_contest_id;
  FOR v_rule IN SELECT * FROM jsonb_array_elements(p_rules) LOOP
    INSERT INTO public.contest_rewards (contest_id, reward_id, max_rank)
    VALUES (p_contest_id, v_rule->>'reward_id', NULLIF(v_rule->>'max_rank', '')::int);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_contest_rewards(p_contest_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_contest public.contests%ROWTYPE; v_count INT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_contest(p_contest_id) THEN
    RAISE EXCEPTION 'Bạn không có quyền trao giải kỳ thi này';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF now() < v_contest.end_time THEN RAISE EXCEPTION 'Chỉ trao giải sau khi kỳ thi kết thúc'; END IF;
  IF EXISTS (SELECT 1 FROM public.submissions WHERE contest_id = p_contest_id AND status IN ('PENDING', 'JUDGING')) THEN
    RAISE EXCEPTION 'Còn bài đang chấm, hãy trao giải sau khi chấm xong';
  END IF;
  -- The caller manages the contest, so get_contest_rank returns the unfrozen
  -- final standings. Staff accounts do not win; ranked prizes need a positive
  -- result, participation prizes (max_rank NULL) only a submission.
  WITH standings AS (
    SELECT r.user_id,
      CASE WHEN v_contest.rule_type = 'ACM' THEN r.accepted_number ELSE r.total_score END AS result,
      CASE WHEN v_contest.rule_type = 'ACM' THEN r.total_time_seconds ELSE 0 END AS penalty
    FROM public.get_contest_rank(p_contest_id) r
    JOIN public.profiles p ON p.id = r.user_id AND p.role = 'user'
  ), ranked AS (
    SELECT user_id, result, rank() OVER (ORDER BY result DESC, penalty ASC)::int AS final_rank FROM standings
  ), tiered AS (
    -- Per kind, only the best tier reached: gold <=1, silver <=3 gives rank 2-3 silver only.
    SELECT DISTINCT ON (ranked.user_id, rw.kind) ranked.user_id, cr.reward_id, ranked.final_rank
    FROM ranked
    JOIN public.contest_rewards cr ON cr.contest_id = p_contest_id AND cr.max_rank IS NOT NULL
    JOIN public.rewards rw ON rw.id = cr.reward_id
    WHERE ranked.final_rank <= cr.max_rank AND ranked.result > 0
    ORDER BY ranked.user_id, rw.kind, cr.max_rank
  ), participation AS (
    SELECT ranked.user_id, cr.reward_id, ranked.final_rank
    FROM ranked JOIN public.contest_rewards cr ON cr.contest_id = p_contest_id AND cr.max_rank IS NULL
  )
  INSERT INTO public.user_rewards (user_id, reward_id, contest_id, contest_title, rank)
  SELECT user_id, reward_id, p_contest_id, v_contest.title, final_rank FROM tiered
  UNION ALL
  SELECT user_id, reward_id, p_contest_id, v_contest.title, final_rank FROM participation
  ON CONFLICT (user_id, reward_id, contest_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE public.contests SET rewards_awarded_at = now() WHERE id = p_contest_id;
  INSERT INTO public.admin_audit_log (actor_id, action, target_id, payload)
    VALUES (auth.uid(), 'contest.award_rewards', p_contest_id, jsonb_build_object('awarded', v_count));
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.equip_reward(p_kind TEXT, p_reward_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR p_kind NOT IN ('frame', 'banner') THEN RAISE EXCEPTION 'Yêu cầu không hợp lệ'; END IF;
  IF p_reward_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_rewards ur JOIN public.rewards r ON r.id = ur.reward_id
    WHERE ur.user_id = auth.uid() AND ur.reward_id = p_reward_id AND r.kind = p_kind
  ) THEN RAISE EXCEPTION 'Bạn chưa sở hữu phần thưởng này'; END IF;
  IF p_kind = 'frame' THEN UPDATE public.profiles SET equipped_frame = p_reward_id WHERE id = auth.uid();
  ELSE UPDATE public.profiles SET equipped_banner = p_reward_id WHERE id = auth.uid(); END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_contest_rewards(UUID, JSONB), public.award_contest_rewards(UUID), public.equip_reward(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_contest_rewards(UUID, JSONB), public.award_contest_rewards(UUID), public.equip_reward(TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
