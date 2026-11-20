import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, X, RefreshCw, Copy, Check } from 'lucide-react';
import MorphIcon from '../../../components/MorphIcon';
import { ChevronDown as ChevronDownData, ChevronUp as ChevronUpData } from 'lucide';
import { normOutput } from '../../../constants/languages';

export interface TestcaseItem {
  id: number;
  name: string;
  isSample: boolean;
  status: string;
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
  isSubmitting?: boolean;
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
  isSubmitting = false,
}: ProblemTestPanelProps) {
  const [copiedOutput, setCopiedOutput] = useState(false);

  const handleCopyOutput = () => {
    if (runOutput === null) return;
    navigator.clipboard.writeText(runOutput);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 2000);
  };
  return (
    <div
      className={`shrink-0 border-t border-[var(--border)] bg-[var(--bg-primary)] flex flex-col ${
        isResizing ? '' : 'transition-[height] duration-150 ease-out'
      }`}
      style={{ height: testPanelOpen ? testPanelHeight : 32 }}
    >
      {/* Header Tabs */}
      <div className="h-8 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center justify-between shrink-0 text-xs select-none">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleOpen}
            className="flex items-center gap-1 font-semibold uppercase text-[11px] text-[var(--text-primary)] hover:text-[var(--accent-text)] transition-colors cursor-pointer"
            title={testPanelOpen ? 'Thu gọn console' : 'Mở rộng console'}
          >
            <MorphIcon
              icon={testPanelOpen ? ChevronDownData : ChevronUpData}
              size={13}
              spring="snappy"
            />
            <span>Kiểm thử</span>
          </button>

          {testPanelOpen && (
            <div className="flex items-center gap-1 pl-2 border-l border-[var(--border)]">
              {sampleTestcases.map((tc, idx) => (
                <button
                  key={tc.id}
                  onClick={() => setActiveTestTab(tc.id)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    activeTestTab === tc.id && !customInput
                      ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border)] font-semibold shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  Test {idx + 1}
                </button>
              ))}
              <button
                onClick={() => setActiveTestTab(-1)}
                className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-colors cursor-pointer font-medium ${
                  activeTestTab === -1
                    ? 'bg-[var(--bg-primary)] text-[var(--accent-text)] border border-accent/30 font-semibold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <Plus className="w-3 h-3" /> Tự tạo
              </button>
              {activeTestTab === -1 && customInput.trim() !== '' && (
                <button
                  onClick={() => setCustomInput('')}
                  className="flex items-center p-0.5 rounded text-[var(--text-muted)] hover:text-danger transition-colors cursor-pointer"
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
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title={testPanelOpen ? 'Thu gọn panel' : 'Mở rộng panel'}
          >
            {testPanelOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Panel Body */}
      {testPanelOpen && (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border)] font-mono text-xs">
          {/* CỘT TRÁI — INPUT / EXPECTED */}
          <section className="min-h-0 overflow-auto p-3 bg-[var(--bg-primary)] space-y-2">
            {activeTestTab === -1 ? (
              <div className="space-y-1">
                <label className="font-semibold text-[var(--text-muted)] block text-[10px] uppercase">
                  Đầu vào tự tạo:
                </label>
                <textarea aria-label="Đầu vào tự tạo"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={handleTabKey(setCustomInput)}
                  placeholder="Nhập input kiểm thử..."
                  className="w-full h-24 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-2 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                />
              </div>
            ) : activeSample ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-muted)] block mb-1 uppercase">
                    Đầu vào (Input):
                  </span>
                  <pre className="p-2 rounded border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] whitespace-pre-wrap break-all min-h-[48px] max-h-28 overflow-auto">
                    {activeSample.input || '(luồng rỗng)'}
                  </pre>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-muted)] block mb-1 uppercase">
                    Kỳ vọng (Expected):
                  </span>
                  <pre className="p-2 rounded border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--accent-text)] font-semibold whitespace-pre-wrap break-all min-h-[48px] max-h-28 overflow-auto">
                    {activeSample.expected || '(luồng rỗng)'}
                  </pre>
                </div>
              </div>
            ) : null}

            {submissionError && (
              <div className="p-2 rounded border border-danger/20 bg-danger/10 text-danger font-semibold text-[11px]">
                {submissionError}
                {!user && (
                  <>
                    {' '}—{' '}
                    <button onClick={onOpenAuth} className="underline cursor-pointer">
                      Đăng nhập
                    </button>{' '}để chạy thử / nộp bài
                  </>
                )}
              </div>
            )}
          </section>

          {/* CỘT PHẢI — OUTPUT / KẾT QUẢ CHẤM */}
          <section className="min-h-0 overflow-auto p-3 bg-[var(--bg-primary)] space-y-2">
            {isRunning && runOutput === null && !submissionError && (
              <div className="flex items-center gap-2 text-[11px] font-medium text-[var(--text-secondary)]">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
                <span>Đang chạy thử chương trình...</span>
              </div>
            )}

            {!isRunning && runOutput === null && !submissionError && !submissionResult && (
              <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] gap-1 select-none py-4">

                <span className="text-[11px]">Bấm “Chạy thử” để kiểm tra kết quả tại đây</span>
              </div>
            )}

            {runOutput !== null && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">
                      Đầu ra thực tế (Output):
                    </span>
                    <button
                      onClick={handleCopyOutput}
                      className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                      title={copiedOutput ? 'Đã sao chép' : 'Sao chép kết quả'}
                    >
                      {copiedOutput ? <Check className="w-3 h-3 text-[var(--accent-text)]" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedOutput ? 'Đã chép' : 'Chép'}</span>
                    </button>
                  </div>
                  {activeTestTab !== -1 && activeSample?.expected && (
                    normOutput(runOutput) === normOutput(activeSample.expected) ? (
                      <span className="text-[10px] px-1.5 py-0.2 rounded border font-semibold text-[var(--accent-text)] bg-accent/10 border-accent/30">
                        KHỚP ĐÁP ÁN
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 rounded border font-semibold text-danger bg-danger/10 border-danger/20">
                        SAI ĐÁP ÁN
                      </span>
                    )
                  )}
                </div>
                <pre className="p-2 rounded border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] whitespace-pre-wrap break-all min-h-[48px] max-h-28 overflow-auto">
                  {runOutput === '' ? '(luồng rỗng)' : runOutput}
                </pre>
              </div>
            )}

            {submissionResult && (
              <div ref={resultRef} className="space-y-3">
                {/* Result Status Banner */}
                <div className="flex items-center justify-between p-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] shadow-xs">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    {(submissionResult.status === 'PENDING' || submissionResult.status === 'JUDGING') ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-[var(--accent)]" />
                    ) : (
                      <span className={`w-2 h-2 rounded-full ${submissionResult.status === 'ACCEPTED' ? 'bg-[var(--accent)]' : 'bg-danger'}`} />
                    )}
                    <span className="text-[var(--text-primary)]">
                      {submissionResult.status === 'PENDING' && submissionResult.queuePosition
                        ? `Đang xếp hàng (vị trí #${submissionResult.queuePosition})`
                        : submissionResult.status === 'PENDING' || submissionResult.status === 'JUDGING'
                        ? 'Đang chấm bài...'
                        : `Kết quả: ${submissionResult.status}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--text-muted)]">
                    {submissionResult.totalCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-secondary)]">
                        {submissionResult.passedCount}/{submissionResult.totalCount} Đạt
                      </span>
                    )}
                    {typeof submissionResult.timeMs === 'number' && (
                      <span>{submissionResult.timeMs}ms</span>
                    )}
                    {typeof submissionResult.memoryMb === 'number' && (
                      <span>· {submissionResult.memoryMb}MB</span>
                    )}
                  </div>
                </div>

                {/* Progsity Style Test Matrix Bar */}
                {submissionResult.testcases && submissionResult.testcases.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between">
                      <span>Chi tiết các bộ test ({submissionResult.testcases.length})</span>
                      <span className="font-mono text-[10px] lowercase text-[var(--text-muted)]">
                        {submissionResult.passedCount === submissionResult.totalCount
                          ? 'toàn bộ test vượt qua'
                          : `${submissionResult.passedCount}/${submissionResult.testcases.length} test đạt`}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 font-mono">
                      {submissionResult.testcases.map((t: TestcaseItem, idx: number) => {
                        const isAC = t.status === 'ACCEPTED';
                        const isPending = t.status === 'PENDING' || t.status === 'JUDGING';
                        const isSample = t.isSample || t.name.toLowerCase().includes('sample') || t.name.toLowerCase().includes('mẫu') || idx < 2;
                        const label = isSample ? `S${idx + 1}` : `${idx + 1}`;

                        return (
                          <div
                            key={t.id}
                            title={`${t.name}: ${t.status}`}
                            className={`flex h-7 min-w-[32px] px-1.5 items-center justify-center rounded-md border text-[10px] font-semibold transition-all select-none ${
                              isAC
                                ? 'border-accent/40 bg-accent/15 text-[var(--accent-text)]'
                                : isPending
                                ? 'border-[var(--accent)] bg-accent/20 text-[var(--accent-text)] animate-pulse'
                                : 'border-danger/30 bg-danger/10 text-danger'
                            }`}
                          >
                            <span>{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Error Log Block */}
                {submissionResult.errorLog && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-danger uppercase tracking-wider block">
                      Nhật ký lỗi (Compiler / Runtime Log):
                    </span>
                    <pre className="p-2.5 rounded bg-[#1e1e1e] text-danger font-mono text-[11px] overflow-x-auto whitespace-pre-wrap max-h-32 border border-danger/25">
                      {submissionResult.errorLog}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Bottom Status Bar */}
      <div className="h-6 shrink-0 px-3 bg-[var(--bg-secondary)] border-t border-[var(--border)] flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] select-none">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              systemStatus === 'ready'
                ? 'bg-[var(--accent)]'
                : systemStatus === 'judging'
                ? 'bg-[var(--text-muted)] animate-pulse'
                : 'bg-[var(--accent)]'
            }`}
          />
          <span className="font-medium text-[var(--text-secondary)]">
            {systemStatus === 'ready' && 'Môi trường sẵn sàng'}
            {systemStatus === 'judging' && (isSubmitting ? 'Đang chấm bài...' : 'Đang chạy thử...')}
            {systemStatus === 'done' && (submissionResult ? (
              submissionResult.status === 'PENDING' || submissionResult.status === 'JUDGING'
                ? 'Đang chấm bài...'
                : `Hoàn tất • ${submissionResult.status}`
            ) : 'Hoàn tất')}
          </span>
        </div>
        <span className="hidden sm:inline text-[var(--text-muted)]">
          Thực thi an toàn
        </span>
      </div>
    </div>
  );
}
