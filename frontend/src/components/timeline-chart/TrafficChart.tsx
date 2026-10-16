import { useState } from "react";
import type { EmployeeTraffic, TrafficBucket, TrafficStateSegment } from "../../lib/types";
import { formatDayKey } from "../../lib/time";

const MINUTES_IN_DAY = 24 * 60;
const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];
const VB_H = 100;
const BASE_Y = 82;
const STRIP_Y = 88; // state strip under the baseline
const STRIP_H = 8;
const TOP_Y = 8;

// Quiet traffic fades into the background (dim hue, high transparency); heavy
// traffic gets a bright hue at full opacity. Colors are interpolated per bucket.
const LOW_RGB: [number, number, number] = [74, 98, 112];
const HIGH_RGB: [number, number, number] = [52, 240, 196];
const MIN_OPACITY = 0.18;

function level(bytes: number, maxBytes: number): number {
  if (maxBytes <= 0) return 0;
  return Math.sqrt(Math.min(bytes / maxBytes, 1)); // sqrt keeps one spike from washing out everything else
}

function colorAt(l: number): { fill: string; opacity: number } {
  const c = LOW_RGB.map((lo, i) => Math.round(lo + (HIGH_RGB[i] - lo) * l));
  return { fill: `rgb(${c[0]}, ${c[1]}, ${c[2]})`, opacity: MIN_OPACITY + (1 - MIN_OPACITY) * l };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} Б`;
  const units = ["КБ", "МБ", "ГБ", "ТБ"];
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[u]}`;
}

function hhmm(min: number): string {
  const m = ((min % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function TrafficChart({ traffic }: { traffic: EmployeeTraffic }) {
  if (!traffic.hasMac) return null;

  const total = (b: TrafficBucket) => b.rxBytes + b.txBytes;
  const maxBytes = Math.max(0, ...traffic.days.flatMap((d) => d.buckets.map(total)));

  return (
    <div className="rounded-xl border border-line-hairline bg-surface p-5">
      <div className="mb-3 text-sm font-medium text-ink-secondary">Интернет-трафик ноутбука</div>
      {traffic.days.length === 0 ? (
        <div className="flex h-24 items-center justify-center text-sm text-ink-muted">
          Данные о трафике за выбранный период ещё не накоплены
        </div>
      ) : (
        <>
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
          <div className="mt-2 space-y-3">
            {traffic.days.map((day) => (
              <TrafficRow
                key={day.dayKey}
                dayKey={day.dayKey}
                buckets={day.buckets}
                segments={traffic.states.find((d) => d.dayKey === day.dayKey)?.segments ?? []}
                bucketMinutes={traffic.bucketMinutes}
                maxBytes={maxBytes}
                heightClass={traffic.days.length === 1 ? "h-28" : "h-16"}
              />
            ))}
          </div>
          <Legend maxBytes={maxBytes} />
        </>
      )}
    </div>
  );
}

function TrafficRow({
  dayKey,
  buckets,
  segments,
  bucketMinutes,
  maxBytes,
  heightClass,
}: {
  dayKey: string;
  buckets: TrafficBucket[];
  segments: TrafficStateSegment[];
  bucketMinutes: number;
  maxBytes: number;
  heightClass: string;
}) {
  const [hover, setHover] = useState<{ xPct: number; label: string } | null>(null);

  const points = buckets.map((b) => {
    const l = level(b.rxBytes + b.txBytes, maxBytes);
    return { b, l, x: b.startMin + bucketMinutes / 2, y: BASE_Y - l * (BASE_Y - TOP_Y) };
  });

  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 text-xs text-ink-secondary">{formatDayKey(dayKey)}</div>
      <div className={`relative flex-1 rounded-md bg-surface-raised ${heightClass}`}>
        <div className="absolute inset-0">
          {HOUR_TICKS.slice(1, -1).map((h) => (
            <div
              key={h}
              className="absolute h-full border-l border-line-hairline/70"
              style={{ left: `${(h / 24) * 100}%` }}
            />
          ))}
        </div>
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${MINUTES_IN_DAY} ${VB_H}`}
          preserveAspectRatio="none"
        >
          <line
            x1={0}
            y1={BASE_Y}
            x2={MINUTES_IN_DAY}
            y2={BASE_Y}
            stroke="currentColor"
            className="text-line-baseline"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {segments.map((seg, i) => (
            <rect
              key={`state-${i}`}
              x={seg.startMin}
              y={STRIP_Y}
              width={seg.endMin - seg.startMin}
              height={STRIP_H}
              fill={seg.state === "ACTIVE" ? `rgb(${HIGH_RGB.join(",")})` : "#898781"}
              opacity={seg.state === "ACTIVE" ? 0.9 : 0.35}
              pointerEvents="none"
            />
          ))}
          {points.map(({ b, l, y }) => {
            const c = colorAt(l);
            return (
              <rect
                key={b.startMin}
                x={b.startMin}
                y={y}
                width={bucketMinutes}
                height={BASE_Y - y}
                fill={c.fill}
                opacity={c.opacity * 0.35}
                pointerEvents="none"
              />
            );
          })}
          {points.slice(1).map((p, i) => {
            const prev = points[i];
            if (p.b.startMin - prev.b.startMin !== bucketMinutes) return null; // gap = device was off the network
            const c = colorAt((p.l + prev.l) / 2);
            return (
              <line
                key={p.b.startMin}
                x1={prev.x}
                y1={prev.y}
                x2={p.x}
                y2={p.y}
                stroke={c.fill}
                strokeOpacity={c.opacity}
                strokeWidth={2}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            );
          })}
          {points.map(({ b, l, x, y }) => {
            const c = colorAt(l);
            return (
              <g key={b.startMin}>
                <circle
                  cx={x}
                  cy={y}
                  r={0.1}
                  fill="none"
                  stroke={c.fill}
                  strokeOpacity={c.opacity}
                  strokeWidth={5}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
                <rect
                  x={b.startMin}
                  y={0}
                  width={bucketMinutes}
                  height={VB_H}
                  fill="transparent"
                  onMouseEnter={() =>
                    setHover({
                      xPct: (x / MINUTES_IN_DAY) * 100,
                      label: `${hhmm(b.startMin)}–${hhmm(b.startMin + bucketMinutes)} · ↓ ${formatBytes(b.rxBytes)} · ↑ ${formatBytes(b.txBytes)}`,
                    })
                  }
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
        {hover && (
          <div
            className="pointer-events-none absolute -top-7 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-page px-2 py-1 text-[11px] text-ink-primary shadow"
            style={{ left: `${hover.xPct}%` }}
          >
            {hover.label}
          </div>
        )}
      </div>
    </div>
  );
}

function Legend({ maxBytes }: { maxBytes: number }) {
  const low = colorAt(0);
  const high = colorAt(1);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line-hairline pt-3 text-xs text-ink-muted">
      <span>меньше трафика</span>
      <span
        className="h-2 w-28 rounded-full"
        style={{
          background: `linear-gradient(to right, ${low.fill.replace("rgb", "rgba").replace(")", `, ${low.opacity})`)}, ${high.fill})`,
        }}
      />
      <span>больше (пик за 15 мин: {formatBytes(maxBytes)})</span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-sm" style={{ backgroundColor: `rgb(${HIGH_RGB.join(",")})`, opacity: 0.9 }} />
        работает
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-sm" style={{ backgroundColor: "#898781", opacity: 0.45 }} />
        простой / сон
      </span>
      <span className="ml-auto">↓ входящий · ↑ исходящий</span>
    </div>
  );
}
