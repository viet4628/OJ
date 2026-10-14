import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  RefreshCw,
  TerminalSquare,
  CheckCircle2,
  XCircle,
  Check,
} from 'lucide-react';
import MorphIcon from '../../../components/MorphIcon';
import { ChevronDown as ChevronDownData, ChevronUp as ChevronUpData } from 'lucide';
import { normOutput } from '../../../constants/languages';

export interface TestcaseItem {
  id: number;
  name: string;
  isSample: boolean;
  status: string;
  timeMs: number;
  memoryMb: number;
}

interface ProblemTestPanelProps {
  testPanelOpen: boolean;
  testPanelHeight: number;
  isResizing: boolean;
  onToggleOpen: () => void;
  sampleTestcases: { id: number; name: string; input: string; expected: string }[];
  activeTestTab: number;
  setActiveTestTab: (id: number) => void;
  customInput: string;
  setCustomInput: (v: string) => void;
  handleTabKey: (setter: (v: string) => void) => (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  submissionError: string | null;
  user: { username: string; rating: number } | null;
  onOpenAuth: () => void;
  isRunning: boolean;
  runOutput: string | null;
  activeSample?: { id: number; name: string; input: string; expected: string };
  submissionResult: any;
  resultRef: React.RefObject<HTMLDivElement>;
  systemStatus: 'ready' | 'judging' | 'done';
}

export default function ProblemTestPanel({
  testPanelOpen,
  testPanelHeight,
  isResizing,
  onToggleOpen,
  sampleTestcases,
  activeTestTab,
  setActiveTestTab,
  customInput,
  setCustomInput,
  handleTabKey,
  submissionError,
  user,
  onOpenAuth,
  isRunning,
  runOutput,
  activeSample,
  submissionResult,
  resultRef,
  systemStatus,
}: ProblemTestPanelProps) {
  return (
    <div
      className={`shrink-0 border-t border-[var(--border)] bg-[var(--bg-primary)] flex flex-col ${
        isResizing ? '' : 'transition-[height] duration-150 ease-out'
      }`}
      style={{ height: testPanelOpen ? testPanelHeight : 36 }}
    >
      {/* Header Tabs */}
      <div className="px-4 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center justify-between shrink-0 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleOpen}
            className="flex items-center gap-1.5 font-black tracking-wider uppercase text-[11px] text-[var(--text-primary)] hover:text-[var(--accent-text)] transition-colors cursor-pointer"
            title={testPanelOpen ? 'Thu gọn panel' : 'Mở rộng panel'}
          >
            <MorphIcon
              icon={testPanelOpen ? ChevronDownData : ChevronUpData}
              size={14}
              spring="snappy"
            />
            KIỂM THỬ
          </button>
          {testPanelOpen && (
            <div className="flex items-center gap-1 pl-2 border-l border-[var(--border)]">
              {sampleTestcases.map((tc) => (
                <button
                  key={tc.id}
                  onClick={() => setActiveTestTab(tc.id)}
                  className={`px-3 py-0.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeTestTab === tc.id && !customInput
                      ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border)] shadow-sm font-bold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  {tc.name}
                </button>
              ))}
              <button
                onClick={() => setActiveTestTab(-1)}
                className={`flex items-center gap-1 font-bold text-xs px-2.5 py-0.5 rounded-md transition-colors cursor-pointer ${
                  activeTestTab === -1
                    ? 'bg-[var(--accent)] text-[var(--text-primary)]'
                    : 'text-[var(--accent-text)] hover:bg-[var(--accent)]/10'
                }`}
              >
                <Plus className="w-3.5 h-3.5" /> Tự tạo
              </button>
              {activeTestTab === -1 && customInput.trim() !== '' && (
                <button
                  onClick={() => setCustomInput('')}
                  className="flex items-center gap-1 font-bold text-xs px-2 py-0.5 rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Xóa dữ liệu test tự tạo"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleOpen}
            className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
            title={testPanelOpen ? 'Thu gọn (Ctrl+`)' : 'Mở rộng'}
          >
            {testPanelOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {testPanelOpen && (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border)]">
          {/* CỘT TRÁI — INPUT của tab đang chọn */}
          <section className="min-h-0 overflow-auto p-3 bg-[var(--bg-primary)] text-xs space-y-2">
            {activeTestTab === -1 ? (
              <>
                <label className="font-bold text-[var(--text-secondary)] block text-[11px]">Đầu vào (tự tạo):</label>
                <textarea
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={handleTabKey(setCustomInput)}
                  placeholder="Gõ input test tại đây..."
                  className="w-full min-h-[64px] h-full max-h-40 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-2.5 font-code text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                />
              </>
            ) : activeSample ? (
              <>
                <label className="font-bold text-[var(--text-secondary)] block text-[11px]">Đầu vào (Input):</label>
                <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)] font-code font-bold whitespace-pre-wrap break-all">
                  {activeSample.input || '(rỗng)'}
                </div>
                <label className="font-bold text-[var(--text-secondary)] block text-[11px] pt-1">
                  Đầu ra mong đợi (Expected):
                </label>
                <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--accent-text)] font-code font-bold whitespace-pre-wrap break-all">
                  {activeSample.expected || '(rỗng)'}
                </div>
              </>
            ) : null}

            {submissionError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 font-bold text-[11px] animate-fade-in">
                ⚠️ {submissionError}
                {!user && (
                  <>
                    {' '}
                    —{' '}
                    <button onClick={onOpenAuth} className="underline cursor-pointer">
                      Đăng nhập
                    </button>{' '}
                    để chạy thử / nộp bài
                  </>
                )}
              </div>
            )}
          </section>

          {/* CỘT PHẢI — OUTPUT / KẾT QUẢ */}
          <section className="min-h-0 overflow-auto p-3 bg-[var(--bg-primary)] text-xs space-y-2">
            {isRunning && runOutput === null && !submissionError && (
              <div className="font-code flex items-center gap-2 text-[11px] font-bold text-blue-500">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang chạy qua rsjudge engine…
              </div>
            )}

            {!isRunning && runOutput === null && !submissionError && !submissionResult && (
              <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] gap-1.5 select-none">
                <TerminalSquare className="w-6 h-6 opacity-40" />
                <span className="font-semibold text-[11px]">Nhấn “Chạy thử” để xem đầu ra tại đây</span>
              </div>
            )}

            {runOutput !== null && (
              <div className="font-code">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-[var(--text-secondary)] text-[11px]">Đầu ra thực tế:</label>
                  {(() => {
                    if (activeTestTab === -1) return null;
                    const expected = activeSample?.expected ?? '';
                    if (expected.trim() === '') return null;
                    return normOutput(runOutput) === normOutput(expected) ? (
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 rounded text-emerald-600 dark:text-emerald-400 uppercase font-black">
                        KHỚP ĐÁP ÁN
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 bg-red-500/15 border border-red-500/30 rounded text-red-600 dark:text-red-400 uppercase font-black">
                        SAI ĐÁP ÁN
                      </span>
                    );
                  })()}
                </div>
                <pre
                  className={`min-h-[48px] p-2.5 rounded-lg border font-bold whitespace-pre-wrap break-all ${
                    runOutput === ''
                      ? 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-muted)]'
                      : 'bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-primary)]'
                  }`}
                >
                  {runOutput === '' ? '(không có output)' : runOutput}
                </pre>
              </div>
            )}

            {submissionResult && (
              <div ref={resultRef} className="pt-2 border-t border-[var(--border)] space-y-2 animate-fade-in">
                <div
                  className={`flex items-center justify-between p-2.5 rounded-xl border font-bold ${
                    submissionResult.status === 'ACCEPTED'
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : [
                          'ERROR',
                          'WRONG_ANSWER',
                          'COMPILE_ERROR',
                          'RUNTIME_ERROR',
                          'TIME_LIMIT_EXCEEDED',
                          'MEMORY_LIMIT_EXCEEDED',
                        ].includes(submissionResult.status)
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-blue-500/10 border-blue-500/30'
                  }`}
                >
                  <div
                    className={`flex items-center gap-2 ${
                      submissionResult.status === 'ACCEPTED'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : submissionResult.status === 'ERROR'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {submissionResult.status === 'ACCEPTED' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : submissionResult.status === 'PENDING' || submissionResult.status === 'JUDGING' ? (
                      <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span>Kết Quả: {submissionResult.status}</span>
                  </div>
                  <span className="px-3 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] font-code text-xs font-black shadow-sm border border-[var(--border)]">
                    {submissionResult.totalCount > 0
                      ? `${submissionResult.passedCount}/${submissionResult.totalCount} Tests`
                      : ''}{' '}
                    ({submissionResult.timeMs}ms)
                  </span>
                </div>

                {submissionResult.note && (
                  <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] font-bold text-[11px]">
                    {submissionResult.note}
                  </div>
                )}

                {submissionResult.errorLog && (
                  <pre className="p-2.5 rounded-lg bg-[#1e1e1e] text-red-300 font-code text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {submissionResult.errorLog}
                  </pre>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-code text-[11px]">
                  {(submissionResult.testcases || []).map((t: TestcaseItem) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]"
                    >
                      <span className="font-bold text-[var(--text-primary)]">{t.name}</span>
                      <span
                        className={`font-bold flex items-center gap-1 ${
                          t.status === 'ACCEPTED'
                            ? 'text-[var(--accent-text)]'
                            : t.status === 'PENDING'
                            ? 'text-blue-600'
                            : 'text-red-600'
                        }`}
                      >
                        {t.status === 'ACCEPTED' ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> AC ({t.timeMs}ms)
                          </>
                        ) : t.status === 'PENDING' || t.status === 'JUDGING' ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {t.status}
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" /> {t.status}
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Bottom Status Bar */}
      <div className="h-7 shrink-0 px-4 bg-[var(--bg-secondary)] border-t border-[var(--border)] flex items-center justify-between text-[11px] select-none">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              systemStatus === 'ready'
                ? 'bg-[var(--accent)] animate-pulse-glow'
                : systemStatus === 'judging'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-[var(--accent)]'
            }`}
          />
          <span className="font-extrabold text-[var(--text-primary)] uppercase tracking-wider text-[10px]">
            {systemStatus === 'ready' && 'HỆ THỐNG SẴN SÀNG CHẤM BÀI'}
            {systemStatus === 'judging' && 'ĐANG GỬI RSJUDGE SANDBOX CHẤM BÀI...'}
            {systemStatus === 'done' && submissionResult
              ? `CHẤM BÀI HOÀN TẤT - ${submissionResult.status}`
              : 'CHẤM BÀI HOÀN TẤT'}
          </span>
        </div>
        <span className="font-code font-semibold text-[var(--text-muted)] text-[10px] hidden sm:inline">
          ⚡ rsjudge Sandbox v1.2 • Supabase PostgreSQL Realtime
        </span>
      </div>
    </div>
  );
}
