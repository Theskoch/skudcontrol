import type { RangeKey } from "../../lib/types";

const OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Сегодня" },
  { key: "yesterday", label: "Вчера" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "all", label: "Всё время" },
];

export function RangeTabs({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-line-hairline bg-surface p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            value === opt.key
              ? "bg-accent-violet text-white"
              : "text-ink-secondary hover:text-ink-primary"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
