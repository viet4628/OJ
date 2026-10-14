import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Shuffle, RefreshCw, Tag, CheckCircle2, Circle, Loader2,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown,
  Clock, Database, CircleDot, ListFilter,
} from 'lucide-react';
import { getProblems, getMyAcceptedProblemIds, getMyAttemptedProblemIds, type Problem } from '../../lib/api';

type SortKey = 'title' | 'difficulty' | 'time' | 'memory';
type StatusFilter = 'ALL' | 'SOLVED' | 'ATTEMPTED' | 'TODO';

const PAGE_SIZE = 20;

const DIFF_META = {
  Low: { label: 'Dễ', short: 'Low', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  Mid: { label: 'Trung bình', short: 'Mid', cls: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  High: { label: 'Khó', short: 'High', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
} as const;

const diffKey = (p: Problem): keyof typeof DIFF_META =>
  p.difficulty === 'Easy' ? 'Low' : p.difficulty === 'Medium' ? 'Mid' : 'High';

const fmtTime = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s` : `${ms}ms`);

export default function Problems() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [attemptedIds, setAttemptedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [difficulty, setDifficulty] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedTag, setSelectedTag] = useState<string>(() => searchParams.get('tag') || '');
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = searchParams.get('tag');
    if (t !== null) setSelectedTag(t);
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      try {
        const [probs, accepted, attempted] = await Promise.all([
          getProblems(),
          getMyAcceptedProblemIds(),
          getMyAttemptedProblemIds(),
        ]);
        setProblems(probs);
        setAcceptedIds(new Set(accepted));
        setAttemptedIds(new Set(attempted));
      } catch (err) {
        console.error('Failed to load problems:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const allTags = useMemo(
    () => [...new Set(problems.flatMap((p) => p.tags || []))].sort((a, b) => a.localeCompare(b)),
    [problems]
  );

  const statusOf = (id: string): 'SOLVED' | 'ATTEMPTED' | 'TODO' =>
    acceptedIds.has(id) ? 'SOLVED' : attemptedIds.has(id) ? 'ATTEMPTED' : 'TODO';

  // Đếm số bài theo độ khó (hiển thị trên segmented control)
  const diffCounts = useMemo(() => {
    const c: Record<string, number> = { ALL: problems.length, Low: 0, Mid: 0, High: 0 };
    for (const p of problems) c[diffKey(p)]++;
    return c;
  }, [problems]);

  const filteredProblems = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const rows = problems.filter((p) => {
      const matchesKeyword =
        kw === '' || p.title.toLowerCase().includes(kw) || p.slug.toLowerCase().includes(kw);
      const matchesDiff = difficulty === 'ALL' || diffKey(p) === difficulty;
      const matchesTag = selectedTag === '' || (p.tags || []).includes(selectedTag);
      const matchesStatus = statusFilter === 'ALL' || statusOf(p.id) === statusFilter;
      return matchesKeyword && matchesDiff && matchesTag && matchesStatus;
    });

    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'title') cmp = a.title.localeCompare(b.title, 'vi');
      else if (sortKey === 'difficulty') {
        const order = { Low: 0, Mid: 1, High: 2 };
        cmp = order[diffKey(a)] - order[diffKey(b)];
      } else if (sortKey === 'time') cmp = a.time_limit_ms - b.time_limit_ms;
      else if (sortKey === 'memory') cmp = a.memory_limit_mb - b.memory_limit_mb;
      return cmp * sortDir;
    });
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problems, keyword, difficulty, selectedTag, statusFilter, sortKey, sortDir, acceptedIds, attemptedIds]);

  const totalPages = Math.max(1, Math.ceil(filteredProblems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filteredProblems.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => { setPage(0); }, [keyword, difficulty, selectedTag, statusFilter]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  const handleReset = () => {
    setKeyword('');
    setDifficulty('ALL');
    setStatusFilter('ALL');
    setSelectedTag('');
  };

  const handlePickOne = () => {
    if (filteredProblems.length === 0) return;
    const randomProblem = filteredProblems[Math.floor(Math.random() * filteredProblems.length)];
    navigate(`/problems/${randomProblem.slug}`);
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? (
      <ChevronsUpDown className="w-3 h-3 opacity-40" />
    ) : sortDir === 1 ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );

  const STATUS_META = {
    SOLVED: { icon: <CheckCircle2 className="w-[18px] h-[18px] text-emerald-600" />, label: 'Đã giải' },
    ATTEMPTED: { icon: <CircleDot className="w-[18px] h-[18px] text-amber-500" />, label: 'Đã thử' },
    TODO: { icon: <Circle className="w-[18px] h-[18px] text-slate-300" />, label: 'Chưa làm' },
  } as const;

  return (
    <div className="w-full flex flex-col lg:flex-row items-start gap-6">
      {/* Left Column: Problem List Table */}
      <div className="w-full lg:w-3/4 space-y-4 min-w-0">
        <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-secondary)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                Danh Sách Bài Tập
                {!isLoading && (
                  <span className="font-mono text-[11px] font-bold text-[var(--text-muted)] normal-case">
                    {filteredProblems.length}/{problems.length}
                  </span>
                )}
              </h1>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Trạng thái của tôi */}
                <div className="relative">
                  <ListFilter className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[var(--text-secondary)] font-bold focus:outline-none focus:border-[var(--accent)] cursor-pointer appearance-none"
                    title="Lọc theo trạng thái của bạn"
                  >
                    <option value="ALL">Mọi trạng thái</option>
                    <option value="SOLVED">✓ Đã giải</option>
                    <option value="ATTEMPTED">● Đã thử</option>
                    <option value="TODO">○ Chưa làm</option>
                  </select>
                </div>

                {/* Tìm kiếm */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên / mã bài..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] w-48 transition-colors"
                  />
                </div>

                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] font-bold text-xs transition-colors cursor-pointer"
                  title="Xóa bộ lọc"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reset
                </button>
              </div>
            </div>

            {/* Độ khó — segmented pills có đếm số */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {(['ALL', 'Low', 'Mid', 'High'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    difficulty === d
                      ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-sm'
                      : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  {d !== 'ALL' && (
                    <span className={`w-1.5 h-1.5 rounded-full ${DIFF_META[d].dot}`} />
                  )}
                  {d === 'ALL' ? 'Tất cả' : DIFF_META[d].label}
                  <span className={`font-mono ${difficulty === d ? 'text-white/60' : 'text-[var(--text-muted)]'}`}>
                    {diffCounts[d]}
                  </span>
                </button>
              ))}
              {selectedTag !== '' && (
                <span className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent-text)] text-[11px] font-bold">
                  <Tag className="w-3 h-3" /> {selectedTag}
                  <button onClick={() => setSelectedTag('')} className="hover:text-red-600 ml-0.5">✕</button>
                </span>
              )}
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-[var(--text-secondary)] font-bold">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" /> Đang tải danh sách bài tập...
            </div>
          ) : filteredProblems.length === 0 ? (
            <div className="py-16 text-center text-xs text-[var(--text-secondary)]">
              {problems.length === 0
                ? 'Chưa có bài tập công khai nào được tạo trên hệ thống.'
                : 'Không tìm thấy bài tập phù hợp với bộ lọc hiện tại.'}
              {(keyword || difficulty !== 'ALL' || selectedTag !== '' || statusFilter !== 'ALL') && (
                <button
                  onClick={handleReset}
                  className="block mx-auto mt-3 px-4 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] font-bold text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-b border-[var(--border)] font-bold text-[11px] uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center" title="Trạng thái của bạn">✓</th>
                      <th
                        className="px-4 py-3 cursor-pointer hover:text-[var(--text-primary)] select-none"
                        onClick={() => toggleSort('title')}
                      >
                        <span className="inline-flex items-center gap-1">Bài Tập <SortIcon k="title" /></span>
                      </th>
                      <th
                        className="px-4 py-3 w-28 cursor-pointer hover:text-[var(--text-primary)] select-none"
                        onClick={() => toggleSort('difficulty')}
                      >
                        <span className="inline-flex items-center gap-1">Độ Khó <SortIcon k="difficulty" /></span>
                      </th>
                      <th
                        className="px-4 py-3 w-32 cursor-pointer hover:text-[var(--text-primary)] select-none"
                        onClick={() => toggleSort('time')}
                      >
                        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Giới Hạn <SortIcon k="time" /></span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {pageRows.map((p) => {
                      const st = statusOf(p.id);
                      const meta = DIFF_META[diffKey(p)];
                      return (
                        <tr key={p.id} className="group hover:bg-[var(--bg-secondary)]/70 transition-colors">
                          {/* Trạng thái cá nhân */}
                          <td className="px-4 py-3 text-center" title={STATUS_META[st].label}>
                            {STATUS_META[st].icon}
                          </td>

                          {/* Tên bài + slug + tags inline */}
                          <td className="px-4 py-3">
                            <Link
                              to={`/problems/${p.slug}`}
                              className="font-bold text-[13px] text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors inline-flex items-baseline gap-2"
                            >
                              <span>{p.title}</span>
                              <span className="font-mono text-[10px] text-[var(--text-muted)] hidden sm:inline">{p.slug}</span>
                            </Link>
                            {(p.tags?.length ?? 0) > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(p.tags || []).slice(0, 3).map((t) => (
                                  <span key={t} className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)] font-mono text-[10px]">
                                    {t}
                                  </span>
                                ))}
                                {(p.tags?.length ?? 0) > 3 && (
                                  <span className="px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                                    +{(p.tags?.length ?? 0) - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Độ khó */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-black border uppercase tracking-wide ${meta.cls}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                              {meta.short}
                            </span>
                          </td>

                          {/* Giới hạn gộp 1 ô */}
                          <td className="px-4 py-3 text-[var(--text-secondary)] font-code whitespace-nowrap">
                            <span title="Giới hạn thời gian">{fmtTime(p.time_limit_ms)}</span>
                            <span className="mx-1.5 text-[var(--border)]">·</span>
                            <span title="Giới hạn bộ nhớ" className="inline-flex items-center gap-1">
                              <Database className="w-3 h-3 opacity-60" />{p.memory_limit_mb}MB
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-between text-xs">
                <span className="font-mono text-[11px] text-[var(--text-muted)]">
                  Hiển thị {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filteredProblems.length)} / {filteredProblems.length} bài
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(safePage - 1)}
                    disabled={safePage === 0}
                    className="p-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                    title="Trang trước"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 font-mono font-bold text-[var(--text-secondary)]">
                    {safePage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(safePage + 1)}
                    disabled={safePage >= totalPages - 1}
                    className="p-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                    title="Trang sau"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-1 text-[11px] text-[var(--text-muted)] font-semibold">
          {Object.entries(STATUS_META).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5">{v.icon} {v.label}</span>
          ))}
        </div>
      </div>

      {/* Right Column: Tags Panel & Pick One */}
      <div className="w-full lg:w-1/4 space-y-4 shrink-0">
        <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-sm p-5 space-y-4">
          <h2 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2 border-b border-[var(--border)] pb-3">
            <Tag className="w-4 h-4 text-[var(--accent-text)]" /> Tags Catalog
          </h2>

          <div className="flex flex-wrap gap-1.5 pt-1 max-h-64 overflow-y-auto">
            <button
              onClick={() => setSelectedTag('')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                selectedTag === ''
                  ? 'bg-[var(--accent)] text-[var(--text-primary)] shadow-sm'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              All Tags
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  selectedTag === tag
                    ? 'bg-[var(--accent)] text-[var(--text-primary)] shadow-sm'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* QingdaoU "Pick One" Random Button */}
          <button
            onClick={handlePickOne}
            disabled={filteredProblems.length === 0}
            className="w-full mt-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Shuffle className="w-4 h-4 text-amber-400" /> Pick One (Random Problem)
          </button>
        </div>
      </div>
    </div>
  );
}
