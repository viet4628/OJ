import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, ChevronRight, ChevronLeft, CheckCircle2, Sparkles, HelpCircle } from 'lucide-react';

interface Step {
  stepIndex: number;
  iIndex: number;
  jIndex: number;
  currentSum: number;
  target: number;
  isMatch: boolean;
  explanation: string;
}

const VISUAL_STEPS: Step[] = [
  {
    stepIndex: 0,
    iIndex: 0,
    jIndex: 1,
    currentSum: 9,
    target: 9,
    isMatch: true,
    explanation: 'Bước 1: So sánh phần tử nums[0] = 2 và nums[1] = 7. Tổng 2 + 7 = 9 (Khớp chính xác với Target)!',
  },
  {
    stepIndex: 1,
    iIndex: 0,
    jIndex: 2,
    currentSum: 13,
    target: 9,
    isMatch: false,
    explanation: 'Bước 2 (Ví dụ minh họa khác): nums[0] = 2 và nums[2] = 11. Tổng 2 + 11 = 13 (Không khớp).',
  },
  {
    stepIndex: 2,
    iIndex: 1,
    jIndex: 2,
    currentSum: 18,
    target: 9,
    isMatch: false,
    explanation: 'Bước 3: nums[1] = 7 và nums[2] = 11. Tổng 7 + 11 = 18 (Không khớp).',
  },
  {
    stepIndex: 3,
    iIndex: 1,
    jIndex: 3,
    currentSum: 22,
    target: 9,
    isMatch: false,
    explanation: 'Bước 4: nums[1] = 7 và nums[3] = 15. Tổng 7 + 15 = 22 (Không khớp).',
  },
];

const NUMS = [2, 7, 11, 15];
const TARGET = 9;

export default function AlgorithmVisualizer() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(1200);

  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= VISUAL_STEPS.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, speedMs);
    }
    return () => clearInterval(timer);
  }, [isPlaying, speedMs]);

  const stepData = VISUAL_STEPS[currentStep];

  return (
    <div className="space-y-4 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" /> Trực Quan Hoá Thuật Toán Tương Tác
          </h3>
          <p className="text-[var(--text-secondary)] text-[11px] mt-0.5">
            Mô phỏng động từng bước chạy tìm cặp số có tổng bằng Target
          </p>
        </div>

        <div className="flex items-center gap-1 bg-[var(--bg-secondary)] p-1 rounded-lg border border-[var(--border)] font-code text-[11px]">
          <span className="text-[var(--text-muted)] px-1 font-semibold">Tốc độ:</span>
          {[
            { label: '1x', ms: 1200 },
            { label: '1.5x', ms: 800 },
            { label: '2x', ms: 400 },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => setSpeedMs(s.ms)}
              className={`px-2 py-0.5 rounded font-bold transition-colors ${
                speedMs === s.ms ? 'bg-white text-[var(--accent-text)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-center gap-2 bg-[var(--bg-secondary)] p-2.5 rounded-xl border border-[var(--border)]">
        <button
          onClick={() => { setCurrentStep(0); setIsPlaying(false); }}
          className="h-9 px-3 rounded-lg bg-white border border-[var(--border)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-bold transition-colors flex items-center gap-1"
          title="Đặt lại từ đầu"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>

        <button
          onClick={() => setCurrentStep((p) => Math.max(0, p - 1))}
          disabled={currentStep === 0}
          className="h-9 px-3 rounded-lg bg-white border border-[var(--border)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-bold transition-colors disabled:opacity-40 flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" /> Bước trước
        </button>

        <button
          onClick={() => {
            if (!isPlaying && currentStep === VISUAL_STEPS.length - 1) setCurrentStep(0);
            setIsPlaying(!isPlaying);
          }}
          className={`h-9 px-4 rounded-lg font-bold transition-colors text-[var(--text-primary)] flex items-center gap-1.5 shadow-sm ${
            isPlaying ? 'bg-amber-600 hover:bg-amber-500' : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
          }`}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          {isPlaying ? 'Tạm Dừng' : 'Chạy Động'}
        </button>

        <button
          onClick={() => setCurrentStep((p) => Math.min(VISUAL_STEPS.length - 1, p + 1))}
          disabled={currentStep === VISUAL_STEPS.length - 1}
          className="h-9 px-3 rounded-lg bg-white border border-[var(--border)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-bold transition-colors disabled:opacity-40 flex items-center gap-1"
        >
          Bước sau <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Array Elements Visualization Container */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-[var(--text-secondary)]">Mảng Dữ Liệu: <code className="font-code text-[var(--text-primary)]">nums = [2, 7, 11, 15]</code></span>
          <span className="text-[var(--text-secondary)]">Target: <code className="font-code text-[var(--accent-text)] font-extrabold">{TARGET}</code></span>
        </div>

        {/* Array Cards with Pointers */}
        <div className="flex items-center justify-center gap-3 py-4">
          {NUMS.map((num, idx) => {
            const isI = stepData.iIndex === idx;
            const isJ = stepData.jIndex === idx;
            const isMatch = stepData.isMatch && (isI || isJ);

            return (
              <div key={idx} className="flex flex-col items-center gap-2">
                {/* Pointer Label */}
                <div className="h-5 text-[11px] font-bold font-code">
                  {isI && isJ ? (
                    <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">i, j</span>
                  ) : isI ? (
                    <span className="px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800">i</span>
                  ) : isJ ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">j</span>
                  ) : (
                    <span className="text-transparent">.</span>
                  )}
                </div>

                {/* Number Card */}
                <div
                  className={`
                    w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black font-code transition-all duration-300 border-2
                    ${isMatch
                      ? 'bg-emerald-600 text-white border-emerald-700 scale-110 shadow-lg ring-4 ring-emerald-200'
                      : isI || isJ
                      ? 'bg-amber-100 text-amber-900 border-amber-400 scale-105 shadow-md'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border)] opacity-70'
                    }
                  `}
                >
                  {num}
                </div>

                {/* Index Label */}
                <span className="text-[10px] font-mono text-[var(--text-muted)] font-bold">idx [{idx}]</span>
              </div>
            );
          })}
        </div>

        {/* Calculation Result Badge */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-between font-code">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-secondary)] font-bold">Phép Tính:</span>
            <span className="font-extrabold text-[var(--text-primary)] text-sm">
              nums[{stepData.iIndex}] + nums[{stepData.jIndex}] = {NUMS[stepData.iIndex]} + {NUMS[stepData.jIndex]} = {stepData.currentSum}
            </span>
          </div>

          {stepData.isMatch ? (
            <span className="px-3 py-1 rounded-lg bg-emerald-700 text-white font-bold flex items-center gap-1 text-xs shadow-sm animate-bounce">
              <CheckCircle2 className="w-4 h-4" /> KẾT QUẢ KHỚP! [0, 1]
            </span>
          ) : (
            <span className="px-3 py-1 rounded-lg bg-slate-200 text-slate-700 font-bold text-xs">
              Chưa Khớp
            </span>
          )}
        </div>
      </div>

      {/* Step Explanation Text */}
      <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 space-y-1">
        <div className="flex items-center gap-1.5 font-extrabold text-xs text-amber-800">
          <HelpCircle className="w-4 h-4" /> Thuyết Minh Thuật Toán:
        </div>
        <p className="text-xs leading-relaxed font-medium">
          {stepData.explanation}
        </p>
      </div>
    </div>
  );
}
