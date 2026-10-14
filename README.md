# CodeJudge VN — Online Judge System

Hệ thống chấm code tự động: **React + Vite** frontend, **Supabase** (DB + Auth + Realtime + RLS), **judge worker** (TypeScript) và **rsjudge engine** (Rust sandbox server) làm judging core theo đúng luồng chuẩn SASTOJ: worker gửi `Submit` qua gRPC → engine tự kéo testcase archive từ worker (`CasesService`, tarball zstd) → compile/run dưới rlimits → stream kết quả từng testcase về DB. Frontend tham chiếu UX/UI từ [QingdaoU OnlineJudgeFE](references/OnlineJudgeFE).

---

## 🏗️ Cấu trúc dự án

```text
online-judge/
├── apps/
│   ├── web/               # Frontend user (Vite + React + Tailwind v3), build 2 entry: index.html + admin.html
│   └── judge-worker/      # Daemon điều phối (TypeScript): realtime + polling, claim chống trùng,
│                          # cases-provider gRPC phục vụ testcase cho engine, client Submit/SelfTest
├── engine/
│   └── rsjudge/           # rsjudge — judging core (Rust): gRPC JudgeService (Submit/SelfTest streaming),
│                          # REST (/languages, /selftest), pipeline compile/run trên rsjudge-runner
│                          # (RLIMIT_CPU/AS/FSIZE, wall-time deadline, rusage)
├── references/
│   └── OnlineJudgeFE/     # Mẫu UX/UI (QDU)
└── supabase/
    ├── schema.sql         # Schema + trigger + RLS (idempotent, 2 lần chạy thoải mái)
    └── seed.sql           # 5 bài + testcase (score 100/bài) + contest + announcement (idempotent)
```

### Luồng chấm (engine mode)

```text
Submit (web) → Supabase PENDING → worker claim → gRPC Submit(engine)
  engine: compile (executors.toml) → FetchCases(worker :50052, tarball zstd)
        → run từng case (rlimits + wall deadline) → compare → stream CaseInfo/CasesSummary
worker ← kết quả stream → update submissions (status/score/time/memory/details)
```

Fallback: không đặt `RSJUDGE_ENDPOINT` → worker tự compile/run qua sandbox local
(bwrap namespaces + `/usr/bin/time` + `timeout`).

---

## 🚀 Khởi chạy (dev, chạy lần đầu)

### 1. Supabase Database

