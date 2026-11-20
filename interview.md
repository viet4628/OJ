# CodeJudge VN: ghi chú phỏng vấn

Tài liệu ôn tập: dự án là gì, kiến trúc, những vấn đề đã tìm ra và sửa, cách kiểm chứng, các quyết định thiết kế và câu hỏi hay gặp. Mọi con số dưới đây đều lấy từ `docs/verification.md`, `docs/reports/` và lịch sử commit.

---

## 1. Giới thiệu nhanh (30 giây)

> CodeJudge VN là nền tảng luyện và chấm lập trình online cho học sinh, giáo viên và admin: bài tập, lớp học, contest ACM/OI, bảng xếp hạng. Frontend là một SPA React/TypeScript; Supabase (PostgreSQL + RLS + Auth + Storage) vừa là backend vừa là lớp phân quyền; một worker Node.js nhận bài nộp và gọi engine chấm viết bằng Rust qua gRPC; code của học sinh chạy trong sandbox bubblewrap với seccomp và rlimit. Tôi tập trung vào độ đúng của verdict, bảo mật dữ liệu đề/testcase, cô lập sandbox và hiệu năng chấm.

## 2. Kiến trúc

```
Trình duyệt (React 18 + Vite + Monaco)
   │  supabase-js (anon key, JWT người dùng)
   ▼
Supabase: PostgreSQL 15 + RLS + RPC + Realtime + Storage (bucket testcases private)
   │  Realtime + polling 2s, service-role key
   ▼
Judge worker (Node 22, TypeScript)
   - claim nguyên tử: UPDATE ... SET status='JUDGING' WHERE status='PENDING'
   - hàng đợi có giới hạn, chạy WORKER_CONCURRENCY job song song
   - gRPC CasesProvider :50052 (đóng gói testcase cho engine)
   │  gRPC Submit/SelfTest :50051 (mạng Docker nội bộ)
   ▼
rsjudge engine (Rust, Tokio, Tonic)
   - compile → chạy từng testcase → so output → stream kết quả từng case
   - GNU time (đo usage, ngoài sandbox) → bwrap (namespaces, FS chỉ đọc)
     → chương trình là PID 1, seccomp, rlimit CPU/AS/FSIZE, wall-time
```

**Điểm thiết kế chính**
- **DB là lớp phân quyền cuối cùng:** RLS và RPC `SECURITY DEFINER` kiểm tra quyền kể cả khi client gọi REST trực tiếp. Người dùng không tự ghi được verdict hay điểm (có trigger chặn). Quota nộp bài dùng `pg_advisory_xact_lock`, nên không lách được bằng request đồng thời.
- **Không chấm trùng:** mỗi bài phải được claim nguyên tử trước khi chấm. Kết quả chỉ được ghi khi bài còn ở trạng thái `JUDGING`. Nếu ghi bị timeout, worker đọc lại để đối chiếu chứ không ghi lại mù.
- **Phân quyền RBAC:** ba vai trò user/teacher/admin, cộng quyền chi tiết trong bảng `user_permissions`. Contest và đề đều giới hạn theo người tạo (`can_manage_contest`, `can_manage_problem`).
- **Kiểm thử nhiều tầng:** SQL test trên PostgreSQL tạm; unit test worker; smoke sandbox; test Rust; `test:pilot` chạy worker + engine thật với DB tạm; 70 test Playwright; script kiểm chứng trên staging.

## 3. Những gì đã làm (theo kiểu STAR: bối cảnh → nguyên nhân → cách sửa → kết quả)

