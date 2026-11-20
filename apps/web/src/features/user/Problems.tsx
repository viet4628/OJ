import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import MorphIcon from '../../components/MorphIcon';
import ProblemDifficulty, { difficultyLabels } from '../../components/ProblemDifficulty';
import { CheckCircle2, CircleDot, Circle } from 'lucide-react';
import { Shuffle as ShuffleData, RefreshCw as RefreshCwData, ChevronLeft as ChevronLeftData, ChevronRight as ChevronRightData, ChevronUp as ChevronUpData, ChevronDown as ChevronDownData, ChevronsUpDown as ChevronsUpDownData, Loader2 as Loader2Data, Search as SearchData } from 'lucide';
import { getProblemPage, type ProblemPageRow } from '../../lib/api';

type SortKey = 'title' | 'difficulty' | 'time' | 'memory';
type StatusFilter = 'ALL' | 'SOLVED' | 'ATTEMPTED' | 'TODO';

const PAGE_SIZE = 20;

const DIFF_META = {
  Low: { label: difficultyLabels.Easy },
  Mid: { label: difficultyLabels.Medium },
  High: { label: difficultyLabels.Hard },
} as const;

const fmtTime = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s` : `${ms}ms`);

export default function Problems() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pageRows, setPageRows] = useState<ProblemPageRow[]>([]);
  const [total, setTotal] = useState(0);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [diffCounts, setDiffCounts] = useState<Record<string, number>>({ ALL: 0, Low: 0, Mid: 0, High: 0 });
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [difficulty, setDifficulty] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedTag, setSelectedTag] = useState<string>(() => searchParams.get('tag') || '');
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleSlash = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleSlash);
    return () => window.removeEventListener('keydown', handleSlash);
  }, []);

  useEffect(() => {
    const t = searchParams.get('tag');
    if (t !== null) setSelectedTag(t);
  }, [searchParams]);

  const filters = { keyword, difficulty: difficulty === 'Low' ? 'Easy' : difficulty === 'Mid' ? 'Medium' : difficulty === 'High' ? 'Hard' : 'ALL',
    tag: selectedTag, status: statusFilter, sort: sortKey, desc: sortDir === -1 };

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError('');
    const timer = window.setTimeout(() => {
      getProblemPage({ ...filters, page }, controller.signal).then(result => {
        if (controller.signal.aborted) return;
        setPageRows(result.rows);
        setTotal(result.total);
        setDiffCounts(result.counts);
        setAllTags(result.tags);
        const lastPage = Math.max(0, Math.ceil(result.total / PAGE_SIZE) - 1);
        if (page > lastPage) setPage(lastPage);
      }).catch(() => {
        if (!controller.signal.aborted) setError('Không tải được danh sách bài tập. Vui lòng thử lại.');
      }).finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [page, keyword, difficulty, selectedTag, statusFilter, sortKey, sortDir, retry]);

  const statusOf = (id: string) => pageRows.find(row => row.id === id)?.progress ?? 'TODO';
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  useEffect(() => { setPage(0); }, [keyword, difficulty, selectedTag, statusFilter, sortKey, sortDir]);

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

  const handlePickOne = async () => {
    if (total === 0) return;
    try {
      const result = await getProblemPage({ ...filters, page: Math.floor(Math.random() * total), pageSize: 1 });
      if (result.rows[0]) navigate(`/problems/${result.rows[0].slug}`);
    } catch { setError('Không chọn được bài tập. Vui lòng thử lại.'); }
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
    SOLVED: { label: 'Đã giải', icon: CheckCircle2, color: 'text-[var(--accent-text)]' },
    ATTEMPTED: { label: 'Đã thử', icon: CircleDot, color: 'text-[var(--text-secondary)]' },
    TODO: { label: 'Chưa làm', icon: Circle, color: 'text-[var(--text-muted)] opacity-40' },
  } as const;

  return (
    <div className="space-y-4">
      {/* Progsity Style Problem Library Hero */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--bg-secondary)] p-4 sm:p-5 rounded-md border border-[var(--border)] shadow-xs">
        <div>
          <h1 className="text-base sm:text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Thư viện bài tập
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Kho bài tập đa dạng từ các kỳ thi thuật toán và giáo trình lập trình thi đấu.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/learn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shadow-xs"
          >
            Lộ trình học tập
          </Link>
          <button
            onClick={handlePickOne}
            disabled={total === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-40"
            title="Làm một bài tập ngẫu nhiên"
          >
            <MorphIcon icon={ShuffleData} size={13} />
            <span>Bài tập ngẫu nhiên</span>
          </button>
        </div>
      </div>

      <div className="w-full flex flex-col lg:flex-row items-start gap-4">
        {/* Left Column: Problem List Table */}
        <div className="w-full lg:w-3/4 space-y-3 min-w-0">
          <div className="bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] overflow-hidden">
            {/* Box Header Toolbar */}
            <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-secondary)] space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    Danh Sách Bài
                  </span>
                  {!isLoading && (
                    <span className="px-1.5 py-0.2 rounded-full border border-[var(--border)] text-[10px] font-mono text-[var(--text-secondary)] bg-[var(--bg-tertiary)]">
                      {total}/{diffCounts.ALL}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Trạng thái cá nhân */}
                  <select aria-label="Lọc theo trạng thái"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-2.5 py-1 text-xs text-[var(--text-primary)] font-medium focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                    title="Lọc theo trạng thái"
                  >
                    <option value="ALL">Mọi trạng thái</option>
                    <option value="SOLVED">Đã giải</option>
                    <option value="ATTEMPTED">Đã thử</option>
                    <option value="TODO">Chưa làm</option>
                  </select>

                  {/* Tìm kiếm */}
                  <div className="relative">
                    <MorphIcon
                      icon={SearchData}
                      size={13}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
                    />
                    <input aria-label="Lọc bài tập"
                      ref={searchInputRef}
                      type="text"
                      placeholder="Tìm bài tập... (nhấn /)"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-md pl-8 pr-2.5 py-1 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] w-44 sm:w-56 transition-colors shadow-xs"
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
          {error && <p role="alert" className="p-4 text-sm">{error} <button onClick={() => setRetry(value => value + 1)} className="text-[var(--accent)]">Thử lại</button></p>}
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-[var(--text-secondary)] font-medium">
              <MorphIcon icon={Loader2Data} size={16} className="animate-spin text-[var(--accent-text)]" /> Đang tải danh sách bài tập...
            </div>
          ) : total === 0 ? (
            <div className="py-16 text-center text-xs text-[var(--text-secondary)]">
              {diffCounts.ALL === 0
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
                <table className="w-full min-w-[520px] text-left text-xs">
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
                      const StatusIcon = STATUS_META[st].icon;
                      return (
                        <tr key={p.id} className="group hover:bg-[var(--bg-tertiary)] transition-colors">
                          {/* Trạng thái */}
                          <td className="px-3.5 py-2.5 text-center" title={STATUS_META[st].label}>
                            <span role="img" aria-label={STATUS_META[st].label} className="inline-flex align-middle">
                              <StatusIcon size={16} className={STATUS_META[st].color} aria-hidden="true" />
                            </span>
                          </td>

                          {/* Tên bài + slug + tags */}
                          <td className="px-3.5 py-2.5">
                            <div className="flex items-baseline gap-2">
                              <Link
                                to={`/problems/${p.slug}`}
                                className="font-semibold text-xs text-[var(--text-primary)] hover:text-[var(--accent-text)] transition-colors"
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
                            <ProblemDifficulty difficulty={p.difficulty} />
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
                  {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, total)} trên {total} bài
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
            <span key={k} className="inline-flex items-center gap-1.5"><v.icon size={14} className={v.color} aria-hidden="true" />{v.label}</span>
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

          </div>

          <div className="flex flex-wrap gap-1 max-h-64 overflow-y-auto">
            <button
              onClick={() => setSelectedTag('')}
              className={`px-2 py-0.5 rounded-full text-xs font-medium font-mono transition-colors cursor-pointer border ${
                selectedTag === ''
                  ? 'border-[var(--accent)] bg-accent/10 text-[var(--accent-text)]'
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
                    ? 'border-[var(--accent)] bg-accent/10 text-[var(--accent-text)]'
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
            disabled={total === 0}
            className="w-full mt-2 py-1.5 rounded-md bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium text-xs flex items-center justify-center gap-1.5 transition-colors border border-[var(--border)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MorphIcon icon={ShuffleData} size={14} className="text-[var(--text-secondary)]" /> Chọn Ngẫu Nhiên
          </button>
        </div>
      </div>
    </div>
  </div>
  );
}
