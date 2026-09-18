import { useState } from "react";
import type { NetworkInterval, NetworkTimelineDay, Thresholds, TimelineDay } from "../../lib/types";
import { formatDayKey, formatTime, minutesSinceMidnight, todayDayKey } from "../../lib/time";
import { SKUD_HEX, WIFI_HEX } from "./seriesColors";

const MINUTES_IN_DAY = 24 * 60;
const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

// ViewBox units, independent of on-screen row height (SVG stretches via preserveAspectRatio="none").
const VB_W = MINUTES_IN_DAY;
const VB_H = 100;

// Both series share one baseline/x-axis; СКУД arches noticeably higher than
// Wi-Fi so the two overlaid curves stay legible instead of tracing each other.
const BASE_Y = 84;
const SKUD_MAX_ARCH = 62;
const WIFI_MAX_ARCH = 36;
const HIT_STROKE_WIDTH = 12; // wide invisible stroke so hover follows each curve's own shape

function pct(minutes: number): string {
  return `${(Math.min(Math.max(minutes, 0), MINUTES_IN_DAY) / MINUTES_IN_DAY) * 100}%`;
}

export function ArcTimelineChart({
  timeline,
  networkTimeline,
  thresholds,
}: {
  timeline: TimelineDay[];
  networkTimeline: NetworkTimelineDay[];
  thresholds: Thresholds;
}) {
  if (timeline.length === 0 && networkTimeline.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-line-hairline bg-surface text-ink-muted">
        Нет данных за выбранный период
      </div>
    );
  }

  const networkByDay = new Map(networkTimeline.map((d) => [d.dayKey, d.intervals]));
  const dayKeys = [...new Set([...timeline.map((d) => d.dayKey), ...networkTimeline.map((d) => d.dayKey)])].sort();
  const rowHeight = dayKeys.length === 1 ? "h-28" : "h-16";

  return (
    <div className="rounded-xl border border-line-hairline bg-surface p-5">
      <HourAxis />
      <div className="mt-2 space-y-3">
        {dayKeys.map((dayKey) => (
          <DayRow
            key={dayKey}
            dayKey={dayKey}
            sessions={timeline.find((d) => d.dayKey === dayKey)?.sessions ?? []}
            networkIntervals={networkByDay.get(dayKey) ?? []}
            thresholds={thresholds}
            rowHeightClass={rowHeight}
          />
        ))}
      </div>
      <Legend />
    </div>
  );
}

function HourAxis() {
  return (
    <div className="relative h-4 pl-28 text-[11px] text-ink-muted">
      {HOUR_TICKS.map((h) => (
        <span
          key={h}
          className="absolute -translate-x-1/2 tabular-nums"
          style={{ left: `calc(7rem + (100% - 7rem) * ${h / 24})` }}
        >
          {String(h).padStart(2, "0")}
        </span>
      ))}
    </div>
  );
}

/** A smooth dome from (x0, baseline) up to a peak and back down to (x1, baseline) — the "was present" arc. */
function archPath(x0: number, x1: number, peakY: number): string {
  const w = x1 - x0;
  const c1x = x0 + w * 0.28;
  const c2x = x1 - w * 0.28;
  return `M ${x0} ${BASE_Y} C ${c1x} ${peakY}, ${c2x} ${peakY}, ${x1} ${BASE_Y}`;
}

/** An open arc that rises from (x0, baseline) and stays up at "now" — session not yet closed. */
function openArchPath(x0: number, xNow: number, peakY: number): string {
  const w = Math.max(xNow - x0, 1);
  const c1x = x0 + w * 0.4;
  return `M ${x0} ${BASE_Y} C ${c1x} ${peakY}, ${xNow} ${peakY}, ${xNow} ${peakY}`;
}

type HoverInfo = { xPct: number; label: string };

type SkudSpan =
  | { startMin: number; checkInAt: string; isOpen: true }
  | { startMin: number; checkInAt: string; isOpen: false; endMin: number; checkOutAt: string };

/**
 * Raw SKUD events sometimes carry a stray extra CHECK_OUT (e.g. a duplicate
 * badge swipe) that `pairEventsIntoSessions` can't attach to anything, so it
 * shows up as its own tiny orphan session. Rather than draw one arc per raw
 * session (which would stop at the first checkout and leave the later one
 * dangling), the day's SKUD arc always spans first arrival to last
 * departure across every session that day - the raw events themselves are
 * untouched and still listed as-is in the event log below the chart.
 */
