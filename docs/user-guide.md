# Hướng dẫn sử dụng

## Tài khoản và không gian làm việc

Học sinh dùng trang công khai để luyện bài, tham gia lớp và kỳ thi. Giáo viên mở **Không gian giáo viên** từ menu avatar (`/teacher`); admin vào **Quản trị** (`/admin`). Quyền do DB quản lý; đăng ký tài khoản không tự cấp quyền giáo viên/admin. Admin cấp vai trò/quyền trong phần quản lý người dùng. Các quyền mặc định của giáo viên không gồm quản lý người dùng hoặc thông báo toàn hệ thống.

## Học sinh

1. Mở **Bài tập** hoặc **Luyện tập theo chủ đề**, lọc/tìm bài và đọc mô tả, input/output, ràng buộc, ví dụ.
2. Chọn C++, Python hoặc Rust. Editor tải bản nháp đang có, nếu không có thì dùng code khởi đầu của bài hoặc khung hệ thống.
3. Bấm **Chạy thử** với ví dụ hoặc input tự nhập; kiểm tra output thực tế. Đây là trial, không tính điểm/xếp hạng chính thức.
4. Bấm **Nộp bài** để chấm bằng testcase ẩn. Xem verdict, điểm và lịch sử; có thể nạp lại code từ một bài nộp.
5. Lời giải chỉ mở khi đủ điều kiện sau AC; không hiển thị trong workspace contest.

Bản nháp lưu trong localStorage, tách theo tài khoản/khách, bài, ngôn ngữ và luyện tập/contest. Đổi ngôn ngữ giữ nháp, kể cả nháp rỗng. Chưa đồng bộ giữa thiết bị; xóa dữ liệu trình duyệt có thể mất nháp. **Đặt lại mẫu** yêu cầu xác nhận khi code khác mẫu, chỉ xóa nháp của ngôn ngữ hiện tại. Cập nhật mẫu của giáo viên không ghi đè nháp đang có.

Trong lớp, nhập mã mời rồi mở bài từ chi tiết lớp để giữ ngữ cảnh nộp bài. Điểm lớp chỉ tính bài nộp chính thức đúng lớp, đúng thành viên và deadline; AC luyện tập ngoài lớp không tự thành điểm lớp.

Trong contest, đăng ký/chờ duyệt nếu được yêu cầu. Workspace có chạy mẫu, custom input và nộp như luyện tập; lịch sử/nháp/rank theo contest. Trước giờ thi khóa chạy/nộp; hết giờ khóa nộp, có thể chạy thử nếu còn quyền đọc đề. DB kiểm tra thời gian/quyền độc lập với giao diện. Bảng xếp hạng có thể bị freeze theo cấu hình.

## Giáo viên: soạn đề

Mỗi giáo viên chỉ thấy và sửa đề do mình tạo trong ngân hàng đề; testcase ẩn và lời giải tham khảo chỉ chủ đề và admin xem được. Muốn dùng đề của người khác trong lớp/contest thì đề đó phải công khai. Chi tiết: [quyền theo người tạo](contest-ownership.md).

1. Trong **Danh sách bài tập**, chọn **Soạn bài mới** hoặc sửa bài đã có. Nhập tên/slug, độ khó, thời gian, bộ nhớ, chủ đề và phạm vi công khai.
2. Khung nội dung chia sẵn **Mô tả đề bài**, **Dữ liệu vào**, **Dữ liệu ra**, **Ràng buộc**. Một toolbar chung định dạng phần đang chọn: tiêu đề, đậm/nghiêng, chỉ số trên/dưới, danh sách, trích dẫn, mã, bảng, công thức và hoàn tác/làm lại.
3. Bôi đen chữ rồi bấm **x²** hoặc **x₂** để đặt chỉ số. Với biểu thức toán, bấm **Σ**, chọn mẫu/sửa giá trị và xem trước; bấm công thức đã có để sửa.
4. Nhập **Ví dụ mẫu** riêng để học sinh có thể xem/chạy thử. Dữ liệu ví dụ và testcase chấm kín có phạm vi khác nhau.
5. Trong **Code khởi đầu**, nhập mẫu cho từng ngôn ngữ; ô trống dùng khung hệ thống. Mẫu có thể công khai cùng đề, nên chỉ chứa khung/hướng dẫn, không chứa đáp án kín.
6. Trong **Bộ testcase**, nhập thủ công hoặc tải ZIP theo hướng dẫn dưới đây. Kiểm tra trọng số và cờ sample/secret từng test.
7. Trong **Lời giải & Ghi chú**, soạn editorial; mã nguồn kiểm định được nhập riêng, lưu đề trước rồi chạy **Kiểm định lời giải** trên toàn bộ testcase. Sửa đề/testcase làm kết quả kiểm định cũ hết hiệu lực.
8. **Xem trước đề** rồi **Tạo bài tập/Lưu thay đổi**. Nhập ZIP hoặc chỉnh nội dung chưa thay thế bước lưu.

