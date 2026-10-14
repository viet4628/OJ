import { HelpCircle, Code, ShieldCheck, Terminal, CheckCircle2, AlertOctagon, Clock, BookOpen, Cpu, Info } from 'lucide-react';

export default function About() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-[var(--bg-primary)] p-6 rounded-2xl border border-[var(--border)] shadow-sm">
        <h1 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2 tracking-tight">
          <HelpCircle className="w-5 h-5 text-[var(--accent-text)]" /> Hướng Dẫn & Thông Số Trình Biên Dịch (FAQ)
        </h1>
        <p className="text-[var(--text-secondary)] text-xs mt-1">
          Quy định chấm bài tự động, thông số cflags trình biên dịch & định nghĩa các mã trạng thái chấm bài
        </p>
      </div>

      {/* QingdaoU Style: Compiler & Judger Panel First (like FE About.vue) */}
      <section className="bg-[var(--bg-primary)] rounded-2xl p-6 border border-[var(--border)] space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
          <Code className="w-4 h-4 text-[var(--accent-text)]" /> Trình Biên Dịch &amp; Judger (Compiler &amp; Judger)
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-secondary)] uppercase text-[var(--text-secondary)] border-b border-[var(--border)] font-bold text-[11px]">
              <tr>
                <th className="px-4 py-3">Ngôn Ngữ</th>
                <th className="px-4 py-3">Trình Biên Dịch</th>
                <th className="px-4 py-3">Lệnh Biên Dịch (Compilation Command)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-code">
              <tr>
                <td className="px-4 py-3.5 font-bold text-[var(--text-primary)]">C++17</td>
                <td className="px-4 py-3.5 text-sky-600 dark:text-sky-400">GCC 11.4.0 (Linux)</td>
                <td className="px-4 py-3.5 text-[var(--text-secondary)]">g++ -O2 -std=c++17 solution.cpp -o solution_exec</td>
              </tr>
              <tr>
                <td className="px-4 py-3.5 font-bold text-[var(--text-primary)]">Python 3</td>
                <td className="px-4 py-3.5 text-sky-600 dark:text-sky-400">Python 3.10.12</td>
                <td className="px-4 py-3.5 text-[var(--text-secondary)]">python3 -m py_compile solution.py</td>
              </tr>
              <tr>
                <td className="px-4 py-3.5 font-bold text-[var(--text-primary)]">Rust</td>
                <td className="px-4 py-3.5 text-sky-600 dark:text-sky-400">rustc (stable)</td>
                <td className="px-4 py-3.5 text-[var(--text-secondary)]">rustc -O solution.rs -o solution_exec</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Result Explanation Panel (like FE About.vue) */}
      <section className="bg-[var(--bg-primary)] rounded-2xl p-6 border border-[var(--border)] space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
          <ShieldCheck className="w-4 h-4 text-[var(--accent-text)]" /> Giải Thích Kết Quả (Result Explanation)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 text-[var(--accent-text)]" /> ACCEPTED (AC - Đã Chấp Nhận)
            </div>
            <p className="text-[var(--text-secondary)]">Mã nguồn chạy chính xác 100% đối với tất cả các testcase mẫu và testcase ẩn.</p>
          </div>

          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-red-700 dark:text-red-400">
              <AlertOctagon className="w-4 h-4 text-red-500" /> WRONG ANSWER (WA - Kết Quả Sai)
            </div>
            <p className="text-[var(--text-secondary)]">Kết quả đầu ra của chương trình không trùng khớp với đáp án tiêu chuẩn.</p>
          </div>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
              <Clock className="w-4 h-4 text-amber-500" /> TIME LIMIT EXCEEDED (TLE - Quá Thời Gian)
            </div>
            <p className="text-[var(--text-secondary)]">Thời gian thực thi của chương trình vượt quá giới hạn bài toán quy định (&gt; 1000ms).</p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
              <Terminal className="w-4 h-4 text-[var(--text-secondary)]" /> COMPILE ERROR (CE - Lỗi Biên Dịch)
            </div>
            <p className="text-[var(--text-secondary)]">Trình biên dịch báo lỗi cú pháp mã nguồn khi thực hiện câu lệnh g++ / rustc / python3.</p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-[var(--bg-primary)] rounded-2xl p-6 border border-[var(--border)] space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
          <BookOpen className="w-4 h-4 text-[var(--accent-text)]" /> Câu Hỏi Thường Gặp (Frequently Asked Questions)
        </h2>

        <div className="space-y-3 text-xs">
          <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-1.5">
            <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Info className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Thể thức thi ACM / ICPC khác gì với OI Subtask?
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              - <strong>ACM / ICPC Rule:</strong> Bài nộp chỉ được tính điểm khi giải đúng 100% tất cả các testcase (ACCEPTED). Mỗi lần nộp sai (Wrong Answer, TLE, Runtime Error) sẽ bị tính thêm 20 phút phạt thời gian.<br />
              - <strong>OI Subtask Rule:</strong> Bài toán được chia thành nhiều Subtask nhỏ với thang điểm 100. Thí sinh sẽ nhận điểm tương ứng với tỷ lệ subtask chạy thành công. Không bị phạt thời gian khi nộp sai nhiều lần.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-1.5">
            <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Info className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Đầu vào / Đầu ra (I/O) xử lý thế nào?
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Mã nguồn của bạn cần đọc dữ liệu trực tiếp từ <strong>Standard Input (STDIN / cin / sys.stdin)</strong> và in kết quả ra <strong>Standard Output (STDOUT / cout / print)</strong>. Không sử dụng các thao tác đọc/ghi file như `freopen` hoặc file cục bộ.
            </p>
          </div>
        </div>
      </section>

      {/* Pending & Judging + Runtime Error statuses (FE About.vue lists all) */}
      <section className="bg-[var(--bg-primary)] rounded-2xl p-6 border border-[var(--border)] space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
          <BookOpen className="w-4 h-4 text-[var(--accent-text)]" /> Các Trạng Thái Khác &amp; Runtime Error
        </h2>
        <div className="space-y-3 text-xs text-[var(--text-secondary)] leading-relaxed">
          <p><b className="text-[var(--text-primary)]">Pending &amp; Judging</b> : Bài nộp đang chờ trong hàng đợi hoặc đang được daemon chấm bài.</p>
          <p><b className="text-[var(--text-primary)]">Runtime Error (RE)</b> : Chương trình gặp lỗi khi đang chạy (chia cho 0, panic, out of bounds...). Chi tiết lỗi xuất hiện trên stderr.</p>
          <p><b className="text-[var(--text-primary)]">Memory Limit Exceeded (MLE)</b> : Bộ nhớ chương trình sử dụng vượt quá giới hạn RAM của bài toán.</p>
          <p><b className="text-[var(--text-primary)]">System Error (SE)</b> : Lỗi nội bộ của hệ thống chấm bài — báo cáo lại quản trị viên nếu gặp.</p>
        </div>
      </section>
    </div>
  );
}