function computeSkudSpan(sessions: TimelineDay["sessions"]): SkudSpan | null {
  const withCheckIn = sessions.filter((s) => s.checkIn);
  if (withCheckIn.length === 0) return null;

  const earliest = withCheckIn.reduce((a, b) => (a.checkIn! < b.checkIn! ? a : b));
  const startMin = minutesSinceMidnight(earliest.checkIn!);

  const last = sessions[sessions.length - 1];
  const withCheckOut = sessions.filter((s) => s.checkOut);
  if ((last.checkIn && !last.checkOut) || withCheckOut.length === 0) {
    return { startMin, checkInAt: earliest.checkIn!, isOpen: true };
  }

  const latest = withCheckOut.reduce((a, b) => (a.checkOut! > b.checkOut! ? a : b));
  return {
    startMin,
    checkInAt: earliest.checkIn!,
    isOpen: false,
    endMin: minutesSinceMidnight(latest.checkOut!),
    checkOutAt: latest.checkOut!,
  };
}

function DayRow({
  dayKey,
  sessions,
  networkIntervals,
  thresholds,
  rowHeightClass,
}: {
  dayKey: string;
  sessions: TimelineDay["sessions"];
  networkIntervals: NetworkInterval[];
  thresholds: Thresholds;
  rowHeightClass: string;
}) {
  const isToday = dayKey === todayDayKey();
  const nowMinutes = minutesSinceMidnight(new Date().toISOString());
  const [hover, setHover] = useState<HoverInfo | null>(null);

  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 text-xs text-ink-secondary">{formatDayKey(dayKey)}</div>
      <div className={`relative flex-1 rounded-md bg-surface-raised ${rowHeightClass}`}>
        <GridLines />
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
        >
          <line
            x1={0}
            y1={BASE_Y}
            x2={VB_W}
            y2={BASE_Y}
            stroke="currentColor"
            className="text-line-baseline"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />

          {(() => {
            const span = computeSkudSpan(sessions);
            if (!span) return null;

            if (span.isOpen) {
              const { startMin } = span;
              const endMin = isToday ? nowMinutes : MINUTES_IN_DAY;
              const peakY = BASE_Y - Math.min(SKUD_MAX_ARCH, Math.max(endMin - startMin, 20) * 0.9);
              const d = openArchPath(startMin, endMin, peakY);
              const label = `СКУД: ${formatTime(span.checkInAt)} — сейчас · не завершено`;
              return (
                <g key="skud-open">
                  <path
                    d={d}
                    fill="none"
                    stroke={SKUD_HEX}
                    strokeWidth={3}
                    strokeDasharray="6 5"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={HIT_STROKE_WIDTH}
                    strokeLinecap="round"
                    pointerEvents="stroke"
                    className="cursor-pointer"
                    onMouseEnter={() => setHover({ xPct: pctNum((startMin + endMin) / 2), label })}
                    onMouseLeave={() => setHover(null)}
                  />
                </g>
              );
            }

            const { startMin, endMin } = span;
            const widthMin = Math.max(endMin - startMin, 4);
            const peakY = BASE_Y - Math.min(SKUD_MAX_ARCH, widthMin * 0.9);
            const d = archPath(startMin, endMin, peakY);
            const label = `СКУД: ${formatTime(span.checkInAt)} — ${formatTime(span.checkOutAt)} · ${formatDuration(endMin - startMin)}`;
            return (
              <g key="skud-arc">
                <path
                  d={d}
                  fill="none"
                  stroke={SKUD_HEX}
                  strokeWidth={3}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={HIT_STROKE_WIDTH}
                  strokeLinecap="round"
                  pointerEvents="stroke"
                  className="cursor-pointer"
                  onMouseEnter={() => setHover({ xPct: pctNum((startMin + endMin) / 2), label })}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })()}

          {networkIntervals.map((interval, idx) => {
            const startMin = minutesSinceMidnight(interval.startedAt);
            const lowActivity =
              interval.bytesPerMinute > 0 && interval.bytesPerMinute < thresholds.networkMinBytesPerMinute;

            if (!interval.endedAt) {
              const endMin = isToday ? nowMinutes : MINUTES_IN_DAY;
              const peakY = BASE_Y - Math.min(WIFI_MAX_ARCH, Math.max(endMin - startMin, 20) * 0.8);
              const d = openArchPath(startMin, endMin, peakY);
              const label = `Wi-Fi: ${formatTime(interval.startedAt)} — сейчас · подключение активно`;
              return (
                <g key={`wifi-open-${idx}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke={WIFI_HEX}
                    strokeWidth={3}
                    strokeDasharray="6 5"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={HIT_STROKE_WIDTH}
                    strokeLinecap="round"
                    pointerEvents="stroke"
                    className="cursor-pointer"
                    onMouseEnter={() => setHover({ xPct: pctNum((startMin + endMin) / 2), label })}
                    onMouseLeave={() => setHover(null)}
                  />
                </g>
              );
            }

            const endMin = minutesSinceMidnight(interval.endedAt);
            const widthMin = Math.max(endMin - startMin, 4);
            const peakY = BASE_Y - Math.min(WIFI_MAX_ARCH, widthMin * 0.8);
            const d = archPath(startMin, endMin, peakY);
            const label = `Wi-Fi: ${formatTime(interval.startedAt)} — ${formatTime(interval.endedAt)} · ${formatDuration(interval.durationMinutes)}${lowActivity ? " · мало трафика, возможно ноутбук оставлен" : ""}`;
            return (
              <g key={`wifi-${idx}`}>
                <path
                  d={d}
                  fill="none"
                  stroke={WIFI_HEX}
                  strokeWidth={3}
                  strokeDasharray={lowActivity ? "2 4" : undefined}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  opacity={lowActivity ? 0.55 : 1}
                  pointerEvents="none"
                />
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={HIT_STROKE_WIDTH}
                  strokeLinecap="round"
                  pointerEvents="stroke"
                  className="cursor-pointer"
                  onMouseEnter={() => setHover({ xPct: pctNum((startMin + endMin) / 2), label })}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>

        {(() => {
          const span = computeSkudSpan(sessions);
          if (span) {
            return (
              <>
                <EndPoint atPct={pct(span.startMin)} color={SKUD_HEX} />
                {!span.isOpen && <EndPoint atPct={pct(span.endMin)} color={SKUD_HEX} />}
              </>
            );
          }
          // No arrival recorded at all this day - just the stray departure(s), dimmed.
          return sessions
            .filter((s) => !s.checkIn && s.checkOut)
            .map((s, idx) => {
              const at = minutesSinceMidnight(s.checkOut!);
              return (
                <EndPoint
                  key={`skud-orphan-${idx}`}
                  atPct={pct(at)}
                  color={SKUD_HEX}
                  dim
                  onEnter={() => setHover({ xPct: at, label: `СКУД: уход без прихода · ${formatTime(s.checkOut!)}` })}
                  onLeave={() => setHover(null)}
                />
              );
            });
        })()}

        {networkIntervals.map((interval, idx) => (
          <span key={`wifi-dot-${idx}`}>
            <EndPoint atPct={pct(minutesSinceMidnight(interval.startedAt))} color={WIFI_HEX} />
            {interval.endedAt && <EndPoint atPct={pct(minutesSinceMidnight(interval.endedAt))} color={WIFI_HEX} />}
          </span>
        ))}

        {hover && (
          <div
            className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-line-hairline bg-surface-raised px-2 py-1 text-xs text-ink-primary shadow-lg"
            style={{ left: `${hover.xPct}%` }}
          >
            {hover.label}
          </div>
        )}
      </div>
    </div>
  );
}

function pctNum(minutes: number): number {
  return (Math.min(Math.max(minutes, 0), MINUTES_IN_DAY) / MINUTES_IN_DAY) * 100;
}

function GridLines() {
  return (
    <div className="absolute inset-0 flex">
      {HOUR_TICKS.slice(1, -1).map((h) => (
        <div
          key={h}
          className="absolute h-full border-l border-line-hairline/70"
          style={{ left: `${(h / 24) * 100}%` }}
        />
      ))}
    </div>
  );
}

function EndPoint({
  atPct,
  color,
  dim,
  onEnter,
  onLeave,
}: {
  atPct: string;
  color: string;
  dim?: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
}) {
  return (
    <span
      className="absolute rounded-full ring-2 ring-surface-raised"
      style={{
        left: atPct,
        top: `${BASE_Y}%`,
        width: "10px",
        height: "10px",
        transform: "translate(-50%, -50%)",
        backgroundColor: color,
        opacity: dim ? 0.6 : 1,
        pointerEvents: onEnter ? "auto" : "none",
        cursor: onEnter ? "pointer" : undefined,
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    />
  );
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line-hairline pt-3 text-xs text-ink-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SKUD_HEX }} />
        СКУД
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: WIFI_HEX }} />
        Wi-Fi
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-full border border-dashed border-ink-muted" />
        не завершено
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-full border border-dotted opacity-55" style={{ borderColor: WIFI_HEX }} />
        мало трафика (Wi-Fi)
      </span>
    </div>
  );
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}ч ${String(m).padStart(2, "0")}м`;
}
