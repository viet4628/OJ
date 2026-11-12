import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProblemDifficulty from '../../components/ProblemDifficulty';
import { getMyAcceptedProblemIds, getTrackBySlug, trackProgress, type LearningTrack } from '../../lib/api';
import { ProgressBar } from './Learning';

export default function TrackDetail() {
  const { slug = '' } = useParams();
  const [track, setTrack] = useState<LearningTrack | null>(null);
  const [solved, setSolved] = useState(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([getTrackBySlug(slug), getMyAcceptedProblemIds()]).then(([row, ids]) => {
      if (active) { setTrack(row); setSolved(new Set(ids)); }
    }).catch(() => { if (active) setError('Không tải được lộ trình. Vui lòng thử lại.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, attempt]);

  if (loading) return <p role="status" className="text-sm">Đang tải lộ trình...</p>;
  if (error) return <div role="alert" className="text-sm">{error} <button type="button" className="underline" onClick={() => setAttempt(v => v + 1)}>Thử lại</button></div>;
  if (!track) return <div className="space-y-2 text-sm"><p>Không tìm thấy lộ trình.</p><Link to="/learn" className="text-[var(--accent-text)] hover:underline">Về danh sách lộ trình</Link></div>;

  const { done, total, next } = trackProgress(track, solved);
  return <div className="space-y-5 text-[var(--text-primary)]">
    <Link to="/learn" className="text-xs text-[var(--accent-text)] hover:underline">Về luyện theo chủ đề</Link>
    <header className="rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] p-5 space-y-3">
      <h1 className="text-xl font-semibold">{track.title}</h1>
      {track.description && <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line">{track.description}</p>}
      <ProgressBar done={done} total={total} label={`Tiến độ ${track.title}`} />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-[var(--text-secondary)]">Đã giải {done}/{total} bài</span>
        {next ? <Link to={`/problems/${next.slug}`} className="px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium">Làm bài tiếp theo: {next.title}</Link>
          : total > 0 && <span className="text-[var(--accent-text)] font-medium">Đã hoàn thành lộ trình</span>}
      </div>
    </header>
    {!total ? <p className="text-sm text-[var(--text-secondary)]">Lộ trình chưa có bài.</p>
      : <ol className="rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] divide-y divide-[var(--border)]">
        {track.problems.map((p, index) => <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
          <span className="w-6 text-right font-mono text-xs text-[var(--text-muted)]">{index + 1}</span>
          <Link to={`/problems/${p.slug}`} className="flex-1 min-w-0 truncate hover:text-[var(--accent-text)]">{p.title}</Link>
          {solved.has(p.id) && <span className="text-xs font-medium text-[var(--accent-text)]">Đã giải</span>}
          <ProblemDifficulty difficulty={p.difficulty} />
        </li>)}
      </ol>}
  </div>;
}