### 3.1 Verdict sai với time limit lẻ giây
- **Bối cảnh:** khi rà soát engine, phát hiện `RLIMIT_CPU` được đặt bằng `time_limit.as_secs()`, tức làm tròn xuống: 1500ms thành 1s.
- **Tái hiện:** viết test tạm. Chương trình dùng 1,2s CPU với limit 1500ms bị kill ở 0,99s và nhận **RUNTIME_ERROR**, đúng ra phải là ACCEPTED.
- **Sửa:** rlimit làm tròn lên (`div_ceil(1000)`), quyết định TLE theo CPU đo được, wall-time cho thêm 1,5s (khớp sandbox local) để tranh chấp CPU giữa các job song song không gây TLE giả.
- **Kết quả:** thêm test hồi quy (1,2s → AC, 1,7s → TLE, chương trình `sleep` bị wall-time dừng). Script staging đổi sang limit 1500ms. Truy vấn staging xác nhận không cần chấm lại bài nào.
- **Hồi quy do chính bản sửa gây ra, và bài học:** rlimit = ceil(limit) bằng đúng 1s khi limit là 1000ms (mức mặc định). Kernel kill ở ~0,99s, thấp hơn limit, nên vòng lặp vô hạn ra RUNTIME_ERROR. Trước đây wall-time cũng 1s nên che mất lỗi; khi thêm biên 1,5s thì lỗi lộ ra. Test chỉ dùng 500ms và 1500ms nên bỏ sót; `smoke-staging` (1000ms) bắt được sau khi deploy. Sửa: rlimit = ceil(limit) + 1s, thêm test cho limit tròn giây, truy vấn staging xác nhận 0 bài bị ảnh hưởng. Bài học: test giá trị biên phải gồm cả **giá trị mặc định**; nên chạy smoke staging ngay sau mỗi lần deploy engine, chứ không chỉ chạy script mình vừa viết.

### 3.2 Học sinh có thể tự làm giả thời gian/bộ nhớ của bài mình
- **Bối cảnh:** GNU time chạy *bên trong* sandbox và ghi báo cáo vào thư mục bài, nơi chương trình có quyền ghi.
- **Tái hiện:** chương trình chạy 1,2s CPU, xoá file báo cáo rồi tự ghi `0.00 0.00 1000`. Hệ thống ghi nhận 0ms/1MB, verdict ACCEPTED. Hậu quả: qua mặt được bước kiểm tra CPU, làm giả số liệu trên bảng xếp hạng.
- **Thử nghiệm để tìm hướng sửa:** đo từ bên ngoài bwrap thì thấy 0s CPU, vì tiến trình init trung gian của bwrap che usage. Thêm `bwrap --as-pid-1` thì `wait4` thấy đúng 1,1s/160MB.
- **Lỗi thứ hai phát hiện khi kiểm chứng:** nếu engine tự `wait4` tiến trình con mà nó fork ra, `maxrss` tính cả RSS của engine trước `exec` (~15MB). Bài rỗng hiện 14–16MB, đề limit 16MB sẽ MLE oan.
- **Sửa:** GNU time chạy *ngoài* sandbox, là một tiến trình nhỏ riêng; báo cáo nằm ngoài thư mục được bind; chương trình là PID 1.
- **Kết quả:** test hồi quy cho từng điểm: không làm giả được, bài rỗng < 8MB, abort/segfault/uncaught exception khi là PID 1 vẫn ra RE. Smoke test fail trên code cũ (`timeMs=1`) và pass trên code mới. Staging báo đúng 2MB và 1,2s.

### 3.3 Seccomp được cấu hình nhưng chưa bao giờ được áp dụng
- **Bối cảnh:** engine parse `seccomp.toml` khi khởi động, nhưng pipeline chạy bài không dùng đến nó. Code học sinh chỉ được bảo vệ bởi namespace và việc bỏ capability.
- **Ràng buộc:** không thể nạp filter bằng `pre_exec`, vì tiến trình con là GNU time rồi tới bwrap, mà bwrap cần `mount`/`pivot_root`.
- **Sửa:** biên dịch profile thành BPF lúc khởi động, rồi truyền cho `bwrap --seccomp FD` qua một memfd. Memfd giữ cờ close-on-exec ở tiến trình cha, chỉ bỏ cờ trong tiến trình con sau `fork`, nên không lọt sang job khác đang chạy song song (nếu lọt, job khác có thể ghi đè filter). Engine dừng khởi động nếu thiếu profile.
- **Kết quả:** `socket`, `unshare`, `keyctl` bị kill (SIGSYS, verdict RE); C++ có thread và Python vẫn chạy bình thường. Staging 7/7, gồm ca `SECCOMP`.

