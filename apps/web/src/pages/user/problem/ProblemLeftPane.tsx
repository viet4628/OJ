import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  FileText,
  Lightbulb,
  Trophy,
  History,
  MessageCircle,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import MorphIcon from '../../../components/MorphIcon';
import { Copy as CopyData, Check as CheckData } from 'lucide';
import Sidebar, { type SidebarTab } from '../../../components/Sidebar';
import AlgorithmVisualizer from '../../../components/AlgorithmVisualizer';
import Markdown from '../../../components/Markdown';
import { type Problem } from '../../../lib/api';

interface ProblemLeftPaneProps {
  problem: Problem | null;
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
}

export default function ProblemLeftPane({
  problem,
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
}: ProblemLeftPaneProps) {
  const formatWhen = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const statusBadge = (status: string) => {
    if (status === 'ACCEPTED') return <span className="font-bold text-[var(--accent-text)]">ACCEPTED</span>;
    if (status === 'WRONG_ANSWER') return <span className="font-bold text-red-600">WRONG_ANSWER</span>;
    if (status === 'COMPILE_ERROR') return <span className="font-bold text-red-600">COMPILE_ERROR</span>;
    if (status === 'RUNTIME_ERROR') return <span className="font-bold text-orange-600">RUNTIME_ERROR</span>;
    if (status === 'TIME_LIMIT_EXCEEDED') return <span className="font-bold text-amber-600">TLE</span>;
    if (status === 'MEMORY_LIMIT_EXCEEDED') return <span className="font-bold text-purple-600">MLE</span>;
    return <span className="font-bold text-blue-600">{status}</span>;
  };

  return (
    <>
      <Sidebar activeTab={activeLeftTab} onTabChange={onTabChange} />

      <div
        style={{ width: `${widthPercent}%` }}
        className="shrink-0 border-r border-[var(--border)] flex flex-col bg-[var(--bg-primary)] overflow-hidden"
      >
        {/* Section Header */}
        <div className="px-5 py-2.5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-secondary)] shrink-0">
          <h2 className="text-xs font-black text-[var(--text-primary)] flex items-center gap-2 tracking-wider uppercase">
            {activeLeftTab === 'description' && (
              <>
                <FileText className="w-4 h-4 text-[var(--accent-text)]" /> MÔ TẢ BÀI TOÁN
              </>
            )}
            {activeLeftTab === 'visualize' && (
              <>
                <Lightbulb className="w-4 h-4 text-amber-600" /> TRỰC QUAN HOÁ THUẬT TOÁN
              </>
            )}
            {activeLeftTab === 'ranking' && (
              <>
                <Trophy className="w-4 h-4 text-amber-600" /> BẢNG XẾP HẠNG
              </>
            )}
            {activeLeftTab === 'history' && (
              <>
                <History className="w-4 h-4 text-sky-700" /> LỊCH SỬ NỘP BÀI
              </>
            )}
            {activeLeftTab === 'discussion' && (
              <>
                <MessageCircle className="w-4 h-4 text-blue-500" /> THẢO LUẬN & GỢI Ý
              </>
            )}
          </h2>

          <div className="flex items-center gap-1 border border-[var(--border)] bg-[var(--bg-primary)] rounded px-2 py-0.5 text-[11px] font-bold text-[var(--text-secondary)] select-none">
            <button
              onClick={() => onDescFontSizeChange((f) => Math.max(10, f - 1))}
              className="hover:text-[var(--text-primary)] px-1 transition-colors"
              title="Thu nhỏ chữ"
            >
              A-
            </button>
            <span className="text-[var(--text-muted)] font-normal">|</span>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">{descFontSize}px</span>
            <span className="text-[var(--text-muted)] font-normal">|</span>
            <button
              onClick={() => onDescFontSizeChange((f) => Math.min(24, f + 1))}
              className="hover:text-[var(--text-primary)] px-1 transition-colors"
              title="Phóng to chữ"
            >
              A+
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-[var(--text-primary)]" style={{ fontSize: `${descFontSize}px` }}>
          {isProblemLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[var(--text-secondary)] font-bold">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" /> Đang tải đề bài...
            </div>
          ) : !problem ? (
            <div className="py-16 text-center text-[var(--text-secondary)]">
              Không tìm thấy bài tập "{slug}".
              <Link to="/problems" className="text-[var(--accent-text)] font-bold block mt-2">
                ← Về danh sách bài tập
              </Link>
            </div>
          ) : (
            <>
              {/* DEFAULT TAB: PROBLEM DESCRIPTION */}
              {activeLeftTab === 'description' && (
                <>
                  <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-2">
                    <div className="font-bold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[var(--accent-text)]" /> Đề bài:
                    </div>
                    <div className="leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
                      <Markdown content={problem.description} />
                    </div>
                  </div>

                  {/* Input Format */}
                  <section className="space-y-1.5">
                    <h3 className="font-bold text-[var(--text-primary)] text-xs flex items-center gap-1 uppercase tracking-wider">
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--info)]" /> Dữ liệu vào (Input Format)
                    </h3>
                    <div className="bg-[var(--bg-secondary)] p-3.5 rounded-xl border border-[var(--border)] font-code text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                      {problem.input_format || 'Không có mô tả định dạng đầu vào'}
                    </div>
                  </section>

                  {/* Output Format */}
                  <section className="space-y-1.5">
                    <h3 className="font-bold text-[var(--text-primary)] text-xs flex items-center gap-1 uppercase tracking-wider">
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--accent-text)]" /> Dữ liệu ra (Output Format)
                    </h3>
                    <div className="bg-[var(--bg-secondary)] p-3.5 rounded-xl border border-[var(--border)] font-code text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                      {problem.output_format || 'Không có mô tả định dạng đầu ra'}
                    </div>
                  </section>

                  {/* Sample Cases */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[var(--text-primary)] text-xs uppercase tracking-wider">
                        Ví dụ mẫu (Sample Testcases)
                      </h3>
                    </div>

                    {sampleTestcases.length === 0 ? (
                      <div className="text-[var(--text-secondary)] p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                        Bài tập chưa có testcase mẫu
                      </div>
                    ) : (
                      sampleTestcases.map((tc) => (
                        <div key={tc.id} className="bg-[var(--bg-secondary)] rounded-xl p-3.5 border border-[var(--border)] space-y-2 card-hover-effect">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold text-[var(--text-secondary)] uppercase">
                              {tc.name}
                            </span>
                            <button
                              onClick={() => onCopy(tc.input, tc.id)}
                              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] text-[10px] font-bold text-[var(--text-secondary)] transition-colors cursor-pointer"
                            >
                              <MorphIcon
                                icon={copiedId === tc.id ? CheckData : CopyData}
                                size={12}
                                spring="bouncy"
                                className={copiedId === tc.id ? 'text-[var(--accent-text)]' : ''}
                              />
                              {copiedId === tc.id ? 'Đã sao chép' : 'Sao chép Input'}
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-4 font-code">
                            <div>
                              <span className="text-[10px] text-[var(--text-muted)] font-bold block mb-1">Đầu vào (Input):</span>
                              <div className="bg-[var(--bg-primary)] p-2.5 rounded-lg border border-[var(--border)] text-[var(--text-primary)] font-bold shadow-sm whitespace-pre-wrap">
                                {tc.input}
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] text-[var(--text-muted)] font-bold block mb-1">Đầu ra (Expected):</span>
                              <div className="bg-[var(--bg-primary)] p-2.5 rounded-lg border border-[var(--border)] text-[var(--accent-text)] font-bold shadow-sm whitespace-pre-wrap">
                                {tc.expected}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </section>

                  {/* Constraints */}
                  <section className="space-y-1.5">
                    <h3 className="font-bold text-[var(--text-primary)] text-xs flex items-center gap-1 uppercase tracking-wider">
                      ⚠️ Ràng buộc (Constraints)
                    </h3>
                    <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/70 font-code text-[var(--text-secondary)] space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>
                          Thời gian giới hạn: <strong className="text-[var(--text-primary)]">{(problem.time_limit_ms / 1000).toFixed(1)}s ({problem.time_limit_ms} ms)</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>
                          Bộ nhớ giới hạn: <strong className="text-[var(--text-primary)]">{problem.memory_limit_mb} MB</strong>
                        </span>
                      </div>
                    </div>
                  </section>
                </>
              )}

              {/* VISUALIZE INTERACTIVE ALGORITHM */}
              {activeLeftTab === 'visualize' && <AlgorithmVisualizer />}

              {/* LEADERBOARD TAB */}
              {activeLeftTab === 'ranking' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-[var(--text-primary)]">Bảng Xếp Hạng {problem.title}</h3>
                      <p className="text-xs text-[var(--text-secondary)]">Top thí sinh AC, sắp theo thời gian AC đầu tiên</p>
                    </div>
                    <Trophy className="w-6 h-6 text-amber-500" />
                  </div>

                  <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs font-code">
                      <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-b border-[var(--border)] font-bold">
                        <tr>
                          <th className="p-3">Hạng</th>
                          <th className="p-3">Thí Sinh</th>
                          <th className="p-3">Thời Gian</th>
                          <th className="p-3">Ngôn Ngữ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {rankRows.length === 0 && (
                          <tr>
                            <td className="p-4 text-center text-[var(--text-secondary)]" colSpan={4}>
                              Chưa có ai AC bài này
                            </td>
                          </tr>
                        )}
                        {rankRows.map((r, idx) => (
                          <tr key={r.user_id} className="hover:bg-[var(--bg-secondary)]">
                            <td className="p-3 font-bold text-amber-500">
                              {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                            </td>
                            <td className="p-3 font-bold">{r.username || 'Ẩn danh'}</td>
                            <td className="p-3 text-[var(--accent-text)] font-bold">{r.time_ms}ms</td>
                            <td className="p-3 text-[var(--text-secondary)]">{r.language.toUpperCase()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* HISTORY SUBMISSIONS TAB */}
              {activeLeftTab === 'history' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-[var(--text-primary)]">Lịch Sử Nộp Bài {problem.title}</h3>
                      <p className="text-xs text-[var(--text-secondary)]">Các lần chấm bài gần nhất trên hệ thống</p>
                    </div>
                    <History className="w-6 h-6 text-[var(--info)]" />
                  </div>

                  <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs font-code">
                      <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-b border-[var(--border)] font-bold">
                        <tr>
                          <th className="p-3">Thời Gian</th>
                          <th className="p-3">Thí Sinh</th>
                          <th className="p-3">Kết Quả</th>
                          <th className="p-3">Chạy</th>
                          <th className="p-3">RAM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {historySubs.length === 0 && (
                          <tr>
                            <td className="p-4 text-center text-[var(--text-secondary)]" colSpan={5}>
                              Chưa có bài nộp nào
                            </td>
                          </tr>
                        )}
                        {historySubs.map((sub) => (
                          <tr key={sub.id} className="hover:bg-[var(--bg-secondary)]">
                            <td className="p-3 text-[var(--text-secondary)]">{formatWhen(sub.created_at)}</td>
                            <td className="p-3 font-bold text-[var(--text-primary)]">
                              {sub.profiles?.full_name || sub.profiles?.email?.split('@')[0] || 'user'}
                            </td>
                            <td className="p-3">{statusBadge(sub.status)}</td>
                            <td className="p-3">{sub.time_used_ms}ms</td>
                            <td className="p-3">{sub.memory_used_mb}MB</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* DISCUSSION TAB */}
              {activeLeftTab === 'discussion' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-2">
                    <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-blue-500" /> Cộng Đồng Thảo Luận
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Chia sẻ ý tưởng, gợi ý thuật toán hoặc đặt câu hỏi văn minh. Không đăng trực tiếp lời giải chi tiết.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-[var(--text-primary)]">Gợi ý cách tiếp cận</span>
                      <span className="text-[var(--text-muted)] font-normal">Hệ thống</span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Đọc kỹ định dạng dữ liệu vào/ra trong đề bài. Kiểm tra chương trình với các testcase mẫu trước khi nộp.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

