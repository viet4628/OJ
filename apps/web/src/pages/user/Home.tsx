import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Megaphone, BarChart2, BookOpen, Users, FileCode2,
  CheckCircle2, Circle, ChevronRight, Eye, Calendar, Lock,
  Play, Loader2, Sparkles, Tag, Clock, ArrowRight, Lightbulb,
} from 'lucide-react';
import {
  getAnnouncements, getContests, getProblems, getStats, getRanklist, getMyAcceptedProblemIds,
  type Announcement, type Contest, type Problem, type RankUser,
} from '../../lib/api';

const DIFF_STYLE: Record<string, string> = {
  Easy: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40',
  Medium: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
  Hard: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-800/40',
};
const DIFF_LABEL: Record<string, string> = { Easy: 'Dễ', Medium: 'Trung Bình', Hard: 'Khó' };

const CONTEST_STATUS_META: Record<Contest['status'], { label: string; className: string; dot: string }> = {
  UNDERWAY: {
    label: 'Đang diễn ra',
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40',
    dot: 'bg-emerald-500 animate-pulse',
  },
  NOT_STARTED: {
    label: 'Sắp diễn ra',
    className: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border-sky-200 dark:border-sky-800/40',
    dot: 'bg-sky-500',
  },
  ENDED: {
    label: 'Đã kết thúc',
    className: 'bg-slate-50 text-slate-500 dark:bg-slate-850 dark:text-slate-400 border-[var(--border)]',
    dot: 'bg-slate-400',
  },
};

const STATUS_PRIORITY: Record<Contest['status'], number> = {
  UNDERWAY: 0,
  NOT_STARTED: 1,
  ENDED: 2,
};

