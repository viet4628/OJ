import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getContest, getContestProblems, type Contest, type Problem } from '../../lib/api';
import ProblemDetail from './ProblemDetail';

export default function ContestProblem({ user, onOpenAuth }: {
  user: { id?: string; username: string; rating: number } | null;
  onOpenAuth: () => void;
}) {
  const { id, pid } = useParams<{ id: string; pid: string }>();
  const [contest, setContest] = useState<Contest | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getContest(id!), getContestProblems(id!)])
      .then(([c, rows]) => {
        if (cancelled) return;
        setContest(c);
        setProblem(rows.find(row => row.problem_id === pid)?.problems || null);
      })
      .catch(() => { if (!cancelled) { setContest(null); setProblem(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, pid, retry]);

  if (loading) return <div role="status" className="h-screen flex items-center justify-center text-sm text-[var(--text-secondary)]">Đang tải bài tập trong kỳ thi...</div>;
  if (!contest || !problem) return (
    <div className="h-screen flex flex-col items-center justify-center gap-3 text-sm text-[var(--text-secondary)]">
      <p role="alert">Không tải được bài tập trong kỳ thi. Bài có thể chưa mở hoặc bạn chưa có quyền tham gia.</p>
      <button onClick={() => setRetry(value => value + 1)} className="rounded-md border border-[var(--border)] px-3 py-1">Thử lại</button>
      <Link to={`/contests/${id}`} className="text-[var(--accent-text)]">Về kỳ thi</Link>
    </div>
  );

  return <ProblemDetail key={`${id}:${pid}`} user={user} onOpenAuth={onOpenAuth} contest={contest} contestProblem={problem} />;
}
