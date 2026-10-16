import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { colorBandFor } from "../lib/colorBand";
import type { EmployeeDashboard, EmployeeTraffic, RangeKey } from "../lib/types";
import { HeroScore } from "../components/employee-dashboard/HeroScore";
import { EmployeeInfoCard, PeriodMetricsCard } from "../components/employee-dashboard/MetricsPanel";
import { RangeTabs } from "../components/employee-dashboard/RangeTabs";
import { ArcTimelineChart } from "../components/timeline-chart/ArcTimelineChart";
import { TrafficChart } from "../components/timeline-chart/TrafficChart";
import { EditAttendanceModal } from "../components/employee-dashboard/EditAttendanceModal";
import { AttendanceLog } from "../components/employee-dashboard/AttendanceLog";

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [range, setRange] = useState<RangeKey>("today");
  const [showEditModal, setShowEditModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", id, range],
    queryFn: () => api.get<EmployeeDashboard>(`/employees/${id}/dashboard?range=${range}`),
    enabled: Boolean(id),
  });

  // Traffic is only collected for employees with a MAC; the chart appears as soon as one is set.
  const { data: traffic } = useQuery({
    queryKey: ["traffic", id, range],
    queryFn: () => api.get<EmployeeTraffic>(`/employees/${id}/traffic?range=${range}`),
    enabled: Boolean(id),
    refetchInterval: range === "today" ? 60_000 : false,
  });

  if (isLoading || !data) {
    return <div className="py-12 text-center text-ink-muted">Загрузка...</div>;
  }

  const heroColorBand =
    data.period.activeDays > 0 ? colorBandFor(data.period.averageMinutes, data.thresholds) : "none";

  return (
    <div>
      <Link to="/" className="text-sm text-ink-muted hover:text-ink-primary">
        ← Все сотрудники
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <EmployeeInfoCard employee={data.employee} />
          <HeroScore minutes={data.period.averageMinutes} colorBand={heroColorBand} range={range} />
          <PeriodMetricsCard period={data.period} />
          {user?.role === "ADMIN" && (
            <button
              onClick={() => setShowEditModal(true)}
              className="w-full rounded-lg bg-accent-violet px-3 py-2.5 text-sm font-medium text-white hover:bg-accent-violet-strong"
            >
              Внести изменения
            </button>
          )}
        </div>

        <div className="space-y-4">
          <RangeTabs value={range} onChange={setRange} />
          <ArcTimelineChart
            timeline={data.timeline}
            networkTimeline={data.networkTimeline}
            combinedTimeline={data.combinedTimeline}
            trafficEvents={traffic?.events ?? []}
            thresholds={data.thresholds}
          />
          {traffic && <TrafficChart traffic={traffic} />}
          <AttendanceLog timeline={data.timeline} networkTimeline={data.networkTimeline} />
        </div>
      </div>

      {showEditModal && id && (
        <EditAttendanceModal employeeId={id} timeline={data.timeline} onClose={() => setShowEditModal(false)} />
      )}
    </div>
  );
}
