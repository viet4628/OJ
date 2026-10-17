import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import MorphIcon from '../../components/MorphIcon';
import {
  BookOpen as BookOpenData,
  FileCode2 as FileCode2Data,
  History as HistoryData,
  Mail as MailData,
  Calendar as CalendarData,
  Search as SearchData,
  ExternalLink as ExternalLinkData,
  Loader2 as Loader2Data,
  AlertOctagon as AlertOctagonData,
  CheckCircle2 as CheckCircle2Data,
  Tag as TagData,
  Clock as ClockData,
  Edit3 as Edit3Data,
} from 'lucide';
import {
  getUserProfile,
  getUserRankStats,
  getSubmissionsByUser,
  type Profile,
  type RankUser,
  type Submission,
} from '../../lib/api';

const LANG_COLORS: Record<string, { bg: string; label: string }> = {
  cpp: { bg: '#f34b7d', label: 'C++' },
  python: { bg: '#3572A5', label: 'Python 3' },
  rust: { bg: '#dea584', label: 'Rust' },
  java: { bg: '#b07219', label: 'Java' },
};

const DIFF_LABEL: Record<string, { label: string; text: string }> = {
  Easy: { label: 'Dễ', text: 'text-[var(--accent-text)]' },
  Medium: { label: 'Vừa', text: 'text-[#9A6700] dark:text-[#D29922]' },
  Hard: { label: 'Khó', text: 'text-[#CF222E] dark:text-[#F85149]' },
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  ACCEPTED: { label: 'AC', cls: 'text-[var(--accent-text)] bg-[var(--accent)]/10 border-[var(--accent)]/30' },
  WRONG_ANSWER: { label: 'WA', cls: 'text-[#CF222E] dark:text-[#F85149] bg-red-500/10 border-red-500/20' },
  TIME_LIMIT_EXCEEDED: { label: 'TLE', cls: 'text-[#9A6700] dark:text-[#D29922] bg-amber-500/10 border-amber-500/20' },
  MEMORY_LIMIT_EXCEEDED: { label: 'MLE', cls: 'text-[#8250DF] bg-purple-500/10 border-purple-500/20' },
  COMPILE_ERROR: { label: 'CE', cls: 'text-[#CF222E] dark:text-[#F85149] bg-red-500/10 border-red-500/20' },
  RUNTIME_ERROR: { label: 'RE', cls: 'text-[#BC4C00] bg-orange-500/10 border-orange-500/20' },
};

interface UserHomeProps {
  currentUser?: { id: string; username: string } | null;
}

