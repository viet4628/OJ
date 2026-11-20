const styles = {
  Easy: 'bg-[var(--accent-light)] text-[var(--accent-text)] border border-accent/25',
  Medium: 'bg-warning/10 text-warning border border-warning/25',
  Hard: 'bg-danger/10 text-danger border border-danger/25',
};

export const difficultyLabels = { Easy: 'Dễ', Medium: 'Trung bình', Hard: 'Khó' };

export default function ProblemDifficulty({ difficulty }: { difficulty: keyof typeof styles }) {
  return (
    <span className={`inline-flex min-w-18 shrink-0 items-center justify-center whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-semibold leading-4 ${styles[difficulty]}`}>
      {difficultyLabels[difficulty]}
    </span>
  );
}
