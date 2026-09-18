import type { ColorBand, RangeKey } from "../../lib/types";

const STYLES: Record<ColorBand, { text: string; ring: string; label: string }> = {
  green: { text: "text-status-good", ring: "ring-status-good/30", label: "Отличная посещаемость" },
  yellow: { text: "text-status-warning", ring: "ring-status-warning/30", label: "Ниже нормы" },
  red: { text: "text-status-critical", ring: "ring-status-critical/30", label: "Критично мало времени" },
  none: { text: "text-ink-muted", ring: "ring-line-hairline", label: "Нет данных за период" },
};

// Today/yesterday show that single day's real measured time; longer ranges
// show the average across every day in the range that actually has data.
const RANGE_TEXT: Record<RangeKey, { title: string; caption: string }> = {
  today: { title: "Время на месте", caption: "сегодня" },
  yesterday: { title: "Время на месте", caption: "вчера" },
  week: { title: "Среднее время на месте", caption: "среднее за неделю" },
  month: { title: "Среднее время на месте", caption: "среднее за месяц" },
  year: { title: "Среднее время на месте", caption: "среднее за год" },
  all: { title: "Среднее время на месте", caption: "среднее за всё время" },
};

export function HeroScore({
  minutes,
  colorBand,
  range,
}: {
  minutes: number;
  colorBand: ColorBand;
  range: RangeKey;
}) {
  const s = STYLES[colorBand];
  const { title, caption } = RANGE_TEXT[range];
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return (
    <div className={`rounded-2xl border border-line-hairline bg-surface p-6 text-center ring-1 ${s.ring}`}>
      <div className="text-xs uppercase tracking-wide text-ink-muted">{title}</div>
      {colorBand === "none" ? (
        <div className="mt-2 text-6xl font-bold tabular-nums text-ink-muted">—</div>
      ) : (
        <div className={`mt-2 text-6xl font-bold tabular-nums ${s.text}`}>
          {h}
          <span className="text-3xl">ч</span> {String(m).padStart(2, "0")}
          <span className="text-3xl">м</span>
        </div>
      )}
      <div className={`mt-2 text-sm font-medium ${s.text}`}>{s.label}</div>
      <div className="mt-1 text-xs text-ink-muted">{caption}</div>
    </div>
  );
}