function cleanMarkdownSnippet(text: string): string {
  if (!text) return '';
  return text
    .replace(/[*#`_~]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\\n/g, ' ')
    .trim();
}

function getProblemSummary(text: string): string {
  if (!text) return '';
  const mainPart = text.split(/\n\s*#{1,6}\s+|\n\s*(?:\*\*|__)?Dữ liệu|\n\s*(?:\*\*|__)?Input|\n\s*(?:\*\*|__)?Giới hạn/i)[0] || text;
  return cleanMarkdownSnippet(mainPart);
}

export default function Home() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [rankUsers, setRankUsers] = useState<RankUser[]>([]);
  const [acceptedIds, setAcceptedIds] = useState<string[]>([]);
  const [stats, setStats] = useState({ problems: 0, submissions: 0, profiles: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [diffFilter, setDiffFilter] = useState<'ALL' | 'Easy' | 'Medium' | 'Hard'>('ALL');

  useEffect(() => {
    if (!selectedAnnouncement) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedAnnouncement(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedAnnouncement]);

  useEffect(() => {
    (async () => {
      try {
        const [anns, cons, probs, sts, ranks, accepted] = await Promise.all([
          getAnnouncements(),
          getContests(),
          getProblems(),
          getStats(),
          getRanklist(),
          getMyAcceptedProblemIds(),
        ]);
        setAnnouncements(anns.slice(0, 4));
        setContests(cons);
        setProblems(probs);
        setStats(sts);
        setRankUsers(ranks.slice(0, 5));
        setAcceptedIds(accepted);
      } catch (err) {
        console.error('Failed to load home data:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const featuredContests = useMemo(() => {
    return [...contests]
      .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status])
      .slice(0, 3);
  }, [contests]);

  const popularTags = useMemo(() => {
    const tags = problems.flatMap((p) => p.tags || []);
    return [...new Set(tags)].slice(0, 10);
  }, [problems]);

  const dailyProblem = useMemo(() => {
    if (problems.length === 0) return null;
    return problems.find((p) => !acceptedIds.includes(p.id)) || problems[0];
  }, [problems, acceptedIds]);

  const displayedProblems = useMemo(() => {
    const filtered = diffFilter === 'ALL'
      ? problems
      : problems.filter((p) => p.difficulty === diffFilter);
    return filtered.slice(0, 8);
  }, [problems, diffFilter]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const STAT_CARDS = [
    {
      icon: FileCode2,
      label: 'Kho Bài Tập',
      value: stats.problems,
      sub: 'Đa dạng thuật toán',
      bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: Users,
      label: 'Lập Trình Viên',
      value: stats.profiles,
      sub: 'Thành viên tham gia',
      bg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    },
    {
      icon: BookOpen,
      label: 'Lượt Nộp Code',
      value: stats.submissions,
      sub: 'Chấm tự động realtime',
      bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
    {
      icon: Trophy,
      label: 'Kỳ Thi Trực Tuyến',
      value: contests.length,
      sub: 'Chuẩn format ACM / OI',
      bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. STATS ROW — Compact, high-density, no wasted space */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {STAT_CARDS.map((stat) => (
          <div
            key={stat.label}
            className="bg-[var(--bg-primary)] rounded-xl p-4 border border-[var(--border)] flex items-center gap-3.5 shadow-sm transition-colors"
          >
            <div className={`p-2.5 rounded-lg ${stat.bg} border border-[var(--border)] shrink-0`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              {isLoading ? (
                <div className="w-14 h-6 rounded bg-[var(--bg-secondary)] animate-pulse" />
              ) : (
                <div className="text-xl sm:text-2xl font-black text-[var(--text-primary)] leading-tight">
                  {stat.value.toLocaleString('vi-VN')}
                </div>
              )}
              <div className="text-xs font-bold text-[var(--text-primary)] truncate mt-0.5">{stat.label}</div>
              <div className="text-[11px] text-[var(--text-muted)] truncate hidden sm:block">{stat.sub}</div>
            </div>
          </div>
        ))}
      </section>

      {/* 2. MAIN CONTENT GRID: 8 Cols (Problems & News) + 4 Cols (Sidebar widgets) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN (8 cols): Problems Table & Announcements */}
        <div className="lg:col-span-8 space-y-6">
          {/* Featured Problems Table with quick filter tabs */}
          <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-[var(--accent-text)]" />
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Luyện Tập — Bài Tập Nổi Bật
                </h2>
              </div>

              {/* Filter pills & distinct link */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                {(['ALL', 'Easy', 'Medium', 'Hard'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDiffFilter(d)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      diffFilter === d
                        ? 'bg-[var(--accent)] text-white shadow-xs'
                        : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    {d === 'ALL' ? 'Tất cả' : DIFF_LABEL[d]}
                  </button>
                ))}
                <Link
                  to="/problems"
                  className="ml-3 text-xs text-[var(--accent-text)] hover:underline font-semibold flex items-center gap-1 shrink-0"
                >
                  Kho bài tập <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-xs text-[var(--text-secondary)] font-bold">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" /> Đang tải dữ liệu bài tập...
              </div>
            ) : displayedProblems.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--text-secondary)]">
                Chưa có bài tập nào phù hợp với bộ lọc.
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--bg-secondary)]/60 text-[var(--text-secondary)] border-b border-[var(--border)] font-bold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="text-center px-4 py-3 w-12 text-[10px] font-bold text-[var(--text-muted)]" title="Trạng thái đã giải">
                        ✓
                      </th>
                      <th className="text-left px-4 py-3">Bài Tập</th>
                      <th className="text-left px-4 py-3 w-28">Độ Khó</th>
                      <th className="text-left px-4 py-3 w-40 hidden sm:table-cell">Giới Hạn</th>
                      <th className="text-right px-4 py-3 w-32 whitespace-nowrap">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {displayedProblems.map((p) => {
                      const isAc = acceptedIds.includes(p.id);
                      return (
                        <tr key={p.id} className="hover:bg-[var(--bg-secondary)]/70 transition-colors group">
                          <td className="px-4 py-3 text-center">
                            {isAc ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-40 mx-auto" />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link
                                to={`/problems/${p.slug}`}
                                className="font-bold text-[var(--text-primary)] hover:text-[var(--accent-text)] transition-colors"
                              >
                                {p.title}
                              </Link>
                              {(p.tags || []).slice(0, 2).map((t: string) => (
                                <Link
                                  key={t}
                                  to={`/problems?tag=${encodeURIComponent(t)}`}
                                  className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] font-mono text-[9px] text-[var(--text-secondary)] hover:text-[var(--accent-text)] transition-colors"
                                >
                                  {t}
                                </Link>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${DIFF_STYLE[p.difficulty]}`}>
                              {DIFF_LABEL[p.difficulty]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-[11px] hidden sm:table-cell">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                              {p.time_limit_ms}ms • {p.memory_limit_mb}MB
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <Link
                              to={`/problems/${p.slug}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text-primary)] text-xs font-bold transition-all whitespace-nowrap shadow-2xs"
                            >
                              Làm bài <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Announcements & Quick Guide */}
          <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-[var(--accent-text)]" /> Tin Tức &amp; Thông Báo
              </h2>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Cập nhật hệ thống</span>
            </div>

            <div className="p-5 space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-[var(--text-secondary)] font-bold">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" /> Đang tải thông báo...
                </div>
              ) : announcements.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-secondary)]">Chưa có thông báo nào</div>
              ) : (
                announcements.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedAnnouncement(item)}
                    className="w-full text-left p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-1.5 hover:border-[var(--accent)]/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent-text)] font-code font-bold text-[10px] border border-[var(--accent)]/20">
                          {item.tag}
                        </span>
                        <span className="font-bold text-[var(--text-primary)] text-xs hover:text-[var(--accent-text)] transition-colors">
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] font-code">
                        {new Date(item.created_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <p className="text-[var(--text-secondary)] text-xs leading-relaxed line-clamp-2">
                      {cleanMarkdownSnippet(item.content)}
                    </p>
                    <div className="flex items-center justify-between text-[11px] pt-1 text-[var(--text-secondary)]">
                      <span>Bởi {item.author}</span>
                      <span className="text-[var(--accent-text)] font-semibold flex items-center gap-1">
                        Xem chi tiết <Eye className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                ))
              )}

              {/* Quick tip box — helps populate space helpfully without feeling empty */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)]/50 border border-dashed border-[var(--border)] flex items-start gap-3">
                <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-[var(--text-primary)]">Mẹo Luyện Tập Nhanh</p>
                  <p className="text-[var(--text-secondary)] leading-relaxed">
                    Sử dụng phím tắt <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] font-mono text-[10px]">⌘K</kbd> hoặc <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] font-mono text-[10px]">Ctrl+K</kbd> để tìm kiếm bài tập bất cứ lúc nào. Nền tảng hỗ trợ tự động chấm các ngôn ngữ C++, Python 3, Rust và Java.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (4 cols): Daily Challenge, Contests, Leaderboard, Topics */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* 1. Daily Challenge Pick */}
          {dailyProblem && (
            <div className="bg-gradient-to-br from-[var(--bg-primary)] to-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] p-5 space-y-3.5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Thử Thách Hôm Nay
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${DIFF_STYLE[dailyProblem.difficulty]}`}>
                  {DIFF_LABEL[dailyProblem.difficulty]}
                </span>
              </div>

              <div>
                <h3 className="font-extrabold text-sm text-[var(--text-primary)] leading-snug">
                  <Link
                    to={`/problems/${dailyProblem.slug}`}
                    className="hover:text-[var(--accent-text)] transition-colors"
                  >
                    {dailyProblem.title}
                  </Link>
                </h3>
                <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-1.5 leading-relaxed">
                  {getProblemSummary(dailyProblem.description)}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1 gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(dailyProblem.tags || []).slice(0, 2).map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] font-mono text-[10px] text-[var(--text-secondary)]">
                      {t}
                    </span>
                  ))}
                </div>
                <Link
                  to={`/problems/${dailyProblem.slug}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold shadow-sm transition-colors whitespace-nowrap shrink-0"
                >
                  Giải ngay <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* 2. Contests Preview */}
          <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" /> Cuộc Thi
              </h2>
              <Link to="/contests" className="text-xs text-[var(--accent-text)] hover:underline font-semibold">
                Tất cả →
              </Link>
            </div>

            <div className="p-4 space-y-2.5">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-[var(--text-secondary)] font-bold">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" /> Đang tải cuộc thi...
                </div>
              ) : featuredContests.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-secondary)]">Chưa có cuộc thi nào</div>
              ) : (
                featuredContests.map((c) => {
                  const meta = CONTEST_STATUS_META[c.status];
                  return (
                    <Link
                      key={c.id}
                      to={`/contests/${c.id}`}
                      className="group flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] transition-colors hover:border-[var(--accent)]/40"
                    >
                      <div className="w-9 h-9 shrink-0 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors flex items-center gap-1.5">
                          {c.title}
                          {!c.is_public && <Lock className="w-3 h-3 text-[var(--text-muted)] shrink-0" />}
                        </p>
                        <p className="mt-0.5 font-code text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatTime(c.start_time)}
                        </p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold ${meta.className}`}>
                        <span className={`w-1 h-1 rounded-full ${meta.dot}`} /> {meta.label.toUpperCase()}
                      </span>
                    </Link>
                  );
                })
              )}

              {!isLoading && featuredContests.length > 0 && (
                <Link
                  to="/contests"
                  className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl border border-dashed border-[var(--border-strong)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--accent-text)] hover:border-[var(--accent)]/40 transition-colors mt-2"
                >
                  <Play className="w-3.5 h-3.5" /> Xem lịch thi đấu đầy đủ
                </Link>
              )}
            </div>
          </div>

          {/* 3. Top Ranklist Widget */}
          <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[var(--accent-text)]" /> Top Cao Thủ Xếp Hạng
              </h2>
              <Link to="/ranklist" className="text-xs text-[var(--accent-text)] hover:underline font-semibold">
                Xem tất cả →
              </Link>
            </div>
            <div className="p-4 space-y-2 text-xs font-code">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-[var(--text-secondary)] font-bold">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" /> Đang tải xếp hạng...
                </div>
              ) : rankUsers.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-secondary)]">Chưa có dữ liệu xếp hạng</div>
              ) : (
                rankUsers.map((u, idx) => (
                  <div
                    key={u.user_id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] font-semibold gap-2"
                  >
                    <span className="font-bold text-[var(--text-primary)] flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-6 text-center shrink-0">{['🥇', '🥈', '🥉'][idx] || `#${idx + 1}`}</span>
                      <span className="truncate">{u.username || 'user'}</span>
                    </span>
                    <span className="font-bold text-[var(--accent-text)] bg-[var(--accent)]/10 px-2.5 py-0.5 rounded-md border border-[var(--accent)]/20 shrink-0">
                      {u.accepted_number} AC
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 4. Popular Topics / Tag Cloud */}
          {popularTags.length > 0 && (
            <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] p-4 space-y-3 text-xs shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[var(--accent-text)]" /> Chủ Đề Trọng Tâm
                </h3>
                <Link to="/problems" className="text-[11px] text-[var(--accent-text)] hover:underline font-semibold">
                  Kho bài tập →
                </Link>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {popularTags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/problems?tag=${encodeURIComponent(tag)}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] hover:border-[var(--accent)]/50 text-[var(--text-secondary)] hover:text-[var(--accent-text)] text-[11px] font-medium transition-colors"
                  >
                    <Tag className="w-2.5 h-2.5 text-[var(--accent-text)] opacity-70" />
                    {tag}
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Announcement Detail Modal */}
      {selectedAnnouncement && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Thông báo: ${selectedAnnouncement.title}`}
            className="bg-[var(--bg-primary)] rounded-2xl max-w-lg w-full p-6 border border-[var(--border)] shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent-text)] font-code font-bold text-[10px]">
                  {selectedAnnouncement.tag}
                </span>
                <h3 className="font-extrabold text-sm text-[var(--text-primary)]">{selectedAnnouncement.title}</h3>
              </div>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-[var(--text-secondary)] leading-relaxed space-y-2 max-h-80 overflow-y-auto">
              <p>{selectedAnnouncement.content}</p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] font-code">
              <span>Đăng bởi: {selectedAnnouncement.author}</span>
              <span>{new Date(selectedAnnouncement.created_at).toLocaleDateString('vi-VN')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
