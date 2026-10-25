

export default function About() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-[var(--bg-primary)] p-6 rounded-2xl border border-[var(--border)] shadow-sm">
        <h1 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2 tracking-tight">
           Hướng dẫn làm bài
        </h1>
        <p className="text-[var(--text-secondary)] text-xs mt-1">
          Ngôn ngữ hỗ trợ, cách nộp bài và ý nghĩa kết quả chấm.
        </p>
      </div>

      {/* QingdaoU Style: Compiler & Judger Panel First (like FE About.vue) */}
      <section className="bg-[var(--bg-primary)] rounded-2xl p-6 border border-[var(--border)] space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
           Ngôn ngữ và biên dịch
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
                <td className="px-4 py-3.5 text-[var(--text-secondary)]">GCC</td>
                <td className="px-4 py-3.5 text-[var(--text-secondary)]">g++ -O2 -std=c++17 solution.cpp -o solution_exec</td>
              </tr>
              <tr>
                <td className="px-4 py-3.5 font-bold text-[var(--text-primary)]">Python 3</td>
                <td className="px-4 py-3.5 text-[var(--text-secondary)]">Python 3</td>
                <td className="px-4 py-3.5 text-[var(--text-secondary)]">python3 -m py_compile solution.py</td>
              </tr>
              <tr>
                <td className="px-4 py-3.5 font-bold text-[var(--text-primary)]">Rust</td>
                <td className="px-4 py-3.5 text-[var(--text-secondary)]">rustc (stable)</td>
                <td className="px-4 py-3.5 text-[var(--text-secondary)]">rustc -O solution.rs -o solution_exec</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Result Explanation Panel (like FE About.vue) */}
      <section className="bg-[var(--bg-primary)] rounded-2xl p-6 border border-[var(--border)] space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
           Giải Thích Kết Quả (Result Explanation)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
               ACCEPTED (AC - Đã Chấp Nhận)
            </div>
            <p className="text-[var(--text-secondary)]">Mã nguồn chạy chính xác 100% đối với tất cả các testcase mẫu và testcase ẩn.</p>
          </div>

          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-red-700 dark:text-red-400">
               WRONG ANSWER (WA - Kết Quả Sai)
            </div>
            <p className="text-[var(--text-secondary)]">Kết quả đầu ra của chương trình không trùng khớp với đáp án tiêu chuẩn.</p>
          </div>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
               TIME LIMIT EXCEEDED (TLE - Quá Thời Gian)
            </div>
            <p className="text-[var(--text-secondary)]">Thời gian thực thi của chương trình vượt quá giới hạn bài toán quy định .</p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
               COMPILE ERROR (CE - Lỗi Biên Dịch)
            </div>
            <p className="text-[var(--text-secondary)]">Trình biên dịch báo lỗi cú pháp mã nguồn khi thực hiện câu lệnh g++ / rustc / python3.</p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-[var(--bg-primary)] rounded-2xl p-6 border border-[var(--border)] space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
           Câu Hỏi Thường Gặp (Frequently Asked Questions)
        </h2>

        <div className="space-y-3 text-xs">
          <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-1.5">
            <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
               Thể thức thi ACM / ICPC khác gì với OI tính điểm?
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              - <strong>ACM / ICPC Rule:</strong> Bài nộp chỉ được tính điểm khi giải đúng 100% tất cả các testcase (ACCEPTED). Mỗi lần nộp sai (Wrong Answer, TLE, Runtime Error) sẽ bị tính thêm 20 phút phạt thời gian.<br />
              - <strong>OI tính điểm:</strong> Điểm dựa trên trọng số testcase, chuẩn hóa về thang 100. Bảng xếp hạng lấy điểm cao nhất từng bài. Chưa hỗ trợ nhóm subtask phải vượt qua toàn bộ test; không phạt thời gian khi nộp sai nhiều lần.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-1.5">
            <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
               Đầu vào / Đầu ra (I/O) xử lý thế nào?
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
           Các Trạng Thái Khác &amp; Runtime Error
        </h2>
        <div className="space-y-3 text-xs text-[var(--text-secondary)] leading-relaxed">
          <p><b className="text-[var(--text-primary)]">Pending &amp; Judging</b> : Bài nộp đang chờ trong hàng đợi hoặc đang được chấm.</p>
          <p><b className="text-[var(--text-primary)]">Runtime Error (RE)</b> : Chương trình gặp lỗi khi đang chạy (chia cho 0, panic, out of bounds...). Kiểm tra lại bằng chạy thử với input tự tạo.</p>
          <p><b className="text-[var(--text-primary)]">Memory Limit Exceeded (MLE)</b> : Bộ nhớ chương trình sử dụng vượt quá giới hạn RAM của bài toán.</p>
          <p><b className="text-[var(--text-primary)]">System Error (SE)</b> : Lỗi nội bộ của hệ thống chấm bài — báo cáo lại quản trị viên nếu gặp.</p>
        </div>
      </section>
    </div>
  );
}

