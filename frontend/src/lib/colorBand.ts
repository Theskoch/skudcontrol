import type { ColorBand, Thresholds } from "./types";

export function colorBandFor(minutes: number, thresholds: Thresholds): ColorBand {
  if (minutes >= thresholds.greenThresholdMinutes) return "green";
  if (minutes >= thresholds.yellowThresholdMinutes) return "yellow";
  return "red";
}
