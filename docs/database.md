# Database và migrations

## Nguồn và môi trường

`supabase/schema.sql` là schema tổng có transaction, RLS/RPC/trigger và các thay đổi hiện tại; an toàn chạy lại. `supabase/seed.sql` là dữ liệu local/demo, có thao tác thay testcase mẫu. Các test SQL ở `supabase/tests/`; `npm run test:db` tạo PostgreSQL tạm, chạy schema/seed nhiều lần và kiểm tra quyền, ownership, dữ liệu.

DB mới: SQL Editor chạy schema tổng; chỉ chạy seed khi là DB local/demo trống. Supabase Auth tạo profile qua trigger. Admin đầu tiên được người có quyền SQL cấp vai trò sau khi tài khoản đã đăng ký:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'owner@example.com';
```

Tài khoản thực và khóa chỉ cấu hình ở file local hoặc hệ thống secrets; không thêm vào schema/seed/tài liệu.

## Nâng cấp DB hiện hữu

Backup trước, tạm dừng ghi/worker theo [runbook](pilot-runbook.md), chạy schema tổng hiện tại bằng SQL Editor. Không seed vào staging đang có dữ liệu. Nếu nâng theo migration riêng, dùng thứ tự phụ thuộc dưới đây, thay vì sort tên file cùng ngày:

1. `supabase/migrations/20261025_platform.sql`
2. `supabase/migrations/20261025_starter_codes.sql`
3. `supabase/migrations/20261025_contest_ownership.sql`
4. `supabase/migrations/20261025_contest_owner_visibility.sql`
5. `supabase/migrations/20261025_performance.sql` — danh sách bài phân trang và rank contest tổng hợp theo tập hợp.

Schema tổng đã bao gồm các thay đổi này; không cần chạy cả hai cách. Chủ dự án đã xác nhận áp dụng các migration trên staging trong phiên 25/10/2026. Các thay đổi UI/rich text/hướng dẫn testcase sau đó không cần migration mới.

Migration performance cũng đã được chủ dự án chạy thành công qua SQL Editor; kiểm tra REST bằng anon xác nhận `get_problem_page` và `get_contest_rank` hoạt động. Deploy web mới cần migration này trước. RPC danh sách bài dùng SECURITY INVOKER, chỉ trả trường hiển thị của đề công khai và tiến độ của chính người gọi; không trả mô tả đầy đủ hoặc nội dung testcase.

Sau nâng cấp, xác nhận REST/RPC, quyền anon/student/teacher/admin và chấm canary. Worker chỉ chạy một daemon/DB; deploy web và worker tương ứng schema. Các script staging tạo/xóa fixture thật, chỉ chạy ở môi trường riêng đã được cấp quyền.

## Dữ liệu nội dung

- `problems.description`, `input_format`, `output_format`: chuỗi Markdown. Ràng buộc hiện nối vào description bằng marker `### Ràng buộc dữ liệu (Constraints)`; Studio tách lại khi mở. Giữ marker tương thích khi sửa lưu trữ.
- Rich text chuyển thành Markdown trước `save_problem_bundle`; chỉ số dùng `<sup>`/`<sub>`, công thức `$...$`/`$$...$$`. Editor không lưu JSON Tiptap vào DB.
- `problems.starter_codes`: object khóa `cpp`, `python`, `rust`; giá trị chuỗi, tối đa 200.000 byte JSON. Client cũ không gửi trường này vẫn giữ mẫu hiện có. Đây là dữ liệu công khai theo quyền đọc đề.
- Lời giải, mã kiểm định và testcase kín được quản lý riêng; chỉ samples trong `problems.samples` là ví dụ cho người học. `save_problem_bundle` lưu đề/testcase/editorial trong một transaction và rollback khi dữ liệu lỗi.
- Testcase có thể inline hoặc trong Storage bucket `testcases` private. Giữ ID/đường dẫn của testcase cũ khi chỉnh metadata; không đưa input/output hidden vào API/submission details trả học sinh.

## Quyền và pipeline

RLS/RPC là lớp quyết định cuối cùng, kể cả client gọi REST trực tiếp. Giáo viên có quyền quản lý đề/test/contest và xem bài nộp mặc định; admin bypass theo quy tắc hiện có. Demote giáo viên xóa quyền được cấp. Contest còn kiểm tra người tạo, không chỉ quyền `contests.manage` toàn cục.

Service role chỉ dùng server-side. `claim_submission` nguyên tử từ PENDING sang JUDGING; bài chạy thử có `is_run=true`, không cộng rank/lịch sử chính thức. Membership/deadline, thời gian contest, quota và tính toàn vẹn verdict đều kiểm tra ở DB. Chi tiết ownership/legacy owner: [contest ownership](contest-ownership.md).
