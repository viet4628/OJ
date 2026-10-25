-- ========================================================
-- CodeJudge VN — SEED DATA (idempotent, chạy lại an toàn)
--   5 bài tập + testcases · 1 kỳ thi · 2 thông báo
-- ========================================================

-- ---------- 1) PROBLEMS ----------
INSERT INTO public.problems (slug, title, description, time_limit_ms, memory_limit_mb, difficulty, tags, is_public, samples)
VALUES
  ('two-sum',
   '1002. Two Sum (Tổng Hai Số)',
   E'Cho mảng số nguyên `nums` và một số nguyên `target`. Hãy tìm chỉ số của hai số trong mảng sao cho tổng của chúng bằng `target`.\n\n**Dữ liệu**: Dòng 1 là kích thước mảng `n`, dòng 2 gồm `n` số nguyên, dòng 3 là `target`.\n**Kết quả**: In ra 2 chỉ số `i j` (tách bởi dấu cách).\n\n**Ràng buộc**: 2 ≤ n ≤ 10^5, |nums[i]| ≤ 10^9.',
   1000, 256, 'Easy', ARRAY['two-pointer','mảng'], true,
   E'[{"input": "4\\n2 7 11 15\\n9", "output": "0 1"}, {"input": "3\\n3 2 4\\n6", "output": "1 2"}]'),
  ('valid-palindrome',
     '1003. Valid Palindrome (Chuỗi Đối Xứng)',
     E'Cho chuỗi `s`, kiểm tra xem nó có phải là chuỗi đối xứng hay không, bỏ qua chữ in hoa/thường và ký tự không phải chữ số + chữ cái.\n\n**Dữ liệu**: 1 dòng duy nhất chứa chuỗi `s` (|s| ≤ 10^5).\n**Kết quả**: `YES` nếu đối xứng, ngược lại `NO`.',
     750, 256, 'Medium', '{chuỗi,two-pointer}', true,
     '[{"input": "race a car", "output": "NO"}, {"input": "A man, a plan, a canal: Panama", "output": "YES"}]'),
  ('sum-of-digits',
     '1004. Tổng Chữ Số (Sum of Digits)',
     E'Cho số nguyên không âm `n`. Tính tổng các chữ số của `n`.\n\n**Ràng buộc**: 0 ≤ n ≤ 10^18.',
     1000, 100, 'Easy', '{số học}', true,
     '[{"input": "0", "output": "0"}, {"input": "12345", "output": "15"}]'),
  ('prime-count',
     '1005. Đếm Số Nguyên Tố',
     E'Cho hai số nguyên `L` và `R` (L ≤ R). Đếm số lượng số nguyên tố trong đoạn `[L, R]` (bao gồm cả hai đầu mút).\n\n**Ràng buộc**: 1 ≤ L ≤ R ≤ 10^6.',
     1000, 256, 'Medium', '{sàng,số học}', true,
     '[{"input": "1 10", "output": "4"}]'),
  ('max-subarray',
     '1006. Dãy Con Liên Tiếp Tổng Lớn Nhất',
     E'Cho dãy gồm `n` số nguyên (có thể âm). Tìm dãy con liền kề (khác rỗng) có tổng lớn nhất và in ra tổng đó.\n\n**Ràng buộc**: 1 ≤ n ≤ 10^5, |aᵢ| ≤ 10^9.\n\n**Gợi ý**: thuật toán Kadane độ phức tạp O(n).',
     5000, 128, 'Easy', '{dp}', true,
     E'[{"input": "9\\n-2 1 -3 4 -1 2 1 -5 4", "output": "6"}]')
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      description = EXCLUDED.description,
      time_limit_ms = EXCLUDED.time_limit_ms,
      memory_limit_mb = EXCLUDED.memory_limit_mb,
      difficulty = EXCLUDED.difficulty,
      tags = EXCLUDED.tags,
samples = EXCLUDED.samples;

-- ---------- 2) TESTCASES (xóa bộ cũ của seed, tạo lại để chạy lại không trùng) ----------
DELETE FROM public.testcases
WHERE problem_id IN (SELECT id FROM public.problems WHERE slug IN
  ('two-sum','valid-palindrome','sum-of-digits','prime-count','max-subarray'));

-- two-sum: 2 sample + 3 ẩn (chỉ số 0-BASED, khớp samples hiển thị trên web)
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 5, true,  E'4\n2 7 11 15\n9', '0 1' FROM public.problems WHERE slug = 'two-sum';
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 5, true,  E'3\n3 2 4\n6',     '1 2' FROM public.problems WHERE slug = 'two-sum';
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 30, false, E'3\n1 3 5\n8', '1 2' FROM public.problems WHERE slug = 'two-sum';
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 30, false, E'2\n-10 0\n-10', '0 1' FROM public.problems WHERE slug = 'two-sum';
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 30, false, E'5\n1 2 3 4 5\n9', '3 4' FROM public.problems WHERE slug = 'two-sum';

