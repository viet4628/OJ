import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import MorphIcon from '../../components/MorphIcon';
import {
  Trophy as TrophyData,
  Megaphone as MegaphoneData,
  BarChart2 as BarChart2Data,
  BookOpen as BookOpenData,
  Users as UsersData,
  FileCode2 as FileCode2Data,
  CheckCircle2 as CheckCircle2Data,
  Circle as CircleData,
  ChevronRight as ChevronRightData,
  Eye as EyeData,
  Calendar as CalendarData,
  Lock as LockData,
  Play as PlayData,
  Loader2 as Loader2Data,
  Sparkles as SparklesData,
  Tag as TagData,
  Clock as ClockData,
  ArrowRight as ArrowRightData,
  X as XData,
} from 'lucide';
import {
  getAnnouncements, getContests, getProblems, getStats, getRanklist, getMyAcceptedProblemIds,
  type Announcement, type Contest, type Problem, type RankUser,
} from '../../lib/api';

const DIFF_STYLE: Record<string, string> = {
  Easy: 'bg-[var(--bg-tertiary)] text-[var(--accent-text)] border-[var(--border)]',
  Medium: 'bg-[var(--bg-tertiary)] text-[#9A6700] dark:text-[#D29922] border-[var(--border)]',
  Hard: 'bg-[var(--bg-tertiary)] text-[#CF222E] dark:text-[#F85149] border-[var(--border)]',
};
const DIFF_LABEL: Record<string, string> = { Easy: 'Dễ', Medium: 'Trung Bình', Hard: 'Khó' };