### 3.4 Giảm đặc quyền container
- **Worker** giữ service-role key nhưng không chạy code, vậy mà trước đây có `SYS_ADMIN` + unconfined. Nay: `cap_drop: ALL`, `no-new-privileges`, root FS chỉ đọc. Đã xác minh `CapEff 0`.
- **Engine** chỉ còn trong network nội bộ (`internal: true`), không ra được Internet. Tắt REST service vốn chạy code không cần xác thực.
- **Một thử nghiệm thất bại, được ghi lại:** bỏ `seccomp=unconfined` ở engine thì profile mặc định của Docker chặn `pivot_root`, bwrap hỏng, mọi bài ra COMPILE_ERROR. Đã khôi phục ngay và truy vấn để chứng minh không có bài nộp thật nào bị ảnh hưởng. Bài học: thay đổi hạ tầng phải có bước kiểm chứng và rollback ngay sau deploy.

### 3.5 Phân quyền đề/testcase theo người tạo
- **Bối cảnh:** mọi giáo viên đều đọc được testcase ẩn và lời giải tham khảo của mọi đề, sửa hoặc xoá được đề của người khác, kể cả đề trong contest của giáo viên khác. Ngoài ra có một lỗ khác: gắn đề riêng của người khác vào contest của mình, rồi đọc đề đó với tư cách thí sinh.
- **Sửa:** thêm `can_manage_problem(id)` (có `problems.manage` và là người tạo đề, hoặc là admin), áp vào RLS testcase, lời giải, kiểm định, `save_problem_bundle`, `delete_problem`, `can_read_problem`. Chỉ gắn được đề công khai hoặc đề của mình vào contest/lớp. Đề cũ không có người tạo chỉ admin quản lý; không tự gán chủ.
- **Kết quả:** thêm `supabase/tests/problem-ownership.sql`. Migration được thử trên **schema bản cũ** rồi chạy toàn bộ test, đúng như tình huống staging. Thêm 2 test e2e cho danh sách đề theo chủ.

### 3.6 Ghi đề/testcase phải qua đúng một đường
- **Bối cảnh:** giáo viên có thể bỏ qua `save_problem_bundle` bằng REST trực tiếp: đặt time limit tuỳ ý (gây kẹt hàng đợi chấm) hoặc sửa testcase trong khi bài đang chấm.
- **Sửa:** CHECK `NOT VALID` (10–30000ms, 16–1024MB, không kiểm tra lại dữ liệu cũ); `REVOKE` quyền ghi trực tiếp lên `testcases`/`problems`; xoá 5 hàm web không còn ai gọi.

### 3.7 Hiệu năng chấm (đợt 12/11)
| Chỉ số (10 tài khoản, 50 bài) | Trước | Sau |
|---|---|---|
| p50 thời gian chờ | 10,19s | 2,35s |
| p95 hoàn tất | 23,67s | 4,33s |
| Throughput | 0,71 bài/s | 2,68 bài/s |
| `cases.loadMs` p95 (testcase Storage) | 6,43s | 2,56s |

- **Cách làm:** đo trước khi tối ưu (script tổng hợp timing từ log worker); tải testcase song song có ngân sách (semaphore toàn cục 8 lượt tải Storage); `WORKER_CONCURRENCY` có giới hạn nhưng giữ nguyên claim nguyên tử; retry một lần cho lỗi mạng ở đường *đọc* (không retry thao tác ghi khi chưa rõ kết quả).
- **Đã hoãn có lý do:** cache bundle testcase. Chưa có tín hiệu version đáng tin cậy cho blob Storage, nên cache có nguy cơ trả verdict sai.
- **Hàng đợi trong RAM tối đa 20 bài:** phần dư vẫn `PENDING` trong DB và được poll lại theo `created_at`, nên không mất bài và vẫn FIFO.

### 3.8 Ổn định bộ test
- Lỗi IPC của trình chạy `node --test` khi máy tải nặng ("Unable to deserialize cloned data"). Tái hiện bằng cách tạo tải CPU giả, chuyển sang chạy test trong một tiến trình; kiểm tra trên cả Node 22 (bản CI dùng) và Node 24.
- `cargo test` ở thư mục gốc chỉ chạy 2/40 test. Sửa tài liệu thành `cargo test --workspace`.
- Bỏ heuristic đổi chuỗi `\n` theo nghĩa đen thành xuống dòng (làm hỏng bài xử lý chuỗi). Trước khi xoá, quét staging: 0/40 testcase cần đến nó.