## Định dạng testcase ZIP

Mỗi testcase gồm dữ liệu input và kết quả output đúng. File là văn bản thuần UTF-8.

| Input | Output | Quy tắc |
|---|---|---|
| `01.in` | `01.out` hoặc `01.ans` | Cùng tên trước đuôi |
| `input00.txt` | `output00.txt` | Cùng số thứ tự; tiếp tục `input01.txt`/`output01.txt` |

```text
testcases.zip
  01.in
  01.out
  02.in
  02.out
```

Nén các cặp file rồi bấm **Tải lên ZIP**. Mỗi file tối đa 1 MiB; ZIP và tổng giải nén tối đa 32 MiB. Tên file phải duy nhất toàn ZIP, kể cả ở thư mục con hoặc chỉ khác chữ hoa/thường. Thiếu cặp, trùng tên, CRC hỏng hoặc vượt dung lượng sẽ hủy lượt nhập, giữ bộ test hiện có. Hệ thống tự ghép theo tên, không theo thứ tự trong ZIP.

Code đọc stdin (`cin`, `input()`) và ghi stdout (`cout`, `print()`); tên file ZIP phục vụ ghép cặp. Test ZIP mặc định là test ẩn; sau nhập kiểm tra điểm và bấm lưu. Nút **Tải về ZIP** xuất bộ test hiện tại theo cặp `input00.txt`/`output00.txt`.

## Giáo viên: lộ trình luyện tập

Trong Không gian giáo viên, mục **Lộ Trình Luyện Tập** gom bài thành chủ đề có thứ tự (ví dụ Nhập môn lập trình, Sắp xếp). Mỗi lộ trình có tên, đường dẫn, mô tả, thứ tự hiển thị và trạng thái công khai/nháp. Chỉ thêm được đề công khai hoặc đề do mình tạo; đề riêng tư vẫn ẩn với học sinh dù nằm trong lộ trình công khai. Học sinh mở **Luyện theo chủ đề** (`/learn`) để xem tiến độ từng lộ trình và làm bài tiếp theo; phần luyện theo nhãn vẫn giữ bên dưới. Giáo viên quản lý lộ trình mình tạo, admin quản lý tất cả. Migration: `supabase/migrations/20261113_learning_tracks.sql`.

## Giáo viên: lớp học

Tạo lớp, nhập tên và mã mời tùy chọn. Mã trùng có thông báo để sửa; tạo thành công mở chi tiết lớp, sao chép mã mời rồi giao bài đầu tiên. Học sinh dùng mã để tham gia. Chọn bài chưa giao, đặt hạn nộp tương lai khi cần. Theo dõi danh sách thành viên, tiến độ/điểm và tải CSV trong lớp; kiểm tra trạng thái lỗi tải thay vì hiểu là lớp trống.

## Giáo viên: contest

Tạo contest với lịch thi, ACM/OI, public/private và yêu cầu đăng ký nếu cần. Tìm/chọn/sắp bài trong editor; OI cho điểm từng bài, ACM dùng quy tắc AC/penalty. Cấu hình freeze khi cần và lưu đúng phần metadata/danh sách bài. Khi tải/lưu danh sách lỗi, sửa lỗi hoặc thử lại trước khi tiếp tục.

Mỗi giáo viên chỉ quản lý contest mình tạo: sửa/xóa, danh sách bài, duyệt đăng ký và chấm lại. Admin quản lý toàn hệ thống. Contest cũ chưa có chủ chỉ admin quản lý; admin xác minh rồi gán người tạo. Chi tiết: [contest ownership](contest-ownership.md).

## Admin và người vận hành

Admin quản lý người dùng/quyền, khóa/mở tài khoản có lý do và kiểm tra audit. Khóa tài khoản thu hồi phiên qua backend; JWT cũ vẫn bị DB chặn ghi. Dashboard dùng heartbeat thật của worker.

Chỉ mở pilot khi health sẵn sàng và đã chấm canary đúng. Vận hành, recovery và giới hạn sandbox nằm trong [runbook](pilot-runbook.md) và [verification](verification.md). Nền tảng hiện chấm theo trọng số testcase, chưa cung cấp SPJ/interactive/subtask/plagiarism hoàn chỉnh.
