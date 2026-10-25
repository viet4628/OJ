import assert from 'node:assert/strict';

// Assertions cross the same REST/RPC interface as the browser. Service-role
// requests only prepare fixtures; observations use the student's JWT.
export async function checkPlatform(request, token, fixture = {}) {
  const classroom = fixture.classroom || '30000000-0000-0000-0000-000000000001';
  const problem = fixture.problem || '10000000-0000-0000-0000-000000000001';
  const user = fixture.user || '00000000-0000-0000-0000-000000000002';
  const teacherId = fixture.teacherId || '00000000-0000-0000-0000-000000000003';
  const adminId = fixture.adminId || '00000000-0000-0000-0000-000000000004';
  const contest = fixture.contest || '20000000-0000-0000-0000-000000000001';
  const student = token('authenticated', user);
  const past = new Date(Date.now() - 86400_000).toISOString();
  const earlier = new Date(Date.now() - 2 * 86400_000).toISOString();
  await request('classroom_problems', undefined, 'POST', { classroom_id: classroom, problem_id: problem, created_at: earlier });
  await request('rpc/join_classroom', student, 'POST', { p_code: fixture.code || 'PILOT1' });
  await request(`classroom_members?classroom_id=eq.${classroom}&user_id=eq.${user}`, undefined, 'PATCH', { joined_at: earlier });
  for (const [classroom_id, status, score] of [[null, 'ACCEPTED', 100], [classroom, 'WRONG_ANSWER', 20]]) {
    await request('submissions', undefined, 'POST', { user_id: user, problem_id: problem, classroom_id,
      language: 'cpp', code: 'int main(){}', status, score, created_at: past });
  }
  const rows = await request('rpc/get_classroom_progress', student, 'POST', { p_classroom_id: classroom });
  assert.equal(rows.length, 1, 'one class result per student/problem');
  assert.equal(rows[0].score, 20, 'global practice AC must not count as class credit');
  assert.equal(rows[0].status, 'WRONG_ANSWER');
  assert(!('code' in rows[0]) && !('details' in rows[0]), 'class progress must not expose code or hidden results');
  await assert.rejects(request('rpc/get_classroom_progress', token('anon'), 'POST', { p_classroom_id: classroom }));
  await assert.rejects(request('submissions', student, 'POST', { user_id: user, problem_id: problem,
    classroom_id: classroom, contest_id: contest, language: 'cpp', code: 'int main(){}' }),
    'one submission cannot count simultaneously for a class and a contest');
  console.log('PASS platform: class progress excludes global practice; member sees score, anon is denied');

  const teacher = token('authenticated', teacherId);
  const draft = { title: 'Bài có lời giải', slug: fixture.slug || 'editorial-test', description: 'Cộng hai số',
    difficulty: 'Easy', time_limit_ms: 1000, memory_limit_mb: 256, tags: [], samples: [], is_public: true };
  const cases = [{ input_content: '3 4', output_content: '7', score: 100, is_sample: false }];
  const saved = await request('rpc/save_problem_bundle', teacher, 'POST', {
    p_problem_id: null, p_problem: draft, p_testcases: cases, p_editorial: 'Cộng hai số bằng toán tử +.',
  });
  const [readBack] = await request(`problems?id=eq.${saved}`, teacher);
  assert.equal(readBack.title, draft.title);
  const editorial = await request('rpc/get_problem_editorial', teacher, 'POST', { p_problem_id: saved });
  assert.equal(editorial, 'Cộng hai số bằng toán tử +.');
  await assert.rejects(request('rpc/save_problem_bundle', teacher, 'POST', {
    p_problem_id: saved, p_problem: { ...draft, title: 'Không được lưu một nửa' },
    p_testcases: [{ ...cases[0], score: -1 }], p_editorial: 'Không được thay đổi',
  }));
  assert.equal((await request(`problems?id=eq.${saved}`, teacher))[0].title, draft.title, 'failed validation rolls back problem changes');
  assert.equal(await request('rpc/get_problem_editorial', student, 'POST', { p_problem_id: saved }), null, 'unsolved editorial stays private');
  assert.deepEqual(await request('problem_editorials', student), [], 'direct table access cannot bypass editorial gate');
  await request('submissions', undefined, 'POST', { user_id: user, problem_id: saved, language: 'cpp', code: 'int main(){}', status: 'ACCEPTED', score: 100, created_at: past });
  assert.equal(await request('rpc/get_problem_editorial', student, 'POST', { p_problem_id: saved }), editorial, 'solved problem unlocks explanation');
  await request('contest_problems', undefined, 'POST', { contest_id: contest, problem_id: saved });
  assert.equal(await request('rpc/get_problem_editorial', student, 'POST', { p_problem_id: saved }), null, 'active contest locks explanation even after a practice AC');
  await request('submissions?problem_id=eq.' + saved, undefined, 'DELETE');
  console.log('PASS platform: problem, testcases and editorial save and reload through public interfaces');

  const [restricted] = await request('contests', undefined, 'POST', { title: 'Thi cần duyệt', description: 'Registration test',
    created_by: teacherId,
    registration_required: true, is_public: true, start_time: new Date(Date.now() - 3600_000).toISOString(),
    end_time: new Date(Date.now() + 3600_000).toISOString() });
  await request('contest_problems', undefined, 'POST', { contest_id: restricted.id, problem_id: saved });
  const entry = { p_contest_id: restricted.id, p_problem_id: saved, p_language: 'cpp', p_code: 'int main(){}' };
  await assert.rejects(request('rpc/create_contest_submission', student, 'POST', entry), 'registration required before contest submit');
  assert.equal(await request('rpc/register_contest', student, 'POST', { p_contest_id: restricted.id }), 'PENDING');
  await assert.rejects(request('rpc/create_contest_submission', student, 'POST', entry), 'pending registration is not approval');
  await request('rpc/review_contest_registration', teacher, 'POST', { p_contest_id: restricted.id, p_user_id: user, p_approved: true });
  const [allowed] = await request('rpc/create_contest_submission', student, 'POST', entry);
  assert(allowed.id, 'approved participant can submit');
  await request('submissions?id=eq.' + allowed.id, undefined, 'DELETE');
  console.log('PASS platform: contest submit requires approved registration');

  await request('contests?id=eq.' + restricted.id, undefined, 'PATCH', { freeze_at: new Date(Date.now() - 1800_000).toISOString() });
  await request('submissions', undefined, 'POST', { user_id: user, problem_id: saved, contest_id: restricted.id,
    language: 'cpp', code: 'int main(){}', status: 'ACCEPTED', score: 100, created_at: new Date(Date.now() - 600_000).toISOString() });
  assert.deepEqual(await request('rpc/get_contest_rank', student, 'POST', { p_contest_id: restricted.id }), [], 'frozen standings exclude post-freeze activity');
  assert.equal((await request('rpc/get_contest_rank', teacher, 'POST', { p_contest_id: restricted.id })).length, 1, 'manager can inspect live standings');
  console.log('PASS platform: frozen standings hide new results from contestants, retain manager view');

  const [terminal] = await request('submissions?contest_id=eq.' + restricted.id, teacher);
  await assert.rejects(request('rpc/rejudge_submission', student, 'POST', { p_submission_id: terminal.id }), 'student cannot request rejudge');
  await request('rpc/rejudge_submission', teacher, 'POST', { p_submission_id: terminal.id });
  const [queued] = await request('submissions?id=eq.' + terminal.id, student);
  assert.equal(queued.status, 'PENDING');
  assert.equal(queued.score, 0);
  await assert.rejects(request('rpc/rejudge_submission', teacher, 'POST', { p_submission_id: terminal.id }), 'cannot rejudge an active job');
  const audit = await request('admin_audit_log?action=eq.submission.rejudge', teacher);
  assert.equal(audit[0].target_id, terminal.id);
  await request('submissions?id=eq.' + terminal.id, undefined, 'DELETE');
  console.log('PASS platform: authorized rejudge resets result, rejects active jobs and records audit');

  const admin = token('authenticated', adminId);
  const suspension = { p_user_id: user, p_suspended: true, p_reason: 'Lạm dụng nộp bài' };
  await assert.rejects(request('rpc/set_account_suspension', student, 'POST', suspension));
  await request('rpc/set_account_suspension', admin, 'POST', suspension);
  assert.equal((await request('profiles?id=eq.' + user, student))[0].is_suspended, true);
  await assert.rejects(request('profiles?id=eq.' + user, student, 'PATCH', { is_suspended: false }), 'cannot unban oneself with an old JWT');
  await assert.rejects(request('submissions', student, 'POST', { user_id: user, problem_id: problem, language: 'cpp', code: 'int main(){}' }), 'suspension blocks writes even with an old JWT');
  await assert.rejects(request('rpc/get_classroom_progress', student, 'POST', { p_classroom_id: classroom }), 'suspended membership must not grant private class access');
  await assert.rejects(request('profiles?id=eq.' + user, admin, 'PATCH', { is_suspended: false }), 'suspension changes must go through the audited RPC');
  const logs = await request('admin_audit_log?action=eq.account.suspend', admin);
  assert.equal(logs[0].target_id, user);
  await request('rpc/set_account_suspension', admin, 'POST', { ...suspension, p_suspended: false });
  const [resumed] = await request('submissions', student, 'POST', { user_id: user, problem_id: problem, language: 'cpp', code: 'int main(){}' });
  assert(resumed.id);
  await request('submissions?id=eq.' + resumed.id, undefined, 'DELETE');
  console.log('PASS platform: admin suspension blocks stale-JWT writes and self-unban, logs changes, restores access');
  await request('profiles?id=eq.' + teacherId, admin, 'PATCH', { role: 'user' });
  assert.equal((await request('admin_audit_log?action=eq.profile.role', admin))[0]?.target_id, teacherId, 'role changes must be auditable');
  await request('profiles?id=eq.' + teacherId, admin, 'PATCH', { role: 'teacher' });
  assert((await request('admin_audit_log?action=eq.permissions.change', admin)).length >= 1, 'permission changes must be auditable');
  console.log('PASS platform: role and permission changes produce immutable audit entries');

  const validation = { p_problem_id: saved, p_language: 'cpp', p_code: '#include <cstdio>\nint main(){int a,b;scanf("%d%d",&a,&b);printf("%d",a+b);}' };
  await assert.rejects(request('rpc/validate_problem_solution', student, 'POST', validation), 'student cannot trigger reference checks');
  const validationId = await request('rpc/validate_problem_solution', teacher, 'POST', validation);
  const [job] = await request('submissions?id=eq.' + validationId, teacher);
  assert.equal(job.status, 'PENDING');
  assert.equal(job.is_run, true, 'reference checks cannot affect history/ranks');
  assert.equal(job.is_validation, true, 'validation runs execute the stored hidden suite rather than custom stdin');
  assert.deepEqual(await request('submissions?id=eq.' + validationId, student), [], 'reference source code is private');
  await request('submissions?id=eq.' + validationId, undefined, 'DELETE');
  console.log('PASS platform: staff reference checks queue the full test suite without exposing code or affecting rank');
}
