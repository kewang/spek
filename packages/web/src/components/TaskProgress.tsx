interface TaskProgressProps {
  completed: number;
  total: number;
}

export function TaskProgress({ completed, total }: TaskProgressProps) {
  if (total === 0) {
    return <span className="text-text-muted text-sm">No tasks</span>;
  }

  const percent = Math.round((completed / total) * 100);

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${completed === total ? "bg-green-500" : "bg-accent"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-text-secondary text-sm whitespace-nowrap">
        {completed} / {total}
      </span>
    </div>
  );
}
