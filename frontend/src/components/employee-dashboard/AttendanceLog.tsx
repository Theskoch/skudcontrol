import type { NetworkTimelineDay, TimelineDay } from "../../lib/types";
import { formatDayKey, formatTime } from "../../lib/time";
import { SKUD_HEX, WIFI_HEX } from "../timeline-chart/seriesColors";

type LogEntry = {
  at: string;
  dayKey: string;
  source: "SKUD" | "WIFI";
  type: "IN" | "OUT";
};

function buildEntries(timeline: TimelineDay[], networkTimeline: NetworkTimelineDay[]): LogEntry[] {
  const entries: LogEntry[] = [];

  for (const day of timeline) {
    for (const session of day.sessions) {
      if (session.checkIn) entries.push({ at: session.checkIn, dayKey: day.dayKey, source: "SKUD", type: "IN" });
      if (session.checkOut) entries.push({ at: session.checkOut, dayKey: day.dayKey, source: "SKUD", type: "OUT" });
    }
  }

  for (const day of networkTimeline) {
    for (const interval of day.intervals) {
      entries.push({ at: interval.startedAt, dayKey: day.dayKey, source: "WIFI", type: "IN" });
      if (interval.endedAt) entries.push({ at: interval.endedAt, dayKey: day.dayKey, source: "WIFI", type: "OUT" });
    }
  }

  return entries.sort((a, b) => b.at.localeCompare(a.at));
}

export function AttendanceLog({
  timeline,
  networkTimeline,
}: {
  timeline: TimelineDay[];
  networkTimeline: NetworkTimelineDay[];
}) {
  const entries = buildEntries(timeline, networkTimeline);

  return (
    <div className="rounded-xl border border-line-hairline bg-surface p-5">
      <div className="mb-3 text-xs uppercase tracking-wide text-ink-muted">Журнал событий</div>

      {entries.length === 0 ? (
        <div className="py-6 text-center text-sm text-ink-muted">Нет событий за выбранный период</div>
      ) : (
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {entries.map((entry, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition hover:bg-surface-raised"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.source === "SKUD" ? SKUD_HEX : WIFI_HEX }}
              />
              <span className="w-14 shrink-0 tabular-nums text-ink-primary">{formatTime(entry.at)}</span>
              <span className="w-20 shrink-0 text-xs text-ink-muted">{formatDayKey(entry.dayKey)}</span>
              <span className={`font-medium ${entry.type === "IN" ? "text-status-good" : "text-ink-secondary"}`}>
                {entry.type === "IN" ? "Приход" : "Уход"}
              </span>
              <span
                className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  color: entry.source === "SKUD" ? SKUD_HEX : WIFI_HEX,
                  backgroundColor: entry.source === "SKUD" ? `${SKUD_HEX}22` : `${WIFI_HEX}22`,
                }}
              >
                {entry.source === "SKUD" ? "СКУД" : "Wi-Fi"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
