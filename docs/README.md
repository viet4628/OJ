# Tài liệu CodeJudge VN

| Tài liệu | Dùng khi |
|---|---|
| [README dự án](../README.md) | Cài đặt, chạy web/worker/engine và các lệnh kiểm tra |
| [Hướng dẫn sử dụng](user-guide.md) | Học sinh luyện bài; giáo viên soạn đề/testcase/lớp/contest; admin quản trị |
| [Database và migrations](database.md) | Tạo DB mới, nâng cấp staging, lưu trữ nội dung và kiểm tra quyền |
| [Kiến trúc backend](backend-architecture.md) | Tìm đúng module để bảo trì hoặc mở rộng worker |
| [Quyền quản lý contest](contest-ownership.md) | Owner, admin, RLS/RPC và contest cũ thiếu người tạo |
| [Rich text editor](rich-text-editor.md) | Cách lưu Markdown, toolbar chung, công thức/chỉ số và an toàn render |
| [Runbook pilot](pilot-runbook.md) | Triển khai, nâng cấp, theo dõi, xử lý sự cố và rollback |
| [Công cụ vận hành](operations-tools.md) | Backup/restore, health, load và soak |
| [Kiểm chứng và giới hạn](verification.md) | Phân biệt đã kiểm thử, kết quả lịch sử và phần chưa nghiệm thu |
| [Kế hoạch](../plan.md) | Các cổng còn lại trước tăng quy mô/mở công khai |

`reports/` giữ số đo load, restart và health để đối chiếu. Test fixtures nằm trong `e2e/fixtures/` và `supabase/tests/`; ảnh/video/log Playwright là sản phẩm sinh lại, không phải tài liệu bắt buộc.