### 3.9 Frontend: hệ màu và component dùng chung
- **Lỗi ẩn phát hiện khi rà soát:** hơn 60 class kiểu `bg-[var(--accent)]/10` không sinh ra CSS nào, vì Tailwind v3 không áp được opacity lên `var()` và bỏ qua class đó mà không báo lỗi. Badge AC, nút, nền nhấn hiện ra không có nền, viền xám mặc định. Đã xác minh bằng cách grep CSS sau khi build.
- **Sửa tận gốc:** token có thêm phiên bản kênh RGB (`--accent-rgb: 31 136 61`), Tailwind dùng `rgb(var(--accent-rgb) / <alpha-value>)`. Vậy là `bg-accent/10` chạy đúng và tự đổi theo light/dark. Xoá bảng màu cũ trong Tailwind config (cyan/xanh dương/glow) vốn không ai dùng và mâu thuẫn với token.
- **Một màu nhấn:** chuyển khoảng 200 class màu viết cứng (red/emerald/amber/purple/orange/blue, hex trùng token) sang token bằng script có quy tắc, rồi rà diff tay. Màu `warning`/`danger` chỉ còn cho cảnh báo thật và badge độ khó/verdict.
- **Gộp code trùng:** badge verdict bị viết 3 lần (mỗi nơi một màu/nhãn) → `VerdictBadge`. Danh sách trạng thái contest lặp 4 lần với nhãn lệch nhau → `contestStatus.ts`.
- **Sửa lỗi:** bài `SYSTEM_ERROR` từng hiện mãi "đang chờ" kèm spinner.
- **Ngăn tái phát:** bật `noUnusedLocals` để build chặn code chết.
- **Kiểm chứng:** build, 70 test e2e, chụp màn hình light/dark các trang chính.

### 3.10 Tính năng: lộ trình luyện tập (chủ đề có thứ tự)
- **Vấn đề:** "Luyện theo chủ đề" chỉ gom bài theo tag và xếp theo bảng chữ cái, không có thứ tự học hay mô tả.
- **Thiết kế:** hai bảng `learning_tracks` và `learning_track_problems`. Quyền theo người tạo, giống contest và đề (`can_manage_track`). Ghi chỉ qua một RPC atomic `save_learning_track`, và chỉ gắn được đề công khai hoặc đề của mình. Đề riêng tư vẫn ẩn với học sinh dù nằm trong lộ trình công khai.
- **Giao diện:** thẻ lộ trình có thanh tiến độ và gợi ý "bài tiếp theo"; trang `/learn/:slug`; tab soạn lộ trình cho giáo viên. Tách `OrderedProblemPicker` từ editor contest để dùng lại (editor contest từ 98 xuống 55 dòng).

### 3.11 Tính năng: phần thưởng contest (khung avatar, nền hồ sơ)
- **Ý tưởng:** contest như một trò chơi thi đấu có phần thưởng. Bộ sưu tập gồm 4 bậc (Vàng/Bạc/Đồng/Tham gia) × 2 loại (khung/nền), vẽ bằng CSS nên không cần upload ảnh và không thêm bề mặt tấn công.
- **Luật trao giải (`award_contest_rewards`):**
  - chỉ người tạo contest hoặc admin; chỉ sau khi contest kết thúc và không còn bài đang chấm;
  - tính bảng xếp hạng cuối cùng, không áp dụng freeze;
  - mỗi loại chỉ nhận bậc cao nhất đạt được (Vàng ≤1 + Bạc ≤3 nghĩa là hạng 2–3 nhận Bạc, hạng 1 không nhận thêm Bạc);
  - giải theo hạng cần kết quả lớn hơn 0, để hai người cùng 0 điểm không nhận Vàng;
  - giáo viên/admin không nhận giải; trao lại không trùng; có ghi audit.