1. Tạo project trên [Supabase.com](https://supabase.com).
2. **SQL Editor** → dán toàn bộ `supabase/schema.sql` → **Run** (chạy được nhiều lần).
3. **SQL Editor** → dán toàn bộ `supabase/seed.sql` → **Run** (dữ liệu mẫu).
4. (Tuỳ chọn) **Storage** → tạo bucket `testcases` mode **Private** — worker cũng đọc được testcase inline trong DB nên bước này chỉ cần khi testcase lưu file.
5. (Để submit) tạo user qua giao diện đăng ký; nâng quyền bằng cách chạy trong SQL Editor:
   ```sql
   update public.profiles set role = 'teacher' where email = 'ban@example.com';
   ```

### 2. Frontend (`apps/web`)

```bash
cd apps/web
cp .env.example .env.local   # điền SUPABASE_URL + ANON_KEY
npm install
npm run dev                  # http://localhost:3000
```

Admin console: `npm run dev` rồi vào **http://admin.localhost:3000**
(thêm dòng `127.0.0.1 admin.localhost` vào `/etc/hosts` nếu cần; vite middleware route theo `Host: admin.*`).

Các biến trong `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_ADMIN_SUBDOMAIN=admin   # optional
```

### 3. Judge Worker (`apps/judge-worker`)

```bash
cd apps/judge-worker
cp .env.example .env         # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run build
npm start                    # daemon: realtime + poll PENDING mỗi 2s
```

Điều kiện máy chạy worker: `g++`, `python3`, `rustc`, `/usr/bin/time`, `timeout` (coreutils), khuyến nghị `bubblewrap` + `tar` + `zstd`. (Java tạm gỡ khỏi hệ thống — re-enable theo git history.)

Engine mode (khuyến nghị): build engine trước rồi đặt biến môi trường cho worker:

```bash
# 1. Build engine (cần protoc ≥3.15 + buf trong PATH)
cd engine/rsjudge && cargo build --bin rsjudge

# 2. Chạy engine với config mẫu
rsjudge --config-dir apps/judge-worker/engine-config \
        --cases-endpoint http://127.0.0.1:50052

# 3. Worker nối vào engine
echo 'RSJUDGE_ENDPOINT=127.0.0.1:50051' >> .env
npm start
```

Smoke test hai lớp:

```bash
cd apps/judge-worker
npm run smoke          # sandbox local: 7 case AC/TLE/env-clear/net-block
node scripts/smoke-engine.mjs   # engine mode qua REST /selftest: 5 case
```

Worker cần **service role key** (không phải anon) vì nó đọc problem/testcase và ghi kết quả qua RLS.

Docker: compose dựng 2 service từ cùng image multi-stage — `worker` (Node + compilers + bwrap) và `engine` (binary Rust). Xem `docker-compose.yml`.

---

## 🔄 Luồng chấm (P0 verified)

1. User submit → insert `submissions` (status `PENDING`).
2. Worker nhận qua **realtime channel** (fallback: poll PENDING mỗi 2s).
3. `claim` nguyên tử (cập nhật `status='JUDGING'` chỉ khi còn `PENDING`, đọc lại row vừa cập nhật) → an toàn khi nhiều worker cùng fetch.
4. Lấy problem + testcase (inline `input_content`/`output_content` hoặc file bucket `testcases`).
5. Compile (g++/rustc/javac) nếu cần → chạy từng testcase trong sandbox: `/usr/bin/time -v` đo CPU time & memory thật, `timeout -s KILL` chặn TLE, cap output 1MB.
6. So sánh output (chuẩn hoá khoảng trắng) → update `status`, `time_used_ms`, `memory_used_mb`, `score`, `details` (từng testcase).

Trạng thái: `PENDING` → `JUDGING` → `ACCEPTED` / `WRONG_ANSWER` / `TIME_LIMIT_EXCEEDED` / `MEMORY_LIMIT_EXCEEDED` / `COMPILE_ERROR` / `RUNTIME_ERROR` / `SYSTEM_ERROR`.

---

## 🛡️ Ghi chú an toàn & vận hành

- **Sandbox hiện tại**: giới hạn thời gian/memory/bộ nhớ output + **bubblewrap namespaces** (nếu có bwrap: `--unshare-all`, fs read-only, env sạch; Docker worker cần `security_opt: seccomp=unconfined` vì seccomp mặc định chặn `unshare`). Chạy smoke: `npm run smoke`. `rsjudge` (Rust, cgroups+seccomp) vẫn là hướng production — build Docker trong `engine/rsjudge` (hiện service layer còn stub upstream). Code không tin cậy phải chạy trong container/VM tách khỏi web.
- **Mỗi DB chỉ chạy 1 worker** (claim theo status giúp an toàn, nhưng không bảo mật khi 2 máy fetch cùng lúc; scale hợp lệ sau).
- **Testcase hidden phải bảo mật**: policy RLS chặn user đọc testcase, chỉ admin/teacher (`testcases.manage`); đừng để anon đọc `input_content`/`output_content`.
- Realtime channel chỉ sự kiện `INSERT` submissions: nếu muốn standalone mà không cần publication, mặc định đã có polling fallback.

---

## 📄 Tài liệu kế hoạch

`plan.md` — trạng thái, bản đồ module so với `references/OnlineJudgeFE`, lộ trình, checklist Go-live.