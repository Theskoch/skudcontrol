import type { ColorBand } from "../../lib/types";

const STYLES: Record<ColorBand, { text: string; ring: string; label: string }> = {
  green: { text: "text-status-good", ring: "ring-status-good/30", label: "Отличная посещаемость" },
  yellow: { text: "text-status-warning", ring: "ring-status-warning/30", label: "Ниже нормы" },
  red: { text: "text-status-critical", ring: "ring-status-critical/30", label: "Критично мало времени" },
  none: { text: "text-ink-muted", ring: "ring-line-hairline", label: "Нет данных за период" },
};

export function HeroScore({
  minutes,
  colorBand,
  windowDays,
}: {
  minutes: number;
  colorBand: ColorBand;
  windowDays: number;
}) {
  const s = STYLES[colorBand];
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return (
    <div className={`rounded-2xl border border-line-hairline bg-surface p-6 text-center ring-1 ${s.ring}`}>
      <div className="text-xs uppercase tracking-wide text-ink-muted">Среднее время на месте</div>
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
      <div className="mt-1 text-xs text-ink-muted">за последние {windowDays} дней</div>
    </div>
  );
}
