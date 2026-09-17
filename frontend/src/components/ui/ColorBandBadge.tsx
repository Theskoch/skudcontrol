import type { ColorBand } from "../../lib/types";

const STYLES: Record<ColorBand, { bg: string; text: string; label: string; icon: string }> = {
  green: { bg: "bg-status-good/15", text: "text-status-good", label: "Норма", icon: "●" },
  yellow: { bg: "bg-status-warning/15", text: "text-status-warning", label: "Мало", icon: "▲" },
  red: { bg: "bg-status-critical/15", text: "text-status-critical", label: "Критично", icon: "■" },
  none: { bg: "bg-surface-raised", text: "text-ink-muted", label: "Нет данных", icon: "○" },
};

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}ч ${String(m).padStart(2, "0")}м`;
}

export function ColorBandBadge({ colorBand, minutes }: { colorBand: ColorBand; minutes: number }) {
  const s = STYLES[colorBand];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium tabular-nums ${s.bg} ${s.text}`}
    >
      <span aria-hidden className="text-[10px]">
        {s.icon}
      </span>
      {colorBand === "none" ? s.label : formatMinutes(minutes)}
      {colorBand !== "none" && <span className="text-xs opacity-70">· {s.label}</span>}
    </span>
  );
}
