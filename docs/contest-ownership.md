# Quyền quản lý contest theo người tạo

## Quy tắc

- Giáo viên/người có `contests.manage` quản lý contest có `created_by` bằng ID tài khoản của mình. Super admin vẫn quản lý toàn hệ thống theo RBAC của dự án.
- Tạo contest ghi người tạo từ phiên đăng nhập; DB cũng có default `auth.uid()`. Không thể giả mạo chủ khi tạo hoặc tự chuyển/gỡ chủ bằng update. Admin có thể chuyển chủ khi đã xác định đúng tài khoản.
- Quy tắc áp dụng cho sửa/xóa contest, thêm/bớt/sắp bài và điểm OI, duyệt đăng ký, chấm lại bài nộp trong contest và quyền xem rank chưa freeze. `problems.manage` không được dùng để chấm lại contest người khác.
- Xóa đề bằng REST hoặc `delete_problem` bị chặn nếu đề đang được dùng trong contest không thuộc quyền quản lý, tránh xóa gián tiếp danh sách bài bằng cascade. Quyền sửa nội dung ngân hàng đề vẫn theo RBAC hiện có.
- Người khác vẫn xem/tham gia contest công khai hoặc contest đã được duyệt theo quy tắc học sinh; quyền `contests.manage` toàn cục không còn cho vào contest riêng tư của người khác.

## Giao diện và API

- Danh sách quản lý của giáo viên query `created_by=auth.uid()` và kiểm tra lại chủ trên dữ liệu trả về. Danh sách công khai không bị lọc theo chủ. Admin console hiện mọi contest có quyền đọc.
- Không hiện chấm lại đối với bài nộp trong contest người khác. Backend vẫn kiểm tra độc lập, dù client bị sửa.
- Update metadata phải trả về ID đã cập nhật; RLS trả zero row không được báo lưu thành công. Lưu danh sách bài kiểm tra `can_manage_contest` trước khi ghi/xóa; RLS kiểm tra cả parent cũ và mới khi chuyển liên kết bài thi.

## Migration và contest cũ

Chạy `supabase/migrations/20261025_contest_ownership.sql` trong SQL Editor. File có transaction và chạy lại an toàn. `supabase/schema.sql` cũng có cùng bản sửa, ở cuối sau các định nghĩa RBAC/RPC cũ.

Nếu đã áp dụng bản ownership ban đầu, chạy thêm `supabase/migrations/20261025_contest_owner_visibility.sql`. Kiểm tra staging phát hiện `INSERT … RETURNING` của contest riêng tư bị policy đọc chặn: hàm STABLE truy vấn lại bảng không nhìn thấy dòng vừa insert. Policy đọc hiện kiểm tra quyền/người tạo trực tiếp trên dòng; không nới quyền đọc contest riêng của người khác.

**Không tự gán các contest cũ có `created_by IS NULL`.** Không có dữ liệu đáng tin để suy ra người tạo. Các contest này chỉ admin quản lý; khi xác minh được chủ, admin có thể cập nhật `created_by` bằng tài khoản/SQL có thẩm quyền. Không dùng SQL đổi đồng loạt chủ hoặc cấp lại quyền quản lý toàn cục.

## Kiểm tra

`npm run test:db` kiểm tra hai giáo viên/admin, mọi đường ghi/RPC/cascade, chống chuyển chủ, freeze và legacy owner. `e2e/classrooms.spec.ts` kiểm tra UI quản lý theo chủ; `node e2e/staging-contest-ownership.mjs` dùng Auth/REST/RPC/RLS thật và dọn fixture. Kết quả hiện tại: [verification](verification.md). Các migration staging đã được chủ dự án xác nhận áp dụng thành công.
