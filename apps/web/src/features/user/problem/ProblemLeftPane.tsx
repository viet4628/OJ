import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Play } from 'lucide-react';
import MorphIcon from '../../../components/MorphIcon';
import VerdictBadge from '../../../components/VerdictBadge';
import { Copy as CopyData, Check as CheckData } from 'lucide';
import { type SidebarTab } from '../../../components/Sidebar';
import Markdown from '../../../components/Markdown';
import { type Problem } from '../../../lib/api';

interface ProblemLeftPaneProps {
  problem: Problem | null;
  contestId?: string;
  slug?: string;
  isProblemLoading: boolean;
  activeLeftTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  descFontSize: number;
  onDescFontSizeChange: React.Dispatch<React.SetStateAction<number>>;
  rankRows: any[];
  historySubs: any[];
  sampleTestcases: { id: number; name: string; input: string; expected: string }[];
  copiedId: number | null;
  onCopy: (text: string, id: number) => void;
  widthPercent?: number;
  onSelectSubmission?: (sub: any) => void;
  onRunSample?: (sampleId: number) => void;
}

export default function ProblemLeftPane({
  problem,
  contestId,
  slug,
  isProblemLoading,
  activeLeftTab,
  onTabChange,
  descFontSize,
  onDescFontSizeChange,
  rankRows,
  historySubs,
  sampleTestcases,
  copiedId,
  onCopy,
  widthPercent = 42,
  onSelectSubmission,
  onRunSample,
}: ProblemLeftPaneProps) {
  const formatWhen = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const descHasInput = problem?.description?.toLowerCase().includes('dữ liệu vào') || problem?.description?.toLowerCase().includes('input format');
  const descHasOutput = problem?.description?.toLowerCase().includes('dữ liệu ra') || problem?.description?.toLowerCase().includes('output format');
  const descHasConstraints = problem?.description?.toLowerCase().includes('giới hạn') || problem?.description?.toLowerCase().includes('ràng buộc') || problem?.description?.toLowerCase().includes('constraints');

  return (
    <div
      style={{ width: `${widthPercent}%` }}
      className="shrink-0 border-r border-[var(--border)] flex flex-col bg-[var(--bg-primary)] overflow-hidden"
    >
      {/* Top Tab Header (GitHub subnav / tabs style) */}
      <div className="h-10 px-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-secondary)] shrink-0 select-none">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTabChange('description')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeLeftTab === 'description'
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border)] font-semibold shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            <span>Đề bài</span>
          </button>
          {contestId ? (
            <Link to={`/contests/${contestId}?tab=rank`} className="px-2.5 py-1 rounded-md text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Xếp hạng</Link>
          ) : <button
            onClick={() => onTabChange('ranking')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeLeftTab === 'ranking'
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border)] font-semibold shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            <span>Xếp hạng</span>
          </button>}
          <button
            onClick={() => onTabChange('history')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeLeftTab === 'history'
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border)] font-semibold shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            <span>Lịch sử nộp</span>
            {historySubs.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                {historySubs.length}
              </span>
            )}
          </button>
        </div>

        {/* Font size control */}
        <div className="flex items-center gap-1 border border-[var(--border)] bg-[var(--bg-primary)] rounded-md px-2 py-0.5 text-[11px] font-mono text-[var(--text-secondary)]">
          <button
            onClick={() => onDescFontSizeChange((f) => Math.max(10, f - 1))}
            className="hover:text-[var(--text-primary)] px-1 transition-colors cursor-pointer"
            title="Thu nhỏ cỡ chữ"
            aria-label="Thu nhỏ cỡ chữ"
          >
            A-
          </button>
          <span className="text-[var(--text-muted)]">|</span>
          <span className="text-[10px] text-[var(--text-muted)]">{descFontSize}px</span>
          <span className="text-[var(--text-muted)]">|</span>
          <button
            onClick={() => onDescFontSizeChange((f) => Math.min(24, f + 1))}
            className="hover:text-[var(--text-primary)] px-1 transition-colors cursor-pointer"
            title="Phóng to cỡ chữ"
            aria-label="Phóng to cỡ chữ"
          >
            A+
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-6 text-sm text-[var(--text-primary)] leading-relaxed" style={{ fontSize: `${descFontSize}px` }}>
        {isProblemLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[var(--text-secondary)] font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" /> Đang tải đề bài...
          </div>
        ) : !problem ? (
          <div className="py-16 text-center text-[var(--text-secondary)]">
            Không tìm thấy bài tập "{slug}".
            <Link to="/problems" className="text-[var(--accent-text)] hover:underline font-semibold block mt-2">
              ← Về danh sách bài tập
            </Link>
          </div>
        ) : (
          <>
            {/* TAB 1: PROBLEM DESCRIPTION */}
            {activeLeftTab === 'description' && (
              <div className="space-y-5">
                {/* Clean Problem Statement */}
                <Markdown content={problem.description} className="text-[var(--text-primary)] leading-relaxed space-y-3 break-words" />

                {/* Input Format (only if not already written in description) */}
                {problem.input_format && !descHasInput && (
                  <section className="space-y-1.5 pt-4 border-t border-[var(--border)]">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                      Dữ liệu vào (Input Format)
                    </h3>
                    <Markdown content={problem.input_format} className="text-[var(--text-primary)] leading-relaxed space-y-3 break-words" />
                  </section>
                )}

                {/* Output Format (only if not already written in description) */}
                {problem.output_format && !descHasOutput && (
                  <section className="space-y-1.5 pt-4 border-t border-[var(--border)]">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                      Dữ liệu ra (Output Format)
                    </h3>
                    <Markdown content={problem.output_format} className="text-[var(--text-primary)] leading-relaxed space-y-3 break-words" />
                  </section>
                )}

                {/* Sample Cases */}
                {sampleTestcases.length > 0 && (
                  <section className="space-y-3 pt-4 border-t border-[var(--border)]">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                      Ví dụ mẫu (Sample Testcases)
                    </h3>
                    <div className="space-y-3">
                      {sampleTestcases.map((tc, idx) => (
                        <div key={tc.id} className="rounded-md border border-[var(--border)] overflow-hidden bg-[var(--bg-secondary)]">
                          <div className="px-3 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center justify-between">
                            <span className="font-mono font-semibold text-[11px] text-[var(--text-secondary)]">
                              Ví dụ {idx + 1}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {onRunSample && (
                                <button
                                  onClick={() => onRunSample(tc.id)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--accent-text)] font-semibold transition-colors cursor-pointer shadow-xs"
                                  title="Nạp vào tab kiểm thử và chạy thử ngay"
                                >
                                  <Play className="w-2.5 h-2.5 fill-current" />
                                  <span>Chạy test này</span>
                                </button>
                              )}
                              <button
                                onClick={() => onCopy(tc.input, tc.id)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors cursor-pointer shadow-xs"
                                title="Sao chép dữ liệu đầu vào"
                              >
                                <MorphIcon
                                  icon={copiedId === tc.id ? CheckData : CopyData}
                                  size={11}
                                  className={copiedId === tc.id ? 'text-[var(--accent-text)]' : ''}
                                />
                                <span>{copiedId === tc.id ? 'Đã sao chép' : 'Sao chép Input'}</span>
                              </button>
                            </div>
                          </div>
                          <div className="p-3 bg-[var(--bg-primary)] space-y-2.5 font-mono text-xs">
                            <div>
                              <span className="text-[10px] font-semibold text-[var(--text-muted)] block mb-1">Đầu vào (Input):</span>
                              <pre className="p-2.5 rounded border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] whitespace-pre-wrap break-all">
                                {tc.input || '(luồng rỗng)'}
                              </pre>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">Đầu ra (Expected):</span>
                                <button
                                  onClick={() => onCopy(tc.expected, tc.id + 1000)}
                                  className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                                  title="Sao chép kết quả kỳ vọng"
                                >
                                  <MorphIcon
                                    icon={copiedId === tc.id + 1000 ? CheckData : CopyData}
                                    size={10}
                                    className={copiedId === tc.id + 1000 ? 'text-[var(--accent-text)]' : ''}
                                  />
                                  <span>{copiedId === tc.id + 1000 ? 'Đã chép' : 'Chép'}</span>
                                </button>
                              </div>
                              <pre className="p-2.5 rounded border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--accent-text)] font-semibold whitespace-pre-wrap break-all">
                                {tc.expected || '(luồng rỗng)'}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Constraints */}
                {!descHasConstraints && (
                  <section className="space-y-1.5 pt-4 border-t border-[var(--border)]">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                      Ràng buộc (Constraints)
                    </h3>
                    <div className="bg-[var(--bg-secondary)] p-3 rounded-md border border-[var(--border)] font-mono text-xs text-[var(--text-secondary)] space-y-1">
                      <div>• Thời gian giới hạn: <strong className="text-[var(--text-primary)]">{(problem.time_limit_ms / 1000).toFixed(1)}s ({problem.time_limit_ms} ms)</strong></div>
                      <div>• Bộ nhớ giới hạn: <strong className="text-[var(--text-primary)]">{problem.memory_limit_mb} MB</strong></div>
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* TAB 2: RANKING */}
            {activeLeftTab === 'ranking' && (
              <div className="space-y-3">
                <div className="p-3 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-xs text-[var(--text-primary)]">Bảng Xếp Hạng</h3>
                    <p className="text-[11px] text-[var(--text-secondary)]">Thí sinh giải đúng bài này sớm nhất</p>
                  </div>

                </div>

                <div className="border border-[var(--border)] rounded-md overflow-hidden bg-[var(--bg-secondary)]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-b border-[var(--border)] font-semibold text-[11px]">
                      <tr>
                        <th className="p-2.5">Hạng</th>
                        <th className="p-2.5">Thí Sinh</th>
                        <th className="p-2.5">Thời Gian</th>
                        <th className="p-2.5 text-right">Ngôn Ngữ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] bg-[var(--bg-primary)]">
                      {rankRows.length === 0 && (
                        <tr>
                          <td className="p-4 text-center text-[var(--text-secondary)]" colSpan={4}>
                            Chưa có ai AC bài này
                          </td>
                        </tr>
                      )}
                      {rankRows.map((r, idx) => (
                        <tr key={r.user_id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                          <td className="p-2.5 font-semibold text-[var(--text-primary)]">
                            #{idx + 1}
                          </td>
                          <td className="p-2.5 font-medium text-[var(--text-primary)]">{r.username || 'Ẩn danh'}</td>
                          <td className="p-2.5 text-[var(--accent-text)] font-semibold">{r.time_ms}ms</td>
                          <td className="p-2.5 text-right text-[var(--text-secondary)] uppercase">{r.language}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: HISTORY SUBMISSIONS */}
            {activeLeftTab === 'history' && (
              <div className="space-y-3">
                <div className="p-3 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-xs text-[var(--text-primary)]">Lịch Sử Nộp Bài</h3>
                    <p className="text-[11px] text-[var(--text-secondary)]">{contestId ? 'Bài nộp của bạn cho bài này trong kỳ thi' : 'Các lần chấm bài gần nhất trên hệ thống'}</p>
                  </div>

                </div>

                <div className="border border-[var(--border)] rounded-md overflow-hidden bg-[var(--bg-secondary)]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-b border-[var(--border)] font-semibold text-[11px]">
                      <tr>
                        <th className="p-2.5">Thời Gian</th>
                        <th className="p-2.5">Thí Sinh</th>
                        <th className="p-2.5">Kết Quả</th>
                        <th className="p-2.5">Chạy</th>
                        <th className="p-2.5 text-right">Mã Nguồn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] bg-[var(--bg-primary)]">
                      {historySubs.length === 0 && (
                        <tr>
                          <td className="p-4 text-center text-[var(--text-secondary)]" colSpan={5}>
                            Chưa có bài nộp nào
                          </td>
                        </tr>
                      )}
                      {historySubs.map((sub) => (
                        <tr key={sub.id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                          <td className="p-2.5 text-[var(--text-secondary)]">{formatWhen(sub.created_at)}</td>
                          <td className="p-2.5 font-medium text-[var(--text-primary)] truncate max-w-[90px]">
                            {sub.profiles?.full_name || sub.profiles?.email?.split('@')[0] || 'user'}
                          </td>
                          <td className="p-2.5"><VerdictBadge status={sub.status} /></td>
                          <td className="p-2.5 text-[var(--text-secondary)]">{sub.time_used_ms}ms</td>
                          <td className="p-2.5 text-right">
                            {sub.code && onSelectSubmission ? (
                              <button
                                onClick={() => onSelectSubmission(sub)}
                                className="px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[10px] font-semibold text-[var(--accent-text)] transition-colors cursor-pointer"
                                title="Nạp mã nguồn bài nộp này vào Editor"
                              >
                                Nạp Code
                              </button>
                            ) : (
                              <span className="text-[var(--text-muted)]">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
