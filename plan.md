# CodeJudge VN — Master Plan

> Cập nhật: 08/10/2026 — Master plan chia 7 phase theo mức độ rủi ro. Phase 1 (Engine Pipeline) ưu tiên tuyệt đối vì block tất cả phase sau.

---

## ⚡ Đánh giá rủi ro tổng thể

| Risk | Level | Phase | Impact |
|---|---|---|---|
| Rust engine gRPC pipeline chưa verified E2E | 🔴 Cao | P1 | Không thể chạy engine mode production |
| Worker không có heartbeat/monitoring | 🟡 TB | P4 | Không biết worker die lúc nào |
| Admin chưa thể ban user | 🟡 TB | P2 | Security hole — user toxic |
| Docker compose chưa smoke-pass | 🔴 Cao | P1 | Production infra không tin cậy |
| Không có rate limiting | 🟡 TB | P4 | Dễ bị spam submit |
| Realtime subscription chưa verify | 🟢 Thấp | P4 | Worker poll fallback đã có |

---

## 📋 7 Phase

> Mỗi phase độc lập deploy được. Phase sau không block phase trước.

---

### Phase 1 — Rust Engine Pipeline (🔴 Rủi ro cao nhất)

> Engine có thể build, nhưng gRPC Submit pipeline chưa bao giờ chạy E2E thật.
> **5 integration test** (`e2e_submit.rs`) đã viết nhưng fail vì sandbox chặn TCP bind.

**Mục tiêu**: Worker → Engine gRPC Submit hoạt động. Docker compose pass smoke.

| Task | File | Mô tả |
|---|---|---|
| 1.1 | `server.rs` | Refactor `run_submit`/`run_self_test` thành `pub(crate)` để test inline |
| 1.2 | `e2e_submit.rs` | Thêm test direct pipeline (gọi `run_submit` + `run_self_test` không qua TCP) |
| 1.3 | `pipeline.rs` | Thêm unit test: compile + run_on_cases + compare với C++ thật |
| 1.4 | `judge.proto` | Verify `CasesConfig` parsing từ tarball zstd đúng format |
| 1.5 | `smoke-engine.mjs` | Mở rộng smoke test: gọi gRPC Submit (hiện chỉ REST /selftest) |
| 1.6 | Docker | `docker compose up` smoke-pass |

**Verification**:
```
cargo test -p rsjudge-grpc --test e2e_submit        # direct pipeline
cargo test -p rsjudge-judger                         # pipeline units
node scripts/smoke-engine.mjs                        # REST /selftest (hiện tại)
node scripts/smoke-engine.mjs --grpc                 # gRPC Submit (mới)
docker compose up --build -d && ./smoke-all.sh
```

---

### Phase 2 — Admin: User & Contest Management (🟡 Rủi ro trung bình)

**Mục tiêu**: Admin có thể ban user, quản lý contest đầy đủ.

| Task | File | Mô tả |
|---|---|---|
| 2.1 | `schema.sql` | Thêm cột `status` (active/banned/archived) vào profiles |
| 2.2 | `schema.sql` | RPC `archive_user`, `ban_user`, `reset_user_password` |
| 2.3 | `AdminUsersTab.tsx` | UI ban/archive/reset-password |
| 2.4 | `AdminContestsTab.tsx` | Chọn problem → contest, publish/unpublish |
| 2.5 | `schema.sql` + `api.ts` | Contest registration RPC + nút "Đăng ký" |
| 2.6 | `RLS` | Chặn banned user khi login |

**Verification**: `npm --prefix apps/web run build && npm run -w e2e test -g "Admin"`

---

### Phase 3 — Admin: Import/Export + ZIP Testcase (🟡 Rủi ro trung bình)

| Task | File | Mô tả |
|---|---|---|
| 3.1 | `AdminProblemsTab.tsx` | Upload ZIP testcase → giải nén → insert |
| 3.2 | `AdminProblemsTab.tsx` | Import/Export JSON problem |
| 3.3 | `AdminProblemsTab.tsx` | Prune testcase không referenced |

**Verification**: `npm --prefix apps/web run build`

---

### Phase 4 — Worker Hardening & Monitoring (🟢 Thấp)

| Task | File | Mô tả |
|---|---|---|
| 4.1 | `worker.ts` | Configurable `WORKER_POLL_INTERVAL_MS` |
| 4.2 | `worker.ts` | Check Realtime publication khi start, tự tạo nếu thiếu |
| 4.3 | `worker.ts` | Graceful shutdown (SIGTERM drain queue) |
| 4.4 | `worker.ts` | Health endpoint HTTP `:9090/health` |
| 4.5 | `schema.sql` | `judge_servers` table (heartbeat, status, load) |
| 4.6 | `AdminOverviewTab.tsx` | JudgeServer tab thật (thay nút giả) |
| 4.7 | `worker.ts` | Rate limit N submissions/user/minute |
| 4.8 | `worker.ts` | Polling fallback verify + log warning nếu realtime miss |

