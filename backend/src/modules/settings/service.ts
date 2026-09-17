import type { PrismaClient } from "@prisma/client";

export type Thresholds = {
  avgWindowDays: number;
  greenThresholdMinutes: number;
  yellowThresholdMinutes: number;
  normMinutesPerDay: number;
  expectedStartMinutes: number; // minutes since midnight
  expectedEndMinutes: number;
  networkGapMergeMinutes: number;
  networkMergeToleranceMinutes: number;
  networkMinBytesPerMinute: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  avgWindowDays: 30,
  greenThresholdMinutes: 420, // 7h
  yellowThresholdMinutes: 240, // 4h
  normMinutesPerDay: 420, // 7h
  expectedStartMinutes: 9 * 60,
  expectedEndMinutes: 18 * 60,
  networkGapMergeMinutes: 90, // 1.5h Wi-Fi disconnect grace period
  networkMergeToleranceMinutes: 10, // only affects the "SKUD+Wi-Fi agree" tooltip label
  networkMinBytesPerMinute: 300, // rough placeholder, needs calibration against real traffic
};

export async function getThresholds(prisma: PrismaClient): Promise<Thresholds> {
  const rows = await prisma.appSetting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    avgWindowDays: (map.get("avgWindowDays") as number) ?? DEFAULT_THRESHOLDS.avgWindowDays,
    greenThresholdMinutes:
      (map.get("greenThresholdMinutes") as number) ?? DEFAULT_THRESHOLDS.greenThresholdMinutes,
    yellowThresholdMinutes:
      (map.get("yellowThresholdMinutes") as number) ?? DEFAULT_THRESHOLDS.yellowThresholdMinutes,
    normMinutesPerDay: (map.get("normMinutesPerDay") as number) ?? DEFAULT_THRESHOLDS.normMinutesPerDay,
    expectedStartMinutes:
      (map.get("expectedStartMinutes") as number) ?? DEFAULT_THRESHOLDS.expectedStartMinutes,
    expectedEndMinutes: (map.get("expectedEndMinutes") as number) ?? DEFAULT_THRESHOLDS.expectedEndMinutes,
    networkGapMergeMinutes:
      (map.get("networkGapMergeMinutes") as number) ?? DEFAULT_THRESHOLDS.networkGapMergeMinutes,
    networkMergeToleranceMinutes:
      (map.get("networkMergeToleranceMinutes") as number) ?? DEFAULT_THRESHOLDS.networkMergeToleranceMinutes,
    networkMinBytesPerMinute:
      (map.get("networkMinBytesPerMinute") as number) ?? DEFAULT_THRESHOLDS.networkMinBytesPerMinute,
  };
}

export type ColorBand = "green" | "yellow" | "red" | "none";

export function colorBandFor(minutes: number, thresholds: Thresholds): ColorBand {
  if (minutes >= thresholds.greenThresholdMinutes) return "green";
  if (minutes >= thresholds.yellowThresholdMinutes) return "yellow";
  return "red";
}
