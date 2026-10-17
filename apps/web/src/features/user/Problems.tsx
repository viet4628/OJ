import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import MorphIcon from '../../components/MorphIcon';
import {
  Search as SearchData,
  Shuffle as ShuffleData,
  RefreshCw as RefreshCwData,
  Tag as TagData,
  CheckCircle2 as CheckCircle2Data,
  Circle as CircleData,
  CircleDot as CircleDotData,
  ChevronLeft as ChevronLeftData,
  ChevronRight as ChevronRightData,
  ChevronUp as ChevronUpData,
  ChevronDown as ChevronDownData,
  ChevronsUpDown as ChevronsUpDownData,
  Loader2 as Loader2Data,
} from 'lucide';
import { getProblems, getMyAcceptedProblemIds, getMyAttemptedProblemIds, type Problem } from '../../lib/api';

type SortKey = 'title' | 'difficulty' | 'time' | 'memory';
type StatusFilter = 'ALL' | 'SOLVED' | 'ATTEMPTED' | 'TODO';

const PAGE_SIZE = 20;

const DIFF_META = {
  Low: { label: 'Dễ', short: 'Low', cls: 'bg-[var(--bg-tertiary)] text-emerald-700 border-[var(--border)]', dot: 'bg-emerald-500' },
  Mid: { label: 'Trung bình', short: 'Mid', cls: 'bg-[var(--bg-tertiary)] text-sky-700 border-[var(--border)]', dot: 'bg-sky-500' },
  High: { label: 'Khó', short: 'High', cls: 'bg-[var(--bg-tertiary)] text-amber-700 border-[var(--border)]', dot: 'bg-amber-500' },
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

  const SortIcon = ({ k }: { k: SortKey }) => (
    <MorphIcon
      icon={sortKey !== k ? ChevronsUpDownData : sortDir === 1 ? ChevronUpData : ChevronDownData}
      size={12}
      spring="snappy"
      className={sortKey === k ? 'text-[var(--accent-text)]' : 'text-[var(--text-muted)] opacity-50'}
    />
  );

  const STATUS_META = {
    SOLVED: { icon: <MorphIcon icon={CheckCircle2Data} size={15} className="text-[#1F883D] dark:text-[#238636]" />, label: 'Đã giải' },
    ATTEMPTED: { icon: <MorphIcon icon={CircleDotData} size={15} className="text-amber-500" />, label: 'Đã thử' },
    TODO: { icon: <MorphIcon icon={CircleData} size={15} className="text-[var(--text-muted)] opacity-60" />, label: 'Chưa làm' },
  } as const;

  return (
    <div className="w-full flex flex-col lg:flex-row items-start gap-4">
      {/* Left Column: Problem List Table */}
      <div className="w-full lg:w-3/4 space-y-3 min-w-0">
        <div className="bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] overflow-hidden">
          {/* GitHub-style Box Header Toolbar */}
          <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-secondary)] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Bài Tập Lập Trình
                </span>
                {!isLoading && (
                  <span className="px-1.5 py-0.2 rounded-full border border-[var(--border)] text-[10px] font-mono text-[var(--text-secondary)] bg-[var(--bg-tertiary)]">
                    {filteredProblems.length}/{problems.length}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Trạng thái cá nhân */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-2.5 py-1 text-xs text-[var(--text-primary)] font-medium focus:outline-none focus:border-[#0969DA] dark:focus:border-[#58A6FF] cursor-pointer"
                  title="Lọc theo trạng thái"
                >
                  <option value="ALL">Mọi trạng thái</option>
                  <option value="SOLVED">Đã giải</option>
                  <option value="ATTEMPTED">Đã thử</option>
                  <option value="TODO">Chưa làm</option>
                </select>

                {/* Tìm kiếm */}
                <div className="relative">
                  <MorphIcon icon={SearchData} size={13} className="text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Lọc bài tập..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-md pl-8 pr-2.5 py-1 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#0969DA] dark:focus:border-[#58A6FF] w-44 sm:w-52 transition-colors"
                  />
                </div>

                <button
                  onClick={handleReset}
                  className="px-2.5 py-1 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium text-xs transition-colors cursor-pointer"
                  title="Xóa bộ lọc"
                >
                  <MorphIcon icon={RefreshCwData} size={13} className="inline mr-1" /> Đặt lại
                </button>
              </div>
            </div>

            {/* GitHub-style Underline Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
              {(['ALL', 'Low', 'Mid', 'High'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                    difficulty === d
                      ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <span>{d === 'ALL' ? 'Tất cả' : DIFF_META[d].label}</span>
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">
                    {diffCounts[d]}
                  </span>
                </button>
              ))}

              {selectedTag !== '' && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-[11px] font-mono">
                  <span>tag: {selectedTag}</span>
                  <button onClick={() => setSelectedTag('')} className="hover:text-[var(--danger)] ml-0.5 cursor-pointer">✕</button>
                </span>
              )}
            </div>
          </div>

          {/* Table / List View */}
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-[var(--text-secondary)] font-medium">
              <MorphIcon icon={Loader2Data} size={16} className="animate-spin text-[var(--accent-text)]" /> Đang tải danh sách bài tập...
            </div>
          ) : filteredProblems.length === 0 ? (
            <div className="py-16 text-center text-xs text-[var(--text-secondary)]">
              {problems.length === 0
                ? 'Chưa có bài tập nào được tạo.'
                : 'Không tìm thấy bài tập phù hợp.'}
              {(keyword || difficulty !== 'ALL' || selectedTag !== '' || statusFilter !== 'ALL') && (
                <button
                  onClick={handleReset}
                  className="block mx-auto mt-3 px-3 py-1 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer text-xs"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-b border-[var(--border)] font-semibold text-[11px]">
                    <tr>
                      <th className="px-3.5 py-2.5 w-10 text-center">TT</th>
                      <th
                        className="px-3.5 py-2.5 cursor-pointer hover:text-[var(--text-primary)] select-none"
                        onClick={() => toggleSort('title')}
                      >
                        <span className="inline-flex items-center gap-1">Tên Bài Tập <SortIcon k="title" /></span>
                      </th>
                      <th
                        className="px-3.5 py-2.5 w-28 cursor-pointer hover:text-[var(--text-primary)] select-none"
                        onClick={() => toggleSort('difficulty')}
                      >
                        <span className="inline-flex items-center gap-1">Độ Khó <SortIcon k="difficulty" /></span>
                      </th>
                      <th
                        className="px-3.5 py-2.5 w-32 cursor-pointer hover:text-[var(--text-primary)] select-none"
                        onClick={() => toggleSort('time')}
                      >
                        <span className="inline-flex items-center gap-1">Giới Hạn <SortIcon k="time" /></span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {pageRows.map((p) => {
                      const st = statusOf(p.id);
                      const meta = DIFF_META[diffKey(p)];
                      return (
                        <tr key={p.id} className="group hover:bg-[var(--bg-tertiary)] transition-colors">
                          {/* Trạng thái */}
                          <td className="px-3.5 py-2.5 text-center" title={STATUS_META[st].label}>
                            <div className="flex items-center justify-center">
                              {STATUS_META[st].icon}
                            </div>
                          </td>

                          {/* Tên bài + slug + tags */}
                          <td className="px-3.5 py-2.5">
                            <div className="flex items-baseline gap-2">
                              <Link
                                to={`/problems/${p.slug}`}
                                className="font-semibold text-xs text-[var(--text-primary)] hover:text-[#0969DA] dark:hover:text-[#58A6FF] transition-colors"
                              >
                                {p.title}
                              </Link>
                              <span className="font-mono text-[10px] text-[var(--text-muted)] hidden sm:inline">{p.slug}</span>
                            </div>
                            {(p.tags?.length ?? 0) > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(p.tags || []).slice(0, 3).map((t) => (
                                  <span key={t} className="px-1.5 py-0.2 rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] font-mono text-[10px]">
                                    {t}
                                  </span>
                                ))}
                                {(p.tags?.length ?? 0) > 3 && (
                                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                                    +{(p.tags?.length ?? 0) - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Độ khó */}
                          <td className="px-3.5 py-2.5">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                              {meta.label}
                            </span>
                          </td>

                          {/* Giới hạn */}
                          <td className="px-3.5 py-2.5 text-[var(--text-secondary)] font-mono text-[11px] whitespace-nowrap">
                            <span>{fmtTime(p.time_limit_ms)}</span>
                            <span className="mx-1.5 text-[var(--text-muted)]">/</span>
                            <span>{p.memory_limit_mb}MB</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-3.5 py-2.5 border-t border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-between text-xs">
                <span className="font-mono text-[11px] text-[var(--text-muted)]">
                  {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filteredProblems.length)} trên {filteredProblems.length} bài
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(safePage - 1)}
                    disabled={safePage === 0}
                    className="p-1 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                    title="Trang trước"
                  >
                    <MorphIcon icon={ChevronLeftData} size={14} />
                  </button>
                  <span className="px-2 font-mono text-xs text-[var(--text-secondary)]">
                    {safePage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(safePage + 1)}
                    disabled={safePage >= totalPages - 1}
                    className="p-1 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                    title="Trang sau"
                  >
                    <MorphIcon icon={ChevronRightData} size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-1 text-[11px] text-[var(--text-muted)] font-medium">
          {Object.entries(STATUS_META).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5">{v.icon} {v.label}</span>
          ))}
        </div>
      </div>

      {/* Right Column: Tags & Random Pick */}
      <div className="w-full lg:w-1/4 space-y-3 shrink-0">
        <div className="bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] p-3.5 space-y-3">
          <div className="border-b border-[var(--border)] pb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              Danh Mục Nhãn
            </span>
            <MorphIcon icon={TagData} size={14} className="text-[var(--text-muted)]" />
          </div>

          <div className="flex flex-wrap gap-1 max-h-64 overflow-y-auto">
            <button
              onClick={() => setSelectedTag('')}
              className={`px-2 py-0.5 rounded-full text-xs font-medium font-mono transition-colors cursor-pointer border ${
                selectedTag === ''
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-text)]'
                  : 'border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              All Tags
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                className={`px-2 py-0.5 rounded-full text-xs font-medium font-mono transition-colors cursor-pointer border ${
                  selectedTag === tag
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-text)]'
                    : 'border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Random Pick Button */}
          <button
            onClick={handlePickOne}
            disabled={filteredProblems.length === 0}
            className="w-full mt-2 py-1.5 rounded-md bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium text-xs flex items-center justify-center gap-1.5 transition-colors border border-[var(--border)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MorphIcon icon={ShuffleData} size={14} className="text-[var(--text-secondary)]" /> Chọn Ngẫu Nhiên
          </button>
        </div>
      </div>
    </div>
  );
}