const CONTEST_STATUS_META: Record<Contest['status'], { label: string; className: string; dot: string }> = {
  UNDERWAY: {
    label: 'Đang diễn ra',
    className: 'bg-[var(--accent)]/10 text-[var(--accent-text)] border-[var(--accent)]/30',
    dot: 'bg-[var(--accent)] animate-pulse',
  },
  NOT_STARTED: {
    label: 'Sắp diễn ra',
    className: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border)]',
    dot: 'bg-[var(--text-muted)]',
  },
  ENDED: {
    label: 'Đã kết thúc',
    className: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border)]',
    dot: 'bg-[var(--border)]',
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
      icon: FileCode2Data,
      label: 'Kho Bài Tập',
      value: stats.problems,
      sub: 'Đa dạng thuật toán',
    },
    {
      icon: UsersData,
      label: 'Lập Trình Viên',
      value: stats.profiles,
      sub: 'Thành viên tham gia',
    },
    {
      icon: BookOpenData,
      label: 'Lượt Nộp Code',
      value: stats.submissions,
      sub: 'Chấm tự động sandbox',
    },
    {
      icon: TrophyData,
      label: 'Kỳ Thi Trực Tuyến',
      value: contests.length,
      sub: 'Chuẩn format ACM / OI',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. STATS ROW — GitHub Primer Metric Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAT_CARDS.map((stat) => (
          <div
            key={stat.label}
            className="bg-[var(--bg-secondary)] rounded-md p-3.5 border border-[var(--border)] flex items-center gap-3 transition-colors"
          >
            <div className="w-8 h-8 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
              <MorphIcon icon={stat.icon} size={16} />
            </div>
            <div className="min-w-0">
              {isLoading ? (
                <div className="w-14 h-5 rounded bg-[var(--bg-tertiary)] animate-pulse" />
              ) : (
                <div className="text-xl font-semibold text-[var(--text-primary)] leading-tight">
                  {stat.value.toLocaleString('vi-VN')}
                </div>
              )}
              <div className="text-xs font-medium text-[var(--text-primary)] truncate mt-0.5">{stat.label}</div>
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
          <div className="bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-tertiary)]/50">
              <div className="flex items-center gap-2">
                <MorphIcon icon={FileCode2Data} size={14} className="text-[var(--accent-text)]" />
                <h2 className="text-xs font-semibold text-[var(--text-primary)]">
                  Luyện Tập — Bài Tập Nổi Bật
                </h2>
              </div>

              {/* Filter pills & distinct link */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                {(['ALL', 'Easy', 'Medium', 'Hard'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDiffFilter(d)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      diffFilter === d
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    {d === 'ALL' ? 'Tất cả' : DIFF_LABEL[d]}
                  </button>
                ))}
                <Link
                  to="/problems"
                  className="ml-3 text-xs text-[var(--accent-text)] hover:underline font-medium flex items-center gap-1 shrink-0"
                >
                  Kho bài tập <MorphIcon icon={ChevronRightData} size={12} />
                </Link>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-[var(--text-secondary)]">
                <MorphIcon icon={Loader2Data} size={14} className="animate-spin text-[var(--accent-text)]" /> Đang tải dữ liệu bài tập...
              </div>
            ) : displayedProblems.length === 0 ? (
              <div className="py-10 text-center text-xs text-[var(--text-secondary)]">
                Chưa có bài tập nào phù hợp với bộ lọc.
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-b border-[var(--border)] font-medium text-[11px]">
                    <tr>
                      <th className="text-center px-3 py-2 w-10 text-[10px] text-[var(--text-muted)]" title="Trạng thái đã giải">
                        ✓
                      </th>
                      <th className="text-left px-3 py-2">Bài Tập</th>
                      <th className="text-left px-3 py-2 w-24">Độ Khó</th>
                      <th className="text-left px-3 py-2 w-36 hidden sm:table-cell">Giới Hạn</th>
                      <th className="text-right px-3 py-2 w-28 whitespace-nowrap">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {displayedProblems.map((p) => {
                      const isAc = acceptedIds.includes(p.id);
                      return (
                        <tr key={p.id} className="hover:bg-[var(--bg-primary)] transition-colors group">
                          <td className="px-3 py-2 text-center">
                            {isAc ? (
                              <MorphIcon icon={CheckCircle2Data} size={14} className="text-[var(--accent-text)] mx-auto" />
                            ) : (
                              <MorphIcon icon={CircleData} size={12} className="text-[var(--text-muted)] opacity-40 mx-auto" />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link
                                to={`/problems/${p.slug}`}
                                className="font-medium text-[var(--text-primary)] hover:text-[#0969DA] dark:hover:text-[#58A6FF] transition-colors"
                              >
                                {p.title}
                              </Link>
                              {(p.tags || []).slice(0, 2).map((t: string) => (
                                <Link
                                  key={t}
                                  to={`/problems?tag=${encodeURIComponent(t)}`}
                                  className="px-1.5 py-0.2 rounded text-[10px] font-mono border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                                >
                                  {t}
                                </Link>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono border ${DIFF_STYLE[p.difficulty]}`}>
                              {DIFF_LABEL[p.difficulty]}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[var(--text-secondary)] font-mono text-[11px] hidden sm:table-cell">
                            <span className="inline-flex items-center gap-1">
                              <MorphIcon icon={ClockData} size={11} className="text-[var(--text-muted)]" />
                              {p.time_limit_ms}ms · {p.memory_limit_mb}MB
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <Link
                              to={`/problems/${p.slug}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-medium transition-colors whitespace-nowrap"
                            >
                              Làm bài <MorphIcon icon={ChevronRightData} size={11} />
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
          <div className="bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-tertiary)]/50">
              <h2 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <MorphIcon icon={MegaphoneData} size={14} className="text-[var(--accent-text)]" /> Tin Tức &amp; Thông Báo
              </h2>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Cập nhật hệ thống</span>
            </div>

            <div className="p-4 space-y-2.5">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-[var(--text-secondary)]">
                  <MorphIcon icon={Loader2Data} size={14} className="animate-spin text-[var(--accent-text)]" /> Đang tải thông báo...
                </div>
              ) : announcements.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-secondary)]">Chưa có thông báo nào</div>
              ) : (
                announcements.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedAnnouncement(item)}
                    className="w-full text-left p-3 rounded-md bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] space-y-1 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                          {item.tag || 'HỆ THỐNG'}
                        </span>
                        <span className="font-medium text-[var(--text-primary)] text-xs hover:text-[#0969DA] dark:hover:text-[#58A6FF] transition-colors">
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        {new Date(item.created_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <p className="text-[var(--text-secondary)] text-xs leading-relaxed line-clamp-2">
                      {cleanMarkdownSnippet(item.content)}
                    </p>
                    <div className="flex items-center justify-between text-[11px] pt-1 text-[var(--text-muted)] font-mono">
                      <span>Bởi {item.author || 'Admin'}</span>
                      <span className="text-[var(--accent-text)] font-medium flex items-center gap-1">
                        Chi tiết <MorphIcon icon={EyeData} size={11} />
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (4 cols): Daily Challenge, Contests, Leaderboard, Topics */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* 1. Daily Challenge Pick */}
          {dailyProblem && (
            <div className="bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                  <MorphIcon icon={SparklesData} size={12} className="text-[var(--accent-text)]" /> Thử Thách Hôm Nay
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono border ${DIFF_STYLE[dailyProblem.difficulty]}`}>
                  {DIFF_LABEL[dailyProblem.difficulty]}
                </span>
              </div>

              <div>
                <h3 className="font-semibold text-xs text-[var(--text-primary)] leading-snug">
                  <Link
                    to={`/problems/${dailyProblem.slug}`}
                    className="hover:text-[#0969DA] dark:hover:text-[#58A6FF] transition-colors"
                  >
                    {dailyProblem.title}
                  </Link>
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 mt-1 leading-relaxed">
                  {getProblemSummary(dailyProblem.description)}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1 gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(dailyProblem.tags || []).slice(0, 2).map((t) => (
                    <span key={t} className="px-1.5 py-0.2 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] font-mono text-[10px] text-[var(--text-muted)]">
                      {t}
                    </span>
                  ))}
                </div>
                <Link
                  to={`/problems/${dailyProblem.slug}`}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors whitespace-nowrap shrink-0"
                >
                  Giải ngay <MorphIcon icon={ArrowRightData} size={12} />
                </Link>
              </div>
            </div>
          )}

          {/* 2. Contests Preview */}
          <div className="bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-tertiary)]/50">
              <h2 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <MorphIcon icon={TrophyData} size={14} className="text-[var(--accent-text)]" /> Cuộc Thi
              </h2>
              <Link to="/contests" className="text-xs text-[var(--accent-text)] hover:underline font-medium">
                Tất cả →
              </Link>
            </div>

            <div className="p-3 space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-[var(--text-secondary)]">
                  <MorphIcon icon={Loader2Data} size={14} className="animate-spin text-[var(--accent-text)]" /> Đang tải cuộc thi...
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
                      className="group flex items-center gap-2.5 p-2.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] transition-colors hover:bg-[var(--bg-tertiary)]"
                    >
                      <div className="w-7 h-7 shrink-0 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)]">
                        <MorphIcon icon={TrophyData} size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-medium text-[var(--text-primary)] group-hover:text-[#0969DA] dark:group-hover:text-[#58A6FF] transition-colors flex items-center gap-1.5">
                          {c.title}
                          {!c.is_public && <MorphIcon icon={LockData} size={10} className="text-[var(--text-muted)] shrink-0" />}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                          <MorphIcon icon={CalendarData} size={10} /> {formatTime(c.start_time)}
                        </p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full border text-[9px] font-mono ${meta.className}`}>
                        <span className={`w-1 h-1 rounded-full ${meta.dot}`} /> {meta.label.toUpperCase()}
                      </span>
                    </Link>
                  );
                })
              )}

              {!isLoading && featuredContests.length > 0 && (
                <Link
                  to="/contests"
                  className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-secondary)] transition-colors mt-1"
                >
                  <MorphIcon icon={PlayData} size={12} /> Xem lịch thi đấu đầy đủ
                </Link>
              )}
            </div>
          </div>

          {/* 3. Top Ranklist Widget */}
          <div className="bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-tertiary)]/50">
              <h2 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <MorphIcon icon={BarChart2Data} size={14} className="text-[var(--accent-text)]" /> Bảng Xếp Hạng
              </h2>
              <Link to="/ranklist" className="text-xs text-[var(--accent-text)] hover:underline font-medium">
                Xem tất cả →
              </Link>
            </div>
            <div className="p-3 space-y-1.5 text-xs font-mono">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-[var(--text-secondary)]">
                  <MorphIcon icon={Loader2Data} size={14} className="animate-spin text-[var(--accent-text)]" /> Đang tải xếp hạng...
                </div>
              ) : rankUsers.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-secondary)]">Chưa có dữ liệu xếp hạng</div>
              ) : (
                rankUsers.map((u, idx) => (
                  <div
                    key={u.user_id}
                    className="flex items-center justify-between p-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] font-medium gap-2"
                  >
                    <span className="text-[var(--text-primary)] flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-5 text-center shrink-0 text-[10px] text-[var(--text-muted)] font-mono">#{idx + 1}</span>
                      <span className="truncate text-xs">{u.username || 'user'}</span>
                    </span>
                    <span className="text-[11px] font-semibold text-[var(--accent-text)] bg-[var(--accent)]/10 px-2 py-0.2 rounded border border-[var(--accent)]/30 shrink-0">
                      {u.accepted_number} AC
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 4. Popular Topics / Tag Cloud */}
          {popularTags.length > 0 && (
            <div className="bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)]">
                <h3 className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                  <MorphIcon icon={TagData} size={12} className="text-[var(--accent-text)]" /> Chủ Đề Trọng Tâm
                </h3>
                <Link to="/problems" className="text-[11px] text-[var(--accent-text)] hover:underline font-medium">
                  Kho bài tập →
                </Link>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {popularTags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/problems?tag=${encodeURIComponent(tag)}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[11px] font-mono transition-colors"
                  >
                    <MorphIcon icon={TagData} size={10} className="text-[var(--text-muted)]" />
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
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Thông báo: ${selectedAnnouncement.title}`}
            className="bg-[var(--bg-secondary)] rounded-md max-w-lg w-full p-4 border border-[var(--border)] shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 px-1.5 py-0.2 rounded text-[10px] font-mono border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                  {selectedAnnouncement.tag || 'HỆ THỐNG'}
                </span>
                <h3 className="font-semibold text-xs text-[var(--text-primary)] truncate">{selectedAnnouncement.title}</h3>
              </div>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="p-1 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                aria-label="Đóng"
              >
                <MorphIcon icon={XData} size={16} />
              </button>
            </div>

            <div className="text-xs text-[var(--text-secondary)] leading-relaxed space-y-2 max-h-80 overflow-y-auto whitespace-pre-wrap">
              <p>{selectedAnnouncement.content}</p>
            </div>

            <div className="flex items-center justify-between pt-2.5 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)] font-mono">
              <span>Đăng bởi: {selectedAnnouncement.author || 'Admin'}</span>
              <span>{new Date(selectedAnnouncement.created_at).toLocaleDateString('vi-VN')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