-- valid-palindrome: 2 mẫu + 2 ẩn
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 20, true,  'race a car', 'NO'  FROM public.problems WHERE slug = 'valid-palindrome';
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 20, true,  'A man, a plan, a canal: Panama', 'YES' FROM public.problems WHERE slug = 'valid-palindrome';
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 20, false, 'was it a car or a cat i saw', 'YES' FROM public.problems WHERE slug = 'valid-palindrome';
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 20, false, '0P!!0', 'YES'       FROM public.problems WHERE slug = 'valid-palindrome';
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 20, false, 'abcxyz', 'NO'       FROM public.problems WHERE slug = 'valid-palindrome';

-- sum-of-digits: 2 mẫu + 3 ẩn
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 20, true,  '0',     '0'     FROM public.problems WHERE slug = 'sum-of-digits';
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 20, true,  '12345', '15'    FROM public.problems WHERE slug = 'sum-of-digits';
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 20, false, '999999999999999999', '162' FROM public.problems WHERE slug = 'sum-of-digits';
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 20, false, '1000000000000000000', '1'  FROM public.problems WHERE slug = 'sum-of-digits';
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 20, false, '208', '10'  FROM public.problems WHERE slug = 'sum-of-digits';

-- prime-count: 1 mẫu + 3 ẩn
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 25, true,  '1 10', '4'     FROM public.problems WHERE slug = 'prime-count';
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 25, false, '11 11', '1'    FROM public.problems WHERE slug = 'prime-count';
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 25, false, '1 1000000', '78498' FROM public.problems WHERE slug = 'prime-count';
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 25, false, '999990 1000000', '1' FROM public.problems WHERE slug = 'prime-count';

-- max-subarray: 1 mẫu + 3 ẩn
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 25, true,  E'9\n-2 1 -3 4 -1 2 1 -5 4',  '6'  FROM public.problems WHERE slug = 'max-subarray';
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 25, false, E'1\n-5',  '-5' FROM public.problems WHERE slug = 'max-subarray';
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 25, false, E'4\n-2 -3 -1 -4', '-1' FROM public.problems WHERE slug = 'max-subarray';
INSERT INTO public.testcases (problem_id, input_path, output_path, score, is_sample, input_content, output_content)
SELECT id, 'inline', 'inline', 25, false, E'5\n2 -1 2 3 -10', '6' FROM public.problems WHERE slug = 'max-subarray';

-- ---------- 3) CONTEST ----------
DELETE FROM public.contests WHERE title = 'CodeJudge Weekly Sprint #1';
INSERT INTO public.contests (title, description, rule_type, status, start_time, end_time, is_public)
VALUES ('CodeJudge Weekly Sprint #1',
        'Kỳ thi tuần đầu tiên — 5 bài khởi động cho người mới làm quen thuật toán.',
        'ACM', 'NOT_STARTED',
        NOW() + INTERVAL '1 day', NOW() + INTERVAL '8 days', true);

-- ---------- 3b) CONTEST PROBLEMS ----------
DELETE FROM public.contest_problems
WHERE contest_id = (SELECT id FROM public.contests WHERE title = 'CodeJudge Weekly Sprint #1');

INSERT INTO public.contest_problems (contest_id, problem_id, sort_order)
SELECT c.id, p.id, s.ord
FROM public.contests c
JOIN (VALUES
  (0, 'two-sum'),
  (1, 'valid-palindrome'),
  (2, 'sum-of-digits'),
  (3, 'prime-count'),
  (4, 'max-subarray')
) AS s(ord, slug) ON true
JOIN public.problems p ON p.slug = s.slug
WHERE c.title = 'CodeJudge Weekly Sprint #1';

-- ---------- 4) ANNOUNCEMENTS ----------
DELETE FROM public.announcements WHERE title IN ('Chào mừng đến với CodeJudge VN', 'Bảo trì hệ thống định kỳ');
INSERT INTO public.announcements (tag, title, content, author, is_public)
VALUES
  ('HỆ THỐNG', 'Chào mừng đến với CodeJudge VN',
   'Nền tảng luyện tập lập trình và chấm bài tự động chính thức mở cửa! Tạo tài khoản, vào Kỳ thi tuần và thử sức với 5 bài đơn giản.',
   'Admin', true),
  ('THÔNG BÁO', 'Bảo trì hệ thống định kỳ',
   'Hệ thống sẽ bảo trì hàng tuần lúc 02:00 sáng Chủ Nhật. Các bài nộp đang chấm sẽ được tiếp tục tự động sau khi kết thúc.',
   'Admin', false);

-- ---------- 5) Tổng kết ----------
SELECT 'problems' AS table_name, COUNT(*) AS rows FROM public.problems
UNION ALL SELECT 'testcases', COUNT(*) FROM public.testcases
UNION ALL SELECT 'contests', COUNT(*) FROM public.contests
UNION ALL SELECT 'announcements', COUNT(*) FROM public.announcements;