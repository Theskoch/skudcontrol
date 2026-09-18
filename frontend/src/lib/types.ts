export type Role = "ADMIN" | "USER";

export type CurrentUser = {
  id: string;
  username: string;
  role: Role;
  displayName: string;
};

export type ColorBand = "green" | "yellow" | "red" | "none";

export type EmployeeListItem = {
  id: string;
  fullName: string;
  serialNumber: string | null;
  macAddress: string | null;
  deletionMarkedAt: string | null;
  avgMinutes: number;
  colorBand: ColorBand;
};

export type Employee = {
  id: string;
  fullName: string;
  personnelNumber: string | null;
  serialNumber: string | null;
  macAddress: string | null;
  isActive: boolean;
  deletionMarkedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RangeKey = "today" | "yesterday" | "week" | "month" | "year" | "all";

export type Session = {
  dayKey: string;
  checkInEventId: string | null;
  checkOutEventId: string | null;
  checkIn: string | null;
  checkOut: string | null;
  durationMinutes: number;
  incomplete: boolean;
};

export type TimelineDay = {
  dayKey: string;
  sessions: Session[];
};

export type NetworkInterval = {
  dayKey: string;
  startedAt: string;
  endedAt: string | null;
  incomplete: boolean;
  durationMinutes: number;
  totalBytes: number;
  bytesPerMinute: number;
};

export type NetworkTimelineDay = {
  dayKey: string;
  intervals: NetworkInterval[];
};

export type PeriodMetrics = {
  workedMinutes: number;
  normMinutes: number;
  shortfallMinutes: number;
  overtimeMinutes: number;
  latenessMinutes: number;
  earlyLeaveMinutes: number;
  absenceMinutes: number;
  activeDays: number;
  averageMinutes: number;
};

export type Thresholds = {
  avgWindowDays: number;
  greenThresholdMinutes: number;
  yellowThresholdMinutes: number;
  normMinutesPerDay: number;
  expectedStartMinutes: number;
  expectedEndMinutes: number;
  networkGapMergeMinutes: number;
  networkMinBytesPerMinute: number;
  boundaryDisagreementMinutes: number;
};

export type Account = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  isBlocked: boolean;
  isPrimary: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type ApiKeyListItem = {
  id: string;
  name: string;
  keyPrefix: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  createdBy: { displayName: string } | null;
};

export type CreatedApiKey = {
  id: string;
  name: string;
  key: string;
  keyPrefix: string;
  expiresAt: string | null;
  createdAt: string;
};

export type ApiKeyExpiry = "1m" | "6m" | "1y" | "never";

export type EmployeeDashboard = {
  employee: Employee;
  thresholds: Thresholds;
  period: PeriodMetrics;
  timeline: TimelineDay[];
  networkTimeline: NetworkTimelineDay[];
};