export default function UserHome({ currentUser }: UserHomeProps) {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<RankUser | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'solved' | 'submissions'>('overview');
  const [searchSolved, setSearchSolved] = useState('');
  const [diffFilter, setDiffFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const [p, s, list] = await Promise.all([
          getUserProfile(id),
          getUserRankStats(id),
          getSubmissionsByUser(id, 50),
        ]);
        setProfile(p);
        setStats(s);
        setSubs(list);
      } catch (err) {
        console.error('Failed to load user home data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Unique Solved Problems list (like GitHub Repositories)
  const solvedProblems = useMemo(() => {
    const acSubs = subs.filter((s) => s.status === 'ACCEPTED' && s.problems);
    const seen = new Set<string>();
    const list: Array<{
      submissionId: string;
      problemId: string;
      slug: string;
      title: string;
      difficulty: string;
      tags: string[];
      language: string;
      code?: string;
      bestTimeMs: number;
      bestMemoryMb: number;
      solvedAt: string;
    }> = [];

    for (const s of acSubs) {
      const prob = s.problems;
      if (!prob?.slug || seen.has(prob.slug)) continue;
      seen.add(prob.slug);
      list.push({
        submissionId: s.id,
        problemId: s.problem_id,
        slug: prob.slug,
        title: prob.title,
        difficulty: (prob as any).difficulty || 'Easy',
        tags: (prob as any).tags || [],
        language: s.language,
        code: s.code,
        bestTimeMs: s.time_used_ms,
        bestMemoryMb: s.memory_used_mb,
        solvedAt: s.created_at,
      });
    }
    return list;
  }, [subs]);

  // Filtered Solved Problems
  const filteredSolved = useMemo(() => {
    return solvedProblems.filter((p) => {
      const matchSearch = searchSolved === '' || p.title.toLowerCase().includes(searchSolved.toLowerCase());
      const matchDiff = diffFilter === 'ALL' || p.difficulty === diffFilter;
      return matchSearch && matchDiff;
    });
  }, [solvedProblems, searchSolved, diffFilter]);

  // Languages Breakdown
  const languageStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of subs) {
      counts[s.language] = (counts[s.language] || 0) + 1;
    }
    const total = subs.length || 1;
    return Object.entries(counts)
      .map(([lang, count]) => ({
        lang,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [subs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-xs text-[var(--text-secondary)] font-medium">
        <MorphIcon icon={Loader2Data} size={16} className="animate-spin text-[var(--accent-text)]" /> Đang tải hồ sơ...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="py-24 text-center space-y-3">
        <MorphIcon icon={AlertOctagonData} size={32} className="mx-auto text-[var(--text-muted)]" />
        <p className="text-xs text-[var(--text-secondary)]">Không tìm thấy người dùng này</p>
        <Link to="/ranklist" className="text-xs font-semibold text-[var(--accent-text)] hover:underline inline-block">
          ← Xem bảng xếp hạng
        </Link>
      </div>
    );
  }

  const displayName = profile.full_name || profile.email.split('@')[0];
  const isSelf = currentUser?.id === profile.id;
  const pinnedProblems = solvedProblems.slice(0, 6);

  return (
    <div className="w-full">
      {/* 1. GITHUB UNDERLINE NAVIGATION SUBNAV */}
      <div className="border-b border-[var(--border)] mb-8 bg-[var(--bg-secondary)] -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1280px] mx-auto flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-3.5 py-3 text-xs font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-[var(--accent)] text-[var(--text-primary)] font-semibold'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border)]'
            }`}
          >
            <MorphIcon icon={BookOpenData} size={15} />
            <span>Tổng quan</span>
          </button>

          <button
            onClick={() => setActiveTab('solved')}
            className={`flex items-center gap-2 px-3.5 py-3 text-xs font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'solved'
                ? 'border-[var(--accent)] text-[var(--text-primary)] font-semibold'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border)]'
            }`}
          >
            <MorphIcon icon={FileCode2Data} size={15} />
            <span>Bài đã giải</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-muted)]">
              {stats?.accepted_number ?? solvedProblems.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('submissions')}
            className={`flex items-center gap-2 px-3.5 py-3 text-xs font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'submissions'
                ? 'border-[var(--accent)] text-[var(--text-primary)] font-semibold'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border)]'
            }`}
          >
            <MorphIcon icon={HistoryData} size={15} />
            <span>Nhật ký nộp</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-muted)]">
              {stats?.submission_number ?? subs.length}
            </span>
          </button>
        </div>
      </div>

      {/* 2. MAIN CONTAINER: 2 COLUMNS (GITHUB USER PROFILE LAYOUT) */}
      <div className="max-w-[1280px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* CỘT TRÁI (3-4 cols): GITHUB USER SIDEBAR */}
          <div className="md:col-span-4 lg:col-span-3 space-y-4">
            
            {/* Avatar lớn hình tròn chuẩn GitHub */}
            <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-full md:aspect-square max-w-[280px] rounded-full overflow-hidden border border-[var(--border)] bg-[var(--bg-tertiary)] shadow-xs mx-auto md:mx-0">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-5xl text-[var(--text-muted)] bg-[var(--bg-tertiary)] select-none">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Tên & Handle */}
            <div className="space-y-0.5 text-center md:text-left">
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] leading-tight">
                {displayName}
              </h1>
              <p className="text-sm text-[var(--text-muted)] font-mono font-normal">
                @{profile.email.split('@')[0]}
              </p>
            </div>

            {/* Role Badge */}
            <div className="flex justify-center md:justify-start">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] font-mono text-[10px] font-medium tracking-wide">
                {profile.role === 'admin' ? 'Administrator' : profile.role === 'teacher' ? 'Educator' : 'Coder'}
              </span>
            </div>

            {/* Nút Chỉnh sửa hồ sơ nếu là tài khoản của mình */}
            {isSelf && (
              <Link
                to="/settings"
                className="flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-md bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] transition-colors shadow-xs"
              >
                <MorphIcon icon={Edit3Data} size={12} />
                <span>Chỉnh sửa hồ sơ</span>
              </Link>
            )}

            {/* Metadata (Email & Tham gia) */}
            <div className="space-y-2 pt-3 border-t border-[var(--border)] text-xs text-[var(--text-secondary)]">
              <div className="flex items-center gap-2 min-w-0">
                <MorphIcon icon={MailData} size={14} className="text-[var(--text-muted)] shrink-0" />
                <span className="truncate">{profile.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <MorphIcon icon={CalendarData} size={14} className="text-[var(--text-muted)] shrink-0" />
                <span>
                  Tham gia tháng {new Date(profile.created_at).getMonth() + 1}/{new Date(profile.created_at).getFullYear()}
                </span>
              </div>
            </div>

            {/* Thành tích & Điểm số (GitHub Achievements Card) */}
            <div className="pt-3 border-t border-[var(--border)] space-y-2">
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                Chỉ Số Lập Trình
              </h3>
              <div className="grid grid-cols-3 gap-2 p-3 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] text-center font-mono">
                <div>
                  <div className="text-base font-bold text-[var(--accent-text)]">
                    {stats?.accepted_number ?? solvedProblems.length}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">Đã giải</div>
                </div>
                <div className="border-x border-[var(--border)]">
                  <div className="text-base font-bold text-[var(--text-primary)]">
                    {stats?.submission_number ?? subs.length}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">Lượt nộp</div>
                </div>
                <div>
                  <div className="text-base font-bold text-[var(--text-primary)]">
                    {stats?.total_score ?? 0}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">Điểm OI</div>
                </div>
              </div>
            </div>

          </div>

          {/* CỘT PHẢI (8-9 cols): GITHUB CONTENT AREA */}
          <div className="md:col-span-8 lg:col-span-9 space-y-6 min-w-0">
            
            {/* TAB 1: TỔNG QUAN (OVERVIEW) */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                
                {/* 1. PINNED REPOSITORY CARDS (BÀI TẬP ĐÃ GIẢI NỔI BẬT) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold text-[var(--text-primary)]">
                      Bài tập tiêu biểu (Pinned)
                    </h2>
                    <button
                      onClick={() => setActiveTab('solved')}
                      className="text-xs text-[var(--accent-text)] hover:underline font-medium"
                    >
                      Xem tất cả ({solvedProblems.length}) →
                    </button>
                  </div>

                  {pinnedProblems.length === 0 ? (
                    <div className="p-8 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] text-center text-xs text-[var(--text-secondary)]">
                      Chưa có bài tập nào được giải quyết thành công (AC).
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {pinnedProblems.map((prob) => {
                        const langInfo = LANG_COLORS[prob.language] || { bg: '#888', label: prob.language.toUpperCase() };
                        const diffMeta = DIFF_LABEL[prob.difficulty] || { label: prob.difficulty, text: 'text-[var(--text-secondary)]' };
                        return (
                          <div
                            key={prob.problemId}
                            className="flex flex-col justify-between p-4 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--text-muted)] transition-colors group"
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <Link
                                  to={`/problems/${prob.slug}?sub=${prob.submissionId}`}
                                  state={{ code: prob.code, language: prob.language, submissionId: prob.submissionId }}
                                  className="text-xs font-semibold text-[#0969DA] dark:text-[#58A6FF] hover:underline flex items-center gap-1.5 break-all"
                                >
                                  <MorphIcon icon={FileCode2Data} size={14} className="shrink-0 text-[var(--text-muted)]" />
                                  <span>{prob.title}</span>
                                </Link>
                                <span className="px-1.5 py-0.2 rounded-full border border-[var(--border)] text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-tertiary)] shrink-0">
                                  Public
                                </span>
                              </div>

                              {/* Tags */}
                              <div className="flex flex-wrap gap-1">
                                {(prob.tags || []).slice(0, 3).map((t) => (
                                  <span
                                    key={t}
                                    className="px-1.5 py-0.2 rounded text-[10px] font-mono border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Card Footer: Language dot + Difficulty + Runtime */}
                            <div className="flex items-center justify-between pt-3 mt-3 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] font-mono">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: langInfo.bg }} />
                                <span>{langInfo.label}</span>
                              </div>
                              <span className={`font-medium ${diffMeta.text}`}>
                                {diffMeta.label}
                              </span>
                              <span>{prob.bestTimeMs}ms</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. ACTIVITY & LANGUAGE USAGE BAR */}
                {languageStats.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-xs font-semibold text-[var(--text-primary)]">
                      Ngôn Ngữ Thường Dùng
                    </h2>
                    
                    <div className="p-4 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] space-y-3">
                      {/* GitHub Multi-color progress bar */}
                      <div className="h-2 w-full rounded-full overflow-hidden flex bg-[var(--bg-tertiary)]">
                        {languageStats.map((item) => {
                          const meta = LANG_COLORS[item.lang] || { bg: '#888', label: item.lang };
                          return (
                            <div
                              key={item.lang}
                              style={{ width: `${item.percent}%`, backgroundColor: meta.bg }}
                              title={`${meta.label}: ${item.percent}%`}
                            />
                          );
                        })}
                      </div>

                      {/* Legend */}
                      <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                        {languageStats.map((item) => {
                          const meta = LANG_COLORS[item.lang] || { bg: '#888', label: item.lang };
                          return (
                            <div key={item.lang} className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.bg }} />
                              <span className="font-medium text-[var(--text-primary)]">{meta.label}</span>
                              <span className="text-[var(--text-muted)]">{item.percent}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. RECENT ACTIVITY TIMELINE */}
                <div className="space-y-3">
                  <h2 className="text-xs font-semibold text-[var(--text-primary)]">
                    Hoạt Động Gần Đây (Activity)
                  </h2>

                  {subs.length === 0 ? (
                    <div className="p-6 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] text-center text-xs text-[var(--text-secondary)]">
                      Chưa có hoạt động nộp bài nào.
                    </div>
                  ) : (
                    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] divide-y divide-[var(--border)]">
                      {subs.slice(0, 5).map((sub) => {
                        const statusMeta = STATUS_META[sub.status] || { label: sub.status, cls: 'text-[var(--text-muted)]' };
                        return (
                          <div key={sub.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`shrink-0 px-1.5 py-0.2 rounded text-[10px] font-mono border font-semibold ${statusMeta.cls}`}>
                                {statusMeta.label}
                              </span>
                              <Link
                                to={`/problems/${sub.problems?.slug || ''}?sub=${sub.id}`}
                                state={{ code: sub.code, language: sub.language, submissionId: sub.id }}
                                className="font-medium text-[var(--text-primary)] hover:text-[#0969DA] dark:hover:text-[#58A6FF] truncate"
                              >
                                {sub.problems?.title || 'Bài tập'}
                              </Link>
                            </div>

                            <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--text-muted)] shrink-0">
                              <span className="uppercase">{sub.language}</span>
                              <span>{sub.time_used_ms}ms</span>
                              <span className="hidden sm:inline">
                                {new Date(sub.created_at).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB 2: BÀI ĐÃ GIẢI (SOLVED REPOSITORIES LIST) */}
            {activeTab === 'solved' && (
              <div className="space-y-4">
                {/* Search & Filter toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
                  <div className="relative flex-1 max-w-sm">
                    <MorphIcon icon={SearchData} size={14} className="text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm bài tập đã giải..."
                      value={searchSolved}
                      onChange={(e) => setSearchSolved(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#0969DA] dark:focus:border-[#58A6FF]"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {(['ALL', 'Easy', 'Medium', 'Hard'] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDiffFilter(d)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          diffFilter === d
                            ? 'bg-[var(--accent)] text-white'
                            : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                      >
                        {d === 'ALL' ? 'Tất cả' : DIFF_LABEL[d]?.label || d}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredSolved.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[var(--text-secondary)]">
                    Không tìm thấy bài tập đã giải nào phù hợp.
                  </div>
                ) : (
                  <div className="rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] divide-y divide-[var(--border)]">
                    {filteredSolved.map((prob) => {
                      const langInfo = LANG_COLORS[prob.language] || { bg: '#888', label: prob.language.toUpperCase() };
                      const diffMeta = DIFF_LABEL[prob.difficulty] || { label: prob.difficulty, text: 'text-[var(--text-secondary)]' };
                      return (
                        <div key={prob.problemId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <Link
                                to={`/problems/${prob.slug}?sub=${prob.submissionId}`}
                                state={{ code: prob.code, language: prob.language, submissionId: prob.submissionId }}
                                className="text-sm font-semibold text-[#0969DA] dark:text-[#58A6FF] hover:underline"
                              >
                                {prob.title}
                              </Link>
                              <span className="px-1.5 py-0.2 rounded-full border border-[var(--border)] text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-tertiary)]">
                                Public
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] font-mono">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: langInfo.bg }} />
                                <span>{langInfo.label}</span>
                              </div>
                              <span className={`font-medium ${diffMeta.text}`}>{diffMeta.label}</span>
                              <span>{prob.bestTimeMs}ms · {prob.bestMemoryMb}MB</span>
                              <span>AC: {new Date(prob.solvedAt).toLocaleDateString('vi-VN')}</span>
                            </div>
                          </div>

                          <Link
                            to={`/problems/${prob.slug}?sub=${prob.submissionId}`}
                            state={{ code: prob.code, language: prob.language, submissionId: prob.submissionId }}
                            className="self-start sm:self-auto px-3 py-1 rounded-md bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] transition-colors shrink-0 shadow-xs"
                          >
                            Làm lại bài
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: NHẬT KÝ NỘP BÀI (SUBMISSIONS TABLE) */}
            {activeTab === 'submissions' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-[var(--text-primary)]">
                    Lịch Sử Nộp Bài ({subs.length})
                  </h2>
                </div>

                {subs.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[var(--text-secondary)]">
                    Chưa có bài nộp nào trên hệ thống.
                  </div>
                ) : (
                  <div className="bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] overflow-hidden">
                    <div className="w-full overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-b border-[var(--border)] font-medium text-[11px]">
                          <tr>
                            <th className="px-4 py-2.5">Thời Gian</th>
                            <th className="px-4 py-2.5">Bài Tập</th>
                            <th className="px-4 py-2.5">Kết Quả</th>
                            <th className="px-4 py-2.5">Thời Gian / RAM</th>
                            <th className="px-4 py-2.5 text-right">Ngôn Ngữ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)] font-mono text-[11px]">
                          {subs.map((sub) => {
                            const statusMeta = STATUS_META[sub.status] || { label: sub.status, cls: 'text-[var(--text-muted)]' };
                            return (
                              <tr key={sub.id} className="hover:bg-[var(--bg-primary)] transition-colors">
                                <td className="px-4 py-2.5 text-[var(--text-muted)] whitespace-nowrap">
                                  {new Date(sub.created_at).toLocaleString('vi-VN', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="px-4 py-2.5 font-sans font-medium text-[var(--text-primary)]">
                                  <Link
                                    to={`/problems/${sub.problems?.slug || ''}?sub=${sub.id}`}
                                    state={{ code: sub.code, language: sub.language, submissionId: sub.id }}
                                    className="hover:text-[#0969DA] dark:hover:text-[#58A6FF] transition-colors"
                                  >
                                    {sub.problems?.title || 'Bài tập'}
                                  </Link>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className={`inline-block px-1.5 py-0.2 rounded border font-semibold ${statusMeta.cls}`}>
                                    {statusMeta.label}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                                  {sub.time_used_ms}ms · {sub.memory_used_mb}MB
                                </td>
                                <td className="px-4 py-2.5 text-right text-[var(--text-secondary)] uppercase">
                                  {sub.language}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