**Verification**: `npm --prefix apps/judge-worker run smoke && curl localhost:9090/health`

---

### Phase 5 — User Features & UX (🟢 Thấp)

| Task | File | Mô tả |
|---|---|---|
| 5.1 | `Submissions.tsx` | Submission Details: code viewer, sidebar testcase, syntax highlight |
| 5.2 | `ProblemDetail.tsx` | Chart AC distribution (language/time) |
| 5.3 | `Submissions.tsx` | Filter status phân trang hoàn chỉnh |
| 5.4 | `ContestDetail.tsx` | Contest announcement riêng |
| 5.5 | `About.tsx` | FAQ đầy đủ |

**Verification**: `npm --prefix apps/web run build`

---

### Phase 6 — Deploy & Production Runbook (🟢 Thấp)

| Task | File | Mô tả |
|---|---|---|
| 6.1 | — | Nginx config 2 subdomain + SSL + SPA fallback |
| 6.2 | — | CI/CD: GitHub Actions build web + Docker |
| 6.3 | — | Supabase PITR backup script |
| 6.4 | — | Security audit: RLS verify, hidden testcase leak test |
| 6.5 | `plan.md` | Go-live checklist update |

**Go-live checklist**:
- [ ] Submit → ACCEPTED/WRONG_ANSWER trong < 30s
- [ ] Hidden testcase không leak (query anon)
- [ ] Forgot/reset password có hiệu lực
- [ ] Contest full flow: tạo → đăng ký → làm bài → rank ACM/OI
- [ ] Schema + seed chạy trên môi trường mới
- [ ] Backup PITR
- [ ] Rate limit auth (Supabase sẵn)

---

### Phase 7 — Teacher Workspace (🟢 Thấp, dài hạn)

| Task | Mô tả |
|---|---|
| 7.1 | TeacherPortal: classroom CRUD hoàn chỉnh |
| 7.2 | Problem gán cho lớp, student progress |
| 7.3 | Contest cho lớp riêng |
| 7.4 | Xem submission của học sinh |

---

## 🗺️ Lộ trình (Gantt)

```
Tuần 1:  ████████████████████  P1 — Engine Pipeline (CAO NHẤT)
Tuần 2:  ████████████████████  P2 — Admin Users + Contests
Tuần 3:  ████████████████████  P3 — Import/Export + ZIP
         ██████████            P4 — Worker Hardening (start)
Tuần 4:  ██████████████████��█  P4 — Monitoring + Rate Limit
         ██████████            P5 — UX improvements
Tuần 5:  ████████████████████  P6 — Deploy Runbook
Tuần 6:  ████████████████████  P7 — Teacher + Buffer
```

---

## 📊 Trạng thái module (chi tiết)

> ✅ hoàn chỉnh / 🟡 có nhưng thiếu / ❌ chưa có

| Module | Ref (QDU) | CodeJudge | Ghi chú |
|---|---|---|---|
| Admin: Login | ✅ | ✅ | AdminGate |
| Admin: Dashboard | ✅ | 🟡 | Stats tĩnh, thiếu chart |
| Admin: Users | ✅ | 🟡 | Thiếu ban/archive/reset-pw |
| Admin: Problems | ✅ | 🟡 | CRUD OK, thiếu ZIP/JSON |
| Admin: Contest | ✅ | 🟡 | CRUD cơ bản, thiếu chọn bài/publish/register |
| Admin: Announcement | ✅ | ✅ | |
| Admin: JudgeServer | ✅ | ❌ | Nút giả |
| OJ: Login/Register | ✅ | ✅ | |
| OJ: ProblemList | ✅ | 🟡 | Thiếu chart AC |
| OJ: ProblemDetail | ✅ | ✅ | Monaco OK |
| OJ: SubmissionList | ✅ | ✅ | Realtime + pagination |
| OJ: SubmissionDetails | ✅ | 🟡 | Modal đơn giản |
| OJ: Rank ACM/OI | ✅ | ✅ | |
| OJ: Contest | ✅ | 🟡 | Detail/Problem OK, thiếu đăng ký |
| Engine Rust | — | 🟡 | Architecture tốt, pipeline chưa E2E verified |
| Worker sandbox | — | ✅ | bubblewrap + time/timeout verified |
| Worker engine mode | — | 🟡 | Code path có, chưa E2E verified |
| DB/Rls | — | ✅ | Schema idempotent, RLS chặt |
| E2E/Playwright | — | 🟡 | Tồn tại, cần mở rộng |
| Deploy/DevOps | — | 🟡 | Docker OK, thiếu runbook |

---

## 🧠 Kiến trúc production

```
codejudge.vn ─── nginx ─── index.html (SPA React)
admin.codejudge.vn ─ nginx ─── admin.html (SPA React)
                              │
                              └── supabase (DB + Auth + RLS + Realtime + Storage)
                                   ▲
                                   │ gRPC :50051
worker ─── rsjudge (Rust sandbox)
         └── bwrap fallback (local)
```
