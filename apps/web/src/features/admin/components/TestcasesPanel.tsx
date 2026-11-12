import { useState, type Dispatch, type RefObject, type SetStateAction, type ChangeEvent } from 'react';
import MorphIcon from '../../../components/MorphIcon';
import { Download as DownloadData, Plus as PlusData, RefreshCw as RefreshCwData, Trash2 as Trash2Data, Upload as UploadData } from 'lucide';
import type { StagedTestcase } from '../tabs/AdminProblemsTab';

/** Problem studio "Testcases" tab: manual entry, ZIP import/export, weights. */
export default function TestcasesPanel({ stagedTestcases, setStagedTestcases, tcLoading, isImportingZip, zipNotice, zipInputRef, onZipSelected, onDownloadZip }: {
  stagedTestcases: StagedTestcase[];
  setStagedTestcases: Dispatch<SetStateAction<StagedTestcase[]>>;
  tcLoading: boolean;
  isImportingZip: boolean;
  zipNotice: string | null;
  zipInputRef: RefObject<HTMLInputElement>;
  onZipSelected: (e: ChangeEvent<HTMLInputElement>) => void;
  onDownloadZip: () => void;
}) {
  const [manualInput, setManualInput] = useState('');
  const [manualOutput, setManualOutput] = useState('');
  const [manualScore, setManualScore] = useState(10);
  const [manualIsSample, setManualIsSample] = useState(false);
  const totalPoints = stagedTestcases.reduce((acc, tc) => acc + (Number(tc.score) || 0), 0);

  const handleAddManualTestcase = () => {
    setStagedTestcases((prev) => [
      ...prev,
      { input_content: manualInput, output_content: manualOutput, score: manualScore, is_sample: manualIsSample, is_new: true },
    ]);
    setManualInput('');
    setManualOutput('');
    setManualIsSample(false);
  };

  const handleDistribute100Points = () => {
    if (stagedTestcases.length === 0) return;
    const count = stagedTestcases.length;
    const baseScore = Math.floor(100 / count);
    const remainder = 100 % count;
    setStagedTestcases((prev) => prev.map((tc, idx) => ({ ...tc, score: baseScore + (idx < remainder ? 1 : 0) })));
  };

  return (
          <div className="space-y-4">
            {/* Box: ZIP Import */}
            <div className="border border-[var(--border)] rounded-md bg-[var(--bg-secondary)] overflow-hidden shadow-xs">
              <div className="bg-tertiary/75 px-4 py-2.5 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                    Nhập & Xuất bộ testcase
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Mỗi testcase gồm một file đầu vào (input) và một file kết quả mong đợi (output). Nén các cặp file vào ZIP để tải lên.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={zipInputRef}
                    accept=".zip"
                    onChange={onZipSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => zipInputRef.current?.click()}
                    disabled={isImportingZip}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {isImportingZip ? <MorphIcon icon={RefreshCwData} size={14} className="animate-spin" /> : <MorphIcon icon={UploadData} size={14} />}
                    {isImportingZip ? 'Đang đọc...' : 'Tải lên ZIP'}
                  </button>
                  <button
                    type="button"
                    onClick={onDownloadZip}
                    disabled={stagedTestcases.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--bg-secondary)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    <MorphIcon icon={DownloadData} size={14} className="text-[var(--text-secondary)]" /> Tải về ZIP
                  </button>
                </div>
              </div>

              <section aria-label="Hướng dẫn chuẩn bị testcase" className="p-4 border-b border-[var(--border)] space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                <h4 className="font-semibold text-[var(--text-primary)]">Cách chuẩn bị file testcase</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p><strong className="text-[var(--text-primary)]">Input:</strong> đuôi <code>.in</code>. <strong className="text-[var(--text-primary)]">Output:</strong> đuôi <code>.out</code> hoặc <code>.ans</code>. Hai file phải cùng tên trước đuôi: <code>01.in</code> ghép với <code>01.out</code> hoặc <code>01.ans</code>.</p>
                    <p>Với file <code>.txt</code>, dùng cặp <code>input00.txt</code> / <code>output00.txt</code>, <code>input01.txt</code> / <code>output01.txt</code>… có cùng số thứ tự.</p>
                    <pre aria-label="Ví dụ cấu trúc ZIP" className="rounded border border-[var(--border)] bg-[var(--bg-primary)] p-3 font-mono overflow-x-auto">{'testcases.zip\n  01.in\n  01.out\n  02.in\n  02.out'}</pre>
                  </div>
                  <ul className="list-disc pl-4 space-y-2">
                    <li>Lưu nội dung dưới dạng văn bản thuần UTF-8. File input chứa dữ liệu đưa vào chương trình; file output chứa kết quả đúng cần đối chiếu.</li>
                    <li>Mỗi file tối đa 1 MiB; ZIP và tổng dữ liệu giải nén tối đa 32 MiB.</li>
                    <li>Tên file phải duy nhất trong ZIP, kể cả ở thư mục con hoặc chỉ khác chữ hoa/thường. Thiếu cặp input/output sẽ hủy toàn bộ lượt nhập.</li>
                    <li>Chương trình đọc từ đầu vào chuẩn (<code>cin</code>, <code>input()</code>) và ghi ra đầu ra chuẩn (<code>cout</code>, <code>print()</code>).</li>
                    <li>Testcase nhập từ ZIP mặc định là test ẩn. Kiểm tra điểm từng test rồi bấm <strong>Lưu thay đổi</strong> hoặc <strong>Tạo bài tập</strong> để lưu.</li>
                  </ul>
                </div>
              </section>

              {zipNotice && (
                <div role="status" className="p-3 bg-[var(--bg-primary)] border-b border-[var(--border)] text-xs font-medium text-[var(--text-primary)]">
                  {zipNotice}
                </div>
              )}

              {/* Manual Add inside box */}
              <div className="p-4 space-y-3 bg-canvas/40 border-b border-[var(--border)]">
                <span className="block text-xs font-semibold text-[var(--text-primary)]">
                  Thêm testcase thủ công
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <textarea aria-label="Input testcase mới"
                    rows={2}
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Input (dữ liệu vào)..."
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-2 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                  />
                  <textarea aria-label="Output testcase mới"
                    rows={2}
                    value={manualOutput}
                    onChange={(e) => setManualOutput(e.target.value)}
                    placeholder="Output mong đợi..."
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-2 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                      Điểm:
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={manualScore}
                        onChange={(e) => setManualScore(Number(e.target.value))}
                        className="w-14 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md px-2 py-0.5 text-xs text-center font-mono text-[var(--text-primary)]"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={manualIsSample}
                        onChange={(e) => setManualIsSample(e.target.checked)}
                        className="accent-[var(--accent)]"
                      />
                      Testcase mẫu (công khai cho học sinh)
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddManualTestcase}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-[var(--bg-secondary)] hover:bg-[var(--border)] border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] transition-colors cursor-pointer shadow-xs"
                  >
                    <MorphIcon icon={PlusData} size={14} /> Thêm test
                  </button>
                </div>
              </div>

              {/* Testcase List Table */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">Danh sách testcase</span>
                    <span className="rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] px-2 py-0.2 text-[10px] text-[var(--text-secondary)] font-mono">
                      {stagedTestcases.length} tests · Tổng: {totalPoints} điểm
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDistribute100Points}
                      disabled={stagedTestcases.length === 0}
                      className="px-2.5 py-1 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--border)] border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Chia đều 100 điểm
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Xóa toàn bộ testcases hiện tại?')) {
                          setStagedTestcases([]);
                        }
                      }}
                      disabled={stagedTestcases.length === 0}
                      className="px-2.5 py-1 rounded-md text-[var(--danger)] hover:bg-danger/10 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Xóa tất cả
                    </button>
                  </div>
                </div>

                {tcLoading ? (
                  <div className="py-8 text-center text-xs text-[var(--text-muted)] space-y-2">
                    <MorphIcon icon={RefreshCwData} size={16} className="animate-spin mx-auto text-[var(--accent)]" />
                    <p>Đang tải testcases...</p>
                  </div>
                ) : stagedTestcases.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                    Chưa có testcase nào.
                  </div>
                ) : (
                  <div className="border border-[var(--border)] rounded-md overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-tertiary/75 text-[var(--text-muted)] font-medium text-[11px] border-b border-[var(--border)]">
                        <tr>
                          <th className="px-3 py-2">STT</th>
                          <th className="px-3 py-2">Loại</th>
                          <th className="px-3 py-2">Điểm</th>
                          <th className="px-3 py-2">Đầu vào</th>
                          <th className="px-3 py-2">Đầu ra</th>
                          <th className="px-3 py-2 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)] bg-[var(--bg-secondary)]">
                        {stagedTestcases.map((tc, idx) => (
                          <tr key={tc.id || idx} className="hover:bg-tertiary/40 transition-colors">
                            <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">
                              #{idx + 1}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setStagedTestcases((prev) => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], is_sample: !copy[idx].is_sample };
                                    return copy;
                                  });
                                }}
                                className={`px-2 py-0.2 rounded-full text-[10px] font-mono border transition-colors cursor-pointer ${
                                  tc.is_sample
                                    ? 'bg-accent/10 text-[var(--accent-text)] border-accent/30'
                                    : 'bg-[var(--bg-primary)] text-[var(--text-muted)] border-[var(--border)]'
                                }`}
                              >
                                {tc.is_sample ? 'sample' : 'secret'}
                              </button>
                            </td>
                            <td className="px-3 py-2">
                              <input aria-label="Trọng số testcase"
                                type="number"
                                min={1}
                                max={100}
                                value={tc.score}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setStagedTestcases((prev) => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], score: val };
                                    return copy;
                                  });
                                }}
                                className="w-12 bg-[var(--bg-primary)] border border-[var(--border)] rounded px-1.5 py-0.2 text-xs text-center font-mono text-[var(--text-primary)]"
                              />
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-[var(--text-primary)] max-w-[200px] truncate">
                              {tc.input_content ? tc.input_content.replace(/\n/g, ' ⏎ ') : '—'}
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-[var(--text-primary)] max-w-[200px] truncate">
                              {tc.output_content ? tc.output_content.replace(/\n/g, ' ⏎ ') : '—'}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setStagedTestcases((prev) => prev.filter((_, i) => i !== idx));
                                }}
                                className="p-1 rounded text-[var(--danger)] hover:bg-danger/10 transition-colors cursor-pointer"
                                title="Xóa testcase"
                              >
                                <MorphIcon icon={Trash2Data} size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
  );
}