- **Trang bị (`equip_reward`):** kiểm tra người dùng sở hữu phần thưởng và đúng loại. Khung và nền hiển thị công khai qua `profiles_public`.
- **Bẫy đã tránh:** `schema.sql` được chạy lại toàn bộ, nên view có thêm cột phải được định nghĩa ngay tại chỗ định nghĩa cũ. Nếu đặt ở cuối file, lần chạy thứ hai sẽ lỗi "cannot drop columns from view".
- **Lỗi tìm thấy nhờ chụp màn hình:** avatar hồ sơ bị méo thành hình bầu dục ở màn hình vừa (chiều cao cố định cộng chiều rộng full). Lỗi có sẵn từ trước, khung avatar làm nó lộ rõ.

### 3.12 Hoàn thiện khác
- **T4: vị trí xếp hàng.** RPC đếm bài chờ trước bài của mình, chỉ chủ bài nộp xem được. Giao diện hiện "Đang xếp hàng (vị trí N)" rồi chuyển sang "Đang chấm".
- **Accessibility:** 37 ô nhập có nhãn; modal có `role="dialog"` và đóng bằng Esc (hook dùng chung); nút chỉ có icon có tên; thẻ lớp học dùng được bằng bàn phím.
- **Test chập chờn:** test bắt `role=status` bất kỳ, và fail khi trình soạn thảo lazy hiện trạng thái tải trong lúc máy tải nặng. Tìm ra nguyên nhân rồi mới sửa test, không tăng timeout để che.
- **Tách component:**
  - `AdminProblemsTab` từ 1532 xuống 1047 dòng;
  - `TeacherClassroomsTab` từ 899 xuống 275 dòng;
  - state đi cùng phần giao diện sở hữu nó, hành vi không đổi, e2e 75/75.
- **Migration mới đều được thử theo đúng thứ tự staging:** schema bản cũ, rồi 5 migration, rồi toàn bộ test DB.

## 4. Quyết định thiết kế và đánh đổi

| Quyết định | Lý do | Đánh đổi |
|---|---|---|
| Phân quyền trong DB (RLS/RPC) thay vì API server riêng | Client gọi REST trực tiếp vẫn bị chặn; ít thành phần hơn | SQL dài, khó rà soát; `schema.sql` có nhiều định nghĩa chồng lớp |
| Một worker trên mỗi DB, claim nguyên tử | Đơn giản, không chấm trùng | Chưa scale ngang; nhiều worker cần một queue riêng |
| bwrap + seccomp + rlimit thay vì VM/gVisor | Khởi động tính bằng ms, overhead gần như không có, đo thời gian chính xác | Chung kernel với host; cần thêm cgroup theo job và máy judge riêng |
| TLE theo CPU, wall-time có biên 1,5s | Không TLE oan khi nhiều job tranh CPU | Tiến trình con mà chương trình không `wait` thì chưa được tính CPU (cần cgroup) |
| CHECK `NOT VALID`, không tự gán chủ cho đề cũ | Không phá dữ liệu cũ, không suy đoán quyền sở hữu | Admin phải tự xử lý dữ liệu cũ |
| Hoãn cache testcase | Đúng quan trọng hơn nhanh | Thời gian tải testcase vẫn tốn |

### Có nên dùng gVisor không? (câu hỏi hay gặp)
- **gVisor** chặn syscall bằng một kernel chạy ở user-space, nên một lỗ hổng kernel host không đủ để thoát ra. Đây là lớp bảo vệ mạnh nhất ở mức container.
- **Chi phí với một OJ:** code nhiều syscall (đọc input lớn, fork/exec, compile g++) chậm rõ, làm lệch time limit nên phải hiệu chỉnh lại; mỗi sandbox thêm vài trăm ms khởi động và vài chục MB RAM; số đo thời gian do kernel giả lập trả về, phải kiểm chứng lại.
- **Quyết định:** làm các bước rẻ trước (seccomp, giảm đặc quyền, chặn mạng ra ngoài, rồi cgroup và máy judge riêng). gVisor là lớp bổ sung cho container engine (`runtime: runsc`, giữ nguyên bwrap bên trong) trước khi mở công khai, *sau khi* đo độ lệch verdict và thời gian so với chạy native.

