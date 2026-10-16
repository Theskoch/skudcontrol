export type CounterSample = { sampledAt: Date; rxBytes: bigint; txBytes: bigint };

export type ActivityState = "ACTIVE" | "IDLE";
export type ActivitySegment = { startedAt: Date; endedAt: Date; state: ActivityState };
export type ActivityEvent = { type: "ARRIVAL" | "DEPARTURE"; at: Date };

// Calibrated on one Mac test (work: 100 KB..18 MB/min; lid closed: 0.1..1.3 KB/min). Preliminary.
export const ACTIVE_BYTES_PER_MIN = 50_000;
// A lone busy minute (e.g. a sleeping Mac waking when the charger is plugged in) is not work.
export const MIN_ACTIVE_SAMPLES = 2;
// Inactive this long (asleep/idle/off the network) => the person left; activity after it => arrived.
export const AWAY_MINUTES = 60;
// Samples come every minute; a longer hole means the device wasn't visible at all.
const MAX_SAMPLE_GAP_MS = 3 * 60_000;

type Entry = { prevAt: Date; at: Date; kind: "OFFLINE" | "IDLE" | "BUSY" };

/**
 * Classifies each sample interval from cumulative counters and derives
 * arrival/departure points from long stretches without sustained activity.
 * Intervals right after a hole or a counter reset have no trustworthy delta,
 * so they count as not-active rather than guessing.
 */
export function analyzeActivity(samples: CounterSample[], now: Date): { segments: ActivitySegment[]; events: ActivityEvent[] } {
  const sorted = [...samples].sort((a, b) => a.sampledAt.getTime() - b.sampledAt.getTime());
  const entries: Entry[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const dtMs = cur.sampledAt.getTime() - prev.sampledAt.getTime();
    if (dtMs <= 0) continue;
    if (dtMs > MAX_SAMPLE_GAP_MS) {
      entries.push({ prevAt: prev.sampledAt, at: cur.sampledAt, kind: "OFFLINE" });
      continue;
    }
    const reset = cur.rxBytes < prev.rxBytes || cur.txBytes < prev.txBytes;
    const bytes = Number(cur.rxBytes - prev.rxBytes + (cur.txBytes - prev.txBytes));
    const perMinute = bytes / (dtMs / 60_000);
    entries.push({ prevAt: prev.sampledAt, at: cur.sampledAt, kind: !reset && perMinute >= ACTIVE_BYTES_PER_MIN ? "BUSY" : "IDLE" });
  }

  // Keep only sustained busy runs (consecutive intervals) as ACTIVE.
  const state: (ActivityState | null)[] = entries.map((e) => (e.kind === "OFFLINE" ? null : "IDLE"));
  const runs: { start: Date; end: Date }[] = [];
  for (let i = 0; i < entries.length; ) {
    if (entries[i].kind !== "BUSY") {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < entries.length && entries[j + 1].kind === "BUSY" && entries[j + 1].prevAt.getTime() === entries[j].at.getTime()) j++;
    if (j - i + 1 >= MIN_ACTIVE_SAMPLES) {
      for (let k = i; k <= j; k++) state[k] = "ACTIVE";
      runs.push({ start: entries[i].prevAt, end: entries[j].at });
    }
    i = j + 1;
  }

  const segments: ActivitySegment[] = [];
  entries.forEach((e, idx) => {
    const s = state[idx];
    if (!s) return;
    const last = segments[segments.length - 1];
    if (last && last.state === s && last.endedAt.getTime() === e.prevAt.getTime()) last.endedAt = e.at;
    else segments.push({ startedAt: e.prevAt, endedAt: e.at, state: s });
  });

  const awayMs = AWAY_MINUTES * 60_000;
  const events: ActivityEvent[] = [];
  const dataStart = sorted.length ? sorted[0].sampledAt : null;
  let prevEnd: Date | null = null;
  for (const run of runs) {
    const gapFrom = prevEnd ?? dataStart;
    if (gapFrom && run.start.getTime() - gapFrom.getTime() >= awayMs) {
      if (prevEnd) events.push({ type: "DEPARTURE", at: prevEnd });
      events.push({ type: "ARRIVAL", at: run.start });
    }
    prevEnd = run.end;
  }
  if (prevEnd && now.getTime() - prevEnd.getTime() >= awayMs) events.push({ type: "DEPARTURE", at: prevEnd });

  return { segments, events };
}
