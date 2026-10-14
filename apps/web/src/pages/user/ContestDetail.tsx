import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Trophy, Calendar, Clock, Loader2, Users, Lock, ChevronRight, Timer,
  CheckCircle2, XCircle, ListOrdered, Award, CircleDashed, Info,
} from 'lucide-react';
import {
  getContest, getContestProblems, getContestRank, getMyContestSubmissions,
  getContestStatusFromTime,
  type Contest, type ContestProblemRow, type ContestRankRow,
} from '../../lib/api';
import Markdown from '../../components/Markdown';

type Tab = 'overview' | 'problems' | 'rank';

function fmtSeconds(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export default function ContestDetail() {
  const { id } = useParams<{ id: string }>();
  const [contest, setContest] = useState<Contest | null>(null);
  const [problems, setProblems] = useState<ContestProblemRow[]>([]);
  const [rank, setRank] = useState<ContestRankRow[]>([]);
  const [mySubs, setMySubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setError(null);
      const c = await getContest(id);
      if (!c) {
        setError('Không tìm thấy kỳ thi');
        setLoading(false);
        return;
      }
      setContest(c);
      const [probs, rnk, subs] = await Promise.all([
        getContestProblems(id),
        getContestRank(id),
        getMyContestSubmissions(id),
      ]);
      setProblems(probs);
      setRank(rnk);
      setMySubs(subs);
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const status = contest ? getContestStatusFromTime(contest.start_time, contest.end_time) : null;

  const countdown = useMemo(() => {
    if (!contest) return null;
    const targetMs =
      status === 'NOT_STARTED'
        ? new Date(contest.start_time).getTime()
        : new Date(contest.end_time).getTime();
    const diff = Math.max(0, Math.floor((targetMs - now) / 1000));
    const d = Math.floor(diff / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    return d > 0 ? `${d} ngày ${h} giờ` : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [contest, now, status]);

  const myResults = useMemo(() => {
    const map: Record<string, 'AC' | 'WA' | 'PENDING'> = {};
    for (const s of mySubs) {
      if (s.status === 'ACCEPTED') map[s.problem_id] = 'AC';
      else if (['PENDING', 'JUDGING'].includes(s.status)) map[s.problem_id] = 'PENDING';
      else if (!map[s.problem_id]) map[s.problem_id] = 'WA';
    }
    return map;
  }, [mySubs]);

  const sortedRank = useMemo(() => {
    if (contest?.rule_type === 'ACM') {
      return [...rank].sort((a, b) =>
        b.accepted_number - a.accepted_number || a.total_time_seconds - b.total_time_seconds
      );
    }
    return [...rank].sort((a, b) => b.total_score - a.total_score);
  }, [rank, contest?.rule_type]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-xs text-[var(--text-secondary)] font-bold">
        <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" /> Đang tải kỳ thi...
      </div>
    );
  }

  if (error || !contest) {
    return (
      <div className="py-24 text-center text-xs text-[var(--text-secondary)] space-y-2">
        <p>{error || 'Không tìm thấy kỳ thi'}</p>
        <Link to="/contests" className="text-[var(--accent-text)] font-bold block">← Về danh sách kỳ thi</Link>
      </div>
    );
  }

  const STATUS_MAP: Record<Contest['status'], { label: string; cls: string; dot: string }> = {
    UNDERWAY: { label: 'ĐANG DIỄN RA', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500 animate-pulse-glow' },
    NOT_STARTED: { label: 'CHƯA BẮT ĐẦU', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    ENDED: { label: 'ĐÃ KẾT THÚC', cls: 'bg-slate-50 text-slate-500 border-[var(--border)]', dot: 'bg-slate-400' },
  };
  const STATUS_META = STATUS_MAP[status as Contest['status']];

  const tbBtn = (t: Tab, icon: React.ReactNode, text: string) => (
    <button
      onClick={() => setTab(t)}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
        tab === t
          ? 'bg-[var(--accent)]/10 text-[var(--accent-text)] border border-[var(--accent)]/20'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] border border-transparent'
      }`}
    >
      {icon} {text}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_META.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META.dot}`} /> {STATUS_META.label}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent-text)] border border-[var(--accent)]/20 font-bold text-[10px]">{contest.rule_type}</span>
              {!contest.is_public && <Lock className="w-3.5 h-3.5 text-[var(--text-secondary)]" />}
            </div>
            <h1 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">{contest.title}</h1>
            <div className="text-xs text-[var(--text-secondary)] max-w-2xl"><Markdown content={contest.description} /></div>
          </div>

          <div className="shrink-0 min-w-[200px] p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-2">
            <div className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
              <Timer className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              {status === 'NOT_STARTED' ? 'BẮT ĐẦU SAU' : status === 'UNDERWAY' ? 'CÒN LẠI' : 'KẾT THÚC LÚC'}
            </div>
            <div className="font-code font-black text-lg text-[var(--text-primary)] tabular-nums">
              {status === 'ENDED' ? new Date(contest.end_time).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : countdown}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-secondary)] font-code pt-1 border-t border-[var(--border)]">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-[var(--accent-text)]" /> {new Date(contest.start_time).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-[var(--accent-text)]" /> → {new Date(contest.end_time).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              <span className="flex items-center gap-1"><Users className="w-3 h-3 text-[var(--accent-text)]" /> {rank.length} thí sinh</span>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl p-1.5 shadow-sm w-fit">
          {tbBtn('overview', <Info className="w-4 h-4" />, 'Tổng Quan')}
          {tbBtn('problems', <ListOrdered className="w-4 h-4" />, `Bài Tập (${problems.length})`)}
          {tbBtn('rank', <Award className="w-4 h-4" />, 'Bảng Xếp Hạng')}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-extrabold text-[var(--text-primary)]">Giới Thiệu Kỳ Thi</h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{contest.description}</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
              <div className="font-bold text-[var(--text-primary)]">Thể thức</div>
              <div className="text-[var(--text-secondary)] mt-1">{contest.rule_type === 'ACM' ? 'ACM/ICPC — AC nhanh nhất, sai trừ thời gian' : 'OI — chấm subtask theo điểm'}</div>
            </div>
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
              <div className="font-bold text-[var(--text-primary)]">Thời gian làm bài</div>
              <div className="text-[var(--text-secondary)] mt-1">{Math.round((new Date(contest.end_time).getTime() - new Date(contest.start_time).getTime()) / 3600000)} giờ</div>
            </div>
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
              <div className="font-bold text-[var(--text-primary)]">Bài tập</div>
              <div className="text-[var(--text-secondary)] mt-1">{problems.length} bài · xem chi tiết ở tab "Bài Tập"</div>
            </div>
          </div>
        </div>
      )}

      {/* PROBLEMS */}
      {tab === 'problems' && (
        <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h2 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-[var(--accent-text)]" /> Bài Tập Trong Kỳ Thi
            </h2>
            {status === 'NOT_STARTED' && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
                <Lock className="w-3 h-3" /> Đề mở khi bắt đầu (vẫn xem được thông tin)
              </span>
            )}
          </div>
          {problems.length === 0 ? (
            <p className="text-center text-xs text-[var(--text-secondary)] py-12">Kỳ thi chưa có bài tập nào</p>
          ) : (
            <ol className="divide-y divide-[var(--border)]">
              {problems.map((row, idx) => {
                const st = myResults[row.problem_id];
                return (
                  <li key={row.problem_id}>
                    <Link
                      to={`/contests/${contest.id}/problems/${row.problem_id}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--bg-secondary)]/60 transition-colors group"
                    >
                      <span className="w-8 h-8 shrink-0 rounded-lg bg-[var(--accent)]/10 text-[var(--accent-text)] border border-[var(--accent)]/20 font-black text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors truncate">
                          {row.problems.title}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-code mt-0.5">
                          {row.problems.time_limit_ms}ms / {row.problems.memory_limit_mb}MB · {row.problems.difficulty}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {st === 'AC' && <span className="flex items-center gap-1 text-[var(--accent-text)] font-black text-[11px]"><CheckCircle2 className="w-4 h-4" /> AC</span>}
                        {st === 'PENDING' && <span className="flex items-center gap-1 text-blue-600 font-bold text-[11px]"><Loader2 className="w-3.5 h-3.5 animate-spin" /> ĐANG CHẤM</span>}
                        {st === 'WA' && <span className="flex items-center gap-1 text-red-500 font-bold text-[11px]"><XCircle className="w-4 h-4" /> SAI / CHƯA AC</span>}
                        <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-text)] transition-colors" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {/* RANK */}
      {tab === 'rank' && (
        <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h2 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-600" /> Bảng Xếp Hạng {contest.rule_type}
            </h2>
            {contest.rule_type === 'ACM' ? (
              <span className="text-[11px] text-[var(--text-secondary)] font-semibold">AC xếp trước, penalty nhỏ hơn xếp trên</span>
            ) : (
              <span className="text-[11px] text-[var(--text-secondary)] font-semibold">Tổng điểm tốt nhất từng bài</span>
            )}
          </div>

          {sortedRank.length === 0 ? (
            <p className="text-center text-xs text-[var(--text-secondary)] py-12">Chưa có thí sinh nào nộp bài</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-code">
                <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-b border-[var(--border)] font-bold text-[11px] uppercase">
                  <tr>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Người Dùng</th>
                    <th className="px-4 py-3 text-center">{contest.rule_type === 'ACM' ? 'AC / Tổng' : 'Điểm'}</th>
                    {contest.rule_type === 'ACM' && <th className="px-4 py-3">Tổng Thời Gian</th>}
                    {problems.map((row, idx) => (
                      <th key={row.problem_id} className="px-2 py-3 text-center">
                        <Link to={`/contests/${contest.id}/problems/${row.problem_id}`} className="hover:text-[var(--accent-text)] transition-colors" title={row.problems.title}>
                          {idx + 1}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {sortedRank.map((row, i) => (
                    <tr key={row.user_id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                      <td className="px-4 py-3 font-black">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</td>
                      <td className="px-4 py-3 font-bold text-[var(--text-primary)]">{row.username || row.email?.split('@')[0] || 'user'}</td>
                      <td className="px-4 py-3 text-center font-black text-[var(--accent-text)]">
                        {contest.rule_type === 'ACM' ? `${row.accepted_number} / ${row.submission_number}` : row.total_score}
                      </td>
                      {contest.rule_type === 'ACM' && (
                        <td className="px-4 py-3 text-center text-[var(--text-secondary)]">{fmtSeconds(row.total_time_seconds)}</td>
                      )}
                      {problems.map((pp) => {
                        const info = row.problem_info?.[pp.problem_id];
                        if (contest.rule_type === 'ACM') {
                          if (!info || !info.submission_count) return <td key={pp.problem_id} className="px-2 py-3 text-center text-[var(--text-muted)]">—</td>;
                          return (
                            <td key={pp.problem_id} className="px-2 py-3 text-center">
                              {info.is_ac ? (
                                <span className="inline-flex flex-col items-center gap-0.5">
                                  <span className="text-[var(--accent-text)] font-black">{fmtSeconds(info.time_seconds || 0)}</span>
                                  {info.error_count ? <span className="text-red-500 text-[10px] font-bold">-{info.error_count}</span> : null}
                                </span>
                              ) : (
                                <span className="text-red-400 font-bold">{info.submission_count}</span>
                              )}
                            </td>
                          );
                        }
                        return (
                          <td key={pp.problem_id} className="px-2 py-3 text-center">
                            {info && info.submission_count ? (
                              <span className={`font-black ${(info.score || 0) > 0 ? 'text-[var(--accent-text)]' : 'text-red-400'}`}>
                                {info.score || 0}
                              </span>
                            ) : (
                              <span className="text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}