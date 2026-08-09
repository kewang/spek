import type { ReactNode } from "react";

/**
 * The app's unit for "one number worth noticing" — a large accent numeral over a quiet label.
 * Extracted from Dashboard so the schema pages present their counts at the same density rather
 * than inventing a second, denser style for the same job.
 */
export function StatCard({
  label,
  value,
  delay = 0,
}: {
  label: ReactNode;
  value: string | number;
  delay?: number;
}) {
  return (
    <div
      className="bg-bg-secondary border border-border rounded p-4 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="text-4xl font-bold text-accent">{value}</div>
      <div className="text-text-secondary text-sm">{label}</div>
    </div>
  );
}
