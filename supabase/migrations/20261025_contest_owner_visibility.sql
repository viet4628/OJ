-- INSERT RETURNING must check the row's owner directly: a STABLE
-- function querying contests cannot see the newly inserted row.
BEGIN;
DROP POLICY IF EXISTS "Public contests are viewable by everyone" ON public.contests;
CREATE POLICY "Public contests are viewable by everyone" ON public.contests FOR SELECT USING (
  is_public OR (
    public.has_user_permission('contests.manage') AND (
      created_by=auth.uid() OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin')
    )
  ) OR public.can_enter_contest(id)
);
NOTIFY pgrst, 'reload schema';
COMMIT;
