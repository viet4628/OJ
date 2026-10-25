import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProblems, getMyAcceptedProblemIds, type ProblemSummary } from '../../lib/api';

export default function Learning() {
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [solved, setSolved] = useState(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([getProblems(), getMyAcceptedProblemIds()]).then(([rows, ids]) => {
      if (active) { setProblems(rows); setSolved(new Set(ids)); }
    }).catch(() => { if (active) setError('Không tải được lộ trình. Vui lòng thử lại.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  const topics = [...new Set(problems.flatMap(p => p.tags?.length ? p.tags : ['Tổng hợp']))].sort((a,b) => a.localeCompare(b,'vi'));
  const order = { Easy: 0, Medium: 1, Hard: 2 };
  return <div className="space-y-5 text-[var(--text-primary)]">
    <Link to="/problems" className="text-sm text-[var(--accent)]">Về ngân hàng bài</Link>
    <h1 className="text-xl font-semibold">Luyện theo chủ đề</h1>
    <p className="text-sm text-[var(--text-secondary)]">Chọn chủ đề và luyện từ dễ đến khó. Tiến độ dựa trên bài đã được chấm AC; đăng nhập để ghi nhận kết quả.</p>
    {loading ? <p role="status">Đang tải lộ trình...</p> : error ? <div role="alert">{error} <button onClick={() => setAttempt(v => v+1)}>Thử lại</button></div> : !topics.length ? <p>Chưa có bài tập công khai.</p> : topics.map(topic => {
      const rows = problems.filter(p => (p.tags?.length ? p.tags : ['Tổng hợp']).includes(topic))
        .sort((a,b) => order[a.difficulty] - order[b.difficulty] || a.title.localeCompare(b.title,'vi'));
      const completed = rows.filter(p => solved.has(p.id)).length;
      return <section key={topic} className="border border-[var(--border)] rounded-md p-4 space-y-3">
        <div className="flex justify-between gap-4"><h2 className="font-semibold">{topic}</h2><span className="text-sm">{completed}/{rows.length} bài đã giải</span></div>
        <progress className="w-full accent-[var(--accent)]" max={rows.length} value={completed} aria-label={`Tiến độ ${topic}`} />
        <ol className="space-y-2">{rows.map(p => <li key={p.id} className="flex justify-between gap-4 text-sm">
          <Link className="text-[var(--accent)] hover:underline" to={`/problems/${p.slug}`}>{p.title}</Link>
          <span className="text-[var(--text-secondary)]">{solved.has(p.id) ? 'Đã giải' : p.difficulty === 'Easy' ? 'Dễ' : p.difficulty === 'Medium' ? 'Trung bình' : 'Khó'}</span>
        </li>)}</ol>
      </section>;
    })}
  </div>;
}
