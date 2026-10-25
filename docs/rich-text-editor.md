# Rich text editor và định dạng lưu trữ

Studio dùng Tiptap cho đề và editorial. Bốn phần mô tả/input/output/ràng buộc nằm trong một khung, tiêu đề cố định, một toolbar bám khi cuộn. Toolbar của phần đang chọn được đưa vào vị trí chung bằng React portal. Lời giải có editor riêng trong tab lời giải; testcase, starter code và mã kiểm định là văn bản thuần.

Toolbar có tiêu đề, đậm/nghiêng, chỉ số trên/dưới, mã, danh sách, trích dẫn, bảng, công thức, bỏ định dạng và undo/redo. Chỉ số trên/dưới loại trừ nhau. Công thức có mẫu và xem trước KaTeX; bấm công thức đã có để sửa. Bảng hỗ trợ thêm/xóa hàng/cột, không cung cấp gộp ô. Cách dùng: [user guide](user-guide.md).

## Lưu và đọc

`save_problem_bundle` nhận chuỗi Markdown, không phải JSON Tiptap. `<sup>`/`<sub>` giữ chỉ số vì Markdown chuẩn không có cú pháp tương ứng; toán dùng `$...$`/`$$...$$`. Nhãn bốn phần thuộc UI, không lấy tiêu đề người dùng gõ để suy ra dữ liệu. Ràng buộc vẫn dùng marker cũ khi nối vào description. Xem [database](database.md).

Reader dùng marked để phân tích, tạo React nodes và KaTeX cho toán. Chỉ cặp thẻ `sup`/`sub` không thuộc tính được chuyển thành chỉ số; HTML khác hiển thị dạng text. Link chỉ nhận HTTP/HTTPS/mailto hoặc đường dẫn tương đối tương ứng. HTML đưa trực tiếp vào DOM chỉ do KaTeX sinh với `trust: false`, giới hạn mở rộng. Không nhúng ảnh/iframe/script của tác giả.

## Dependency và bảo trì

Tiptap React/PM/StarterKit/Markdown/Table/Mathematics, KaTeX, marked và kiểu KaTeX đã được chủ dự án đồng ý. Editor tải động trong Studio. Giữ kiểm thử lưu–mở lại khi nâng phiên bản, đặc biệt bảng, danh sách, công thức và chỉ số.

Tài liệu nhà cung cấp: [Markdown](https://tiptap.dev/docs/editor/markdown/getting-started/basic-usage), [Mathematics](https://tiptap.dev/docs/editor/extensions/nodes/mathematics), [Table](https://tiptap.dev/docs/editor/extensions/nodes/table). Kết quả kiểm tra local/staging và giới hạn nằm trong [verification](verification.md).
