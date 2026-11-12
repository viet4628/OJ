import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { difficultyLabels } from '../../components/ProblemDifficulty';
import { getProblems, getMyAcceptedProblemIds, getPublicTracks, trackProgress, type LearningTrack, type ProblemSummary } from '../../lib/api';

/** Track completion bar; `value`/`max` stay readable to assistive tech. */
export function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}
    className="h-1.5 w-full rounded-full bg-tertiary overflow-hidden">
    <div className="h-full rounded-full bg-[var(--accent)] transition-[width]" style={{ width: `${percent}%` }} />
  </div>;
}

export default function Learning() {
  const [tracks, setTracks] = useState<LearningTrack[]>([]);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [solved, setSolved] = useState(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([getPublicTracks(), getProblems(), getMyAcceptedProblemIds()]).then(([trackRows, rows, ids]) => {
      if (active) { setTracks(trackRows); setProblems(rows); setSolved(new Set(ids)); }
    }).catch(() => { if (active) setError('Không tải được lộ trình. Vui lòng thử lại.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  const topics = [...new Set(problems.flatMap(p => p.tags?.length ? p.tags : ['Tổng hợp']))].sort((a, b) => a.localeCompare(b, 'vi'));
  const order = { Easy: 0, Medium: 1, Hard: 2 };

  return <div className="space-y-6 text-[var(--text-primary)]">
    <div className="space-y-1">
      <Link to="/problems" className="text-xs text-[var(--accent-text)] hover:underline">Về ngân hàng bài</Link>
      <h1 className="text-xl font-semibold">Luyện theo chủ đề</h1>
      <p className="text-sm text-[var(--text-secondary)]">Đi theo lộ trình đã sắp xếp từ dễ đến khó, hoặc chọn một nhãn để ôn riêng. Tiến độ tính theo bài đã AC; đăng nhập để ghi nhận kết quả.</p>
    </div>
    {loading ? <p role="status" className="text-sm">Đang tải lộ trình...</p>
      : error ? <div role="alert" className="text-sm">{error} <button type="button" className="underline" onClick={() => setAttempt(v => v + 1)}>Thử lại</button></div>
      : <>
        <section aria-labelledby="tracks-heading" className="space-y-3">
          <h2 id="tracks-heading" className="text-base font-semibold">Lộ trình</h2>
          {!tracks.length ? <p className="text-sm text-[var(--text-secondary)]">Chưa có lộ trình nào. Bạn có thể luyện theo nhãn bên dưới.</p>
            : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tracks.map(track => {
                const { done, total, next } = trackProgress(track, solved);
                return <Link key={track.id} to={`/learn/${track.slug}`}
                  className="block rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] p-4 space-y-3 hover:border-accent/50 transition-colors">
                  <div className="space-y-1">
                    <h3 className="font-semibold">{track.title}</h3>
                    {track.description && <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{track.description}</p>}
                  </div>
                  <ProgressBar done={done} total={total} label={`Tiến độ ${track.title}`} />
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-[var(--text-secondary)]">{done}/{total} bài</span>
                    <span className="truncate text-[var(--accent-text)]">{total === 0 ? 'Chưa có bài' : next ? `Tiếp theo: ${next.title}` : 'Đã hoàn thành'}</span>
                  </div>
                </Link>;
              })}
            </div>}
        </section>

        <section aria-labelledby="tags-heading" className="space-y-3">
          <h2 id="tags-heading" className="text-base font-semibold">Theo nhãn</h2>
          {!topics.length ? <p className="text-sm">Chưa có bài tập công khai.</p> : topics.map(topic => {
            const rows = problems.filter(p => (p.tags?.length ? p.tags : ['Tổng hợp']).includes(topic))
              .sort((a, b) => order[a.difficulty] - order[b.difficulty] || a.title.localeCompare(b.title, 'vi'));
            const completed = rows.filter(p => solved.has(p.id)).length;
            return <section key={topic} className="border border-[var(--border)] rounded-md p-4 space-y-3">
              <div className="flex justify-between gap-4"><h3 className="font-semibold">{topic}</h3><span className="text-sm">{completed}/{rows.length} bài đã giải</span></div>
              <ProgressBar done={completed} total={rows.length} label={`Tiến độ ${topic}`} />
              <ol className="space-y-2">{rows.map(p => <li key={p.id} className="flex justify-between gap-4 text-sm">
                <Link className="text-[var(--accent-text)] hover:underline" to={`/problems/${p.slug}`}>{p.title}</Link>
                <span className="text-[var(--text-secondary)]">{solved.has(p.id) ? 'Đã giải' : difficultyLabels[p.difficulty]}</span>
              </li>)}</ol>
            </section>;
          })}
        </section>
      </>}
  </div>;
}
