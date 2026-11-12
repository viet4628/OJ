const styles = {
  Easy: 'bg-[var(--accent-light)] text-[var(--accent-text)]',
  Medium: 'bg-warning/10 text-warning',
  Hard: 'bg-danger/10 text-danger',
};

export const difficultyLabels = { Easy: 'Dễ', Medium: 'Trung bình', Hard: 'Khó' };

export default function ProblemDifficulty({ difficulty }: { difficulty: keyof typeof styles }) {
  return (
    <span className={`inline-flex min-w-20 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium leading-4 ${styles[difficulty]}`}>
      {difficultyLabels[difficulty]}
    </span>
  );
}
