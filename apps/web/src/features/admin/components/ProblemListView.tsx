import { useState } from 'react';
import { Link } from 'react-router-dom';
import MorphIcon from '../../../components/MorphIcon';
import { Edit as EditData, ExternalLink as ExternalLinkData, Plus as PlusData, Trash2 as Trash2Data, X as XData } from 'lucide';
import type { Problem } from '../../../lib/api';

export type ProblemNotice = { type: 'success' | 'error'; text: string } | null;

/** Problem bank list: search, difficulty filter and per-problem actions. */
export default function ProblemListView({ problems, loading, testcaseCounts, notice, onDismissNotice, onCreate, onEdit, onDelete }: {
  problems: Problem[];
  loading: boolean;
  testcaseCounts: Record<string, number>;
  notice: ProblemNotice;
  onDismissNotice: () => void;
  onCreate: () => void;
  onEdit: (problem: Problem, tab: 'statement' | 'testcases') => void;
  onDelete: (id: string, title: string) => void;
}) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [diffFilter, setDiffFilter] = useState<'ALL' | 'Easy' | 'Medium' | 'Hard'>('ALL');
  const keyword = searchKeyword.trim().toLowerCase();
  const filteredProblems = problems.filter((p) =>
    (!keyword || p.title.toLowerCase().includes(keyword) || p.slug.toLowerCase().includes(keyword)
      || (p.tags || []).some((t) => t.toLowerCase().includes(keyword)))
    && (diffFilter === 'ALL' || p.difficulty === diffFilter));

  return (
    <div className="space-y-4 font-sans">
      {/* GitHub Subhead */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Ngân hàng bài tập
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Quản lý danh sách đề bài, bộ testcase và cấu hình kiểm thử.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold transition-colors cursor-pointer w-fit shadow-xs border border-line/20"
        >
          <MorphIcon icon={PlusData} size={14} /> Soạn bài mới
        </button>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-md text-xs font-medium flex items-center justify-between border ${
            notice.type === 'success'
              ? 'bg-accent/10 text-[var(--accent-text)] border-accent/20'
              : 'bg-danger/10 text-[var(--danger)] border-danger/20'
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" aria-label="Đóng thông báo" onClick={onDismissNotice} className="cursor-pointer">
            <MorphIcon icon={XData} size={14} />
          </button>
        </div>
      )}

      {/* GitHub Issue Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">

          <input aria-label="Tìm bài tập"
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="Tìm theo tên bài, slug hoặc thẻ chủ đề..."
            className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md pl-9 pr-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>

        <div className="flex items-center gap-1 w-full sm:w-auto">
          {(['ALL', 'Easy', 'Medium', 'Hard'] as const).map((diff) => {
            const isSel = diffFilter === diff;
            const label = diff === 'ALL' ? 'Tất cả' : diff === 'Easy' ? 'Dễ' : diff === 'Medium' ? 'Trung bình' : 'Khó';
            return (
              <button
                key={diff}
                type="button"
                onClick={() => setDiffFilter(diff)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                  isSel
                    ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border)] font-semibold shadow-xs'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-line/60'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* GitHub Box Table */}
      <div className="border border-[var(--border)] rounded-md bg-[var(--bg-secondary)] overflow-hidden shadow-xs">
        <div className="bg-tertiary/75 px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between text-xs font-medium text-[var(--text-secondary)]">
          <span>{filteredProblems.length} bài tập</span>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 rounded-md bg-[var(--bg-primary)] animate-pulse" />
            ))}
          </div>
        ) : filteredProblems.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)] space-y-3">
            <p>Không tìm thấy bài tập nào phù hợp.</p>
            <button
              type="button"
              onClick={onCreate}
              className="px-3.5 py-1.5 rounded-md bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] cursor-pointer"
            >
              + Soạn bài tập đầu tiên
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filteredProblems.map((p) => {
              const count = testcaseCounts[p.id] ?? 0;
              return (
                <div
                  key={p.id}
                  className="px-4 py-3 hover:bg-tertiary/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onEdit(p, 'statement')}
                        className="font-semibold text-xs text-[var(--text-primary)] hover:text-[var(--accent-text)] transition-colors cursor-pointer text-left"
                      >
                        {p.title}
                      </button>

                      {/* Difficulty Label */}
                      <span className="text-[10px] px-2 py-0.2 rounded-full font-mono border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-secondary)]">
                        {p.difficulty === 'Easy' ? 'Dễ' : p.difficulty === 'Medium' ? 'Trung bình' : 'Khó'}
                      </span>

                      {/* Visibility Label */}
                      <span
                        className={`text-[10px] px-2 py-0.2 rounded-full font-mono ${
                          p.is_public
                            ? 'bg-accent/10 text-[var(--accent-text)] border border-accent/30'
                            : 'bg-tertiary text-[var(--text-muted)] border border-[var(--border)]'
                        }`}
                      >
                        {p.is_public ? 'public' : 'private'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--text-muted)]">
                      <span>/{p.slug}</span>
                      <span>·</span>
                      <span>{p.time_limit_ms}ms</span>
                      <span>·</span>
                      <span>{p.memory_limit_mb}MB</span>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => onEdit(p, 'testcases')}
                        className="text-[var(--text-secondary)] hover:text-[var(--accent-text)] hover:underline cursor-pointer"
                      >
                        {count > 0 ? `${count} tests` : 'chưa có test'}
                      </button>
                    </div>

                    {p.tags && p.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {p.tags.map((t, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.2 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] font-normal"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                    <Link
                      to={`/problems/${p.slug}`}
                      target="_blank"
                      className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border)] transition-colors"
                      title="Xem trang làm bài"
                    >
                      <MorphIcon icon={ExternalLinkData} size={14} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => onEdit(p, 'statement')}
                      className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border)] transition-colors cursor-pointer"
                      title="Chỉnh sửa bài tập"
                    >
                      <MorphIcon icon={EditData} size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(p.id, p.title)}
                      className="p-1.5 rounded-md text-[var(--danger)] hover:bg-danger/10 transition-colors cursor-pointer"
                      title="Xóa bài tập"
                    >
                      <MorphIcon icon={Trash2Data} size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