## 5. Phương pháp làm việc (nên nhấn mạnh khi phỏng vấn)
1. **Tái hiện trước khi sửa:** mỗi lỗi đều có test thực chứng minh lỗi tồn tại. Test hồi quy được chạy trên code cũ để chắc chắn nó bắt được lỗi.
2. **Thử nghiệm nhỏ trước khi chọn hướng:** ví dụ đo `wait4` có và không có `--as-pid-1` trước khi quyết định cách đo.
3. **Kiểm chứng trên môi trường thật:** script `verify-verdicts.mjs` chấm qua API thật trên staging sau mỗi lần deploy engine.
4. **Migration an toàn:** idempotent (chạy lại được), thử trên schema bản cũ, `NOT VALID` cho ràng buộc mới.
5. **Mỗi thay đổi một commit:** ghi rõ lý do và bằng chứng, rollback được từng bước.
6. **Báo cáo trung thực:** ghi cả thử nghiệm thất bại và giới hạn còn lại. Không công bố năng lực tải khi chưa có số đo.

## 6. Giới hạn hiện tại (nên chủ động nói ra)
- Chưa có cgroup theo từng job, chưa có máy judge riêng; container engine vẫn cần `SYS_ADMIN` và `seccomp=unconfined` để chạy bwrap.
- Năng lực tải chưa được chứng minh: chưa chạy campaign 5/10/20 người và soak 24h.
- `schema.sql` cần gộp lại để mỗi hàm và policy chỉ có một định nghĩa cuối cùng.
- Engine là bản fork kèm patch lớn; tốn công khi nâng cấp upstream.
- Chưa có checker riêng (SPJ), bài tương tác, giao diện subtask.

## 7. Câu hỏi có thể gặp và ý trả lời

**Làm sao đảm bảo một bài không bị chấm hai lần?**
Claim bằng `UPDATE ... WHERE id=? AND status='PENDING'` trong RPC chỉ service_role gọi được; chỉ chấm khi claim thành công. Kết quả chỉ ghi khi bài còn `JUDGING`, nên nếu bài bị rejudge giữa chừng thì không bị ghi đè. Ghi bị timeout thì đọc lại để đối chiếu, không ghi lại mù.

**Làm sao giữ testcase ẩn bí mật?**
RLS chỉ cho người quản lý đề đọc; bucket Storage private, chỉ service_role truy cập; chi tiết kết quả trả về học sinh chỉ có trạng thái, thời gian, bộ nhớ của từng test, không có input/output; engine nhận testcase qua gRPC nội bộ, không mount vào sandbox.

**Học sinh viết code độc hại thì sao?**
Các lớp: namespace riêng (mạng, PID, IPC, mount), filesystem chỉ đọc, môi trường bị xoá, bỏ capability, seccomp kill các syscall nguy hiểm, rlimit CPU/bộ nhớ/kích thước file, giới hạn output 1MB, wall-time. Engine không giữ secret và không ra được Internet. Nếu thiếu isolation thì hệ thống từ chối chạy code.

**Tại sao không retry khi ghi kết quả thất bại?**
Ghi bị timeout có thể đã commit. Retry mù có thể ghi đè trạng thái mới (ví dụ bài vừa được rejudge). Vì vậy worker đọc lại để đối chiếu, và chỉ ghi lại khi bài vẫn còn `JUDGING`.

**Đo thời gian chương trình chính xác thế nào trong sandbox?**
Chương trình là PID 1 trong sandbox, nên usage của nó đi thẳng lên GNU time ở bên ngoài qua `wait4`. Kết quả không làm giả được và không bị cộng RSS của engine. Trường hợp chưa xử lý được là tiến trình con mà chương trình không `wait`: chúng bị wall-time chặn, còn đo trọn cả cây process thì cần cgroup.

**Scale lên nhiều người dùng thế nào?**
Trước hết đo để tìm nút thắt (đã làm: thời gian chờ chiếm phần lớn → concurrency có giới hạn, tải testcase song song). Bước tiếp theo: concurrency không vượt số CPU của engine; muốn có nhiều worker trên một DB thì cần queue riêng (PG LISTEN/NOTIFY hoặc Redis). Nghiệm thu bằng campaign tải và soak 24h trước khi công bố năng lực tải.
