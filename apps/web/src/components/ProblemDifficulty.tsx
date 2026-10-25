const styles = {
  Easy: 'bg-[var(--accent-light)] text-[var(--accent-text)]',
  Medium: 'bg-[#9A6700]/10 text-[#9A6700] dark:bg-[#D29922]/10 dark:text-[#D29922]',
  Hard: 'bg-[#CF222E]/10 text-[#CF222E] dark:bg-[#F85149]/10 dark:text-[#F85149]',
};

export const difficultyLabels = { Easy: 'Dễ', Medium: 'Trung bình', Hard: 'Khó' };

export default function ProblemDifficulty({ difficulty }: { difficulty: keyof typeof styles }) {
  return (
    <span className={`inline-flex min-w-20 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium leading-4 ${styles[difficulty]}`}>
      {difficultyLabels[difficulty]}
    </span>
  );
}
