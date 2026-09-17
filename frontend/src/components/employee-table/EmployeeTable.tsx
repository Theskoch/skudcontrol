import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { EmployeeListItem } from "../../lib/types";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";
import { deletionDeadline } from "../../lib/time";
import { ColorBandBadge } from "../ui/ColorBandBadge";

export function EmployeeTable({ employees }: { employees: EmployeeListItem[] }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/employees/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  });

  if (employees.length === 0) {
    return (
      <div className="rounded-xl border border-line-hairline bg-surface px-6 py-12 text-center text-ink-muted">
        Сотрудники не найдены
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line-hairline bg-surface">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line-hairline text-ink-muted">
            <th className="w-14 px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Сотрудник</th>
            <th className="px-4 py-3 font-medium">Серийный номер</th>
            <th className="px-4 py-3 font-medium">MAC-адрес</th>
            <th className="px-4 py-3 font-medium">Среднее время на месте</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee, index) => (
            <tr
              key={employee.id}
              onClick={() => navigate(`/employees/${employee.id}`)}
              className="cursor-pointer border-b border-line-hairline last:border-0 transition hover:bg-surface-raised"
            >
              <td className="px-4 py-3 text-ink-muted tabular-nums">{index + 1}</td>
              <td className="px-4 py-3 font-medium text-ink-primary">{employee.fullName}</td>
              <td className="px-4 py-3 font-mono text-xs text-ink-secondary">{employee.serialNumber ?? "—"}</td>
              <td className="px-4 py-3 font-mono text-xs text-ink-secondary">{employee.macAddress ?? "—"}</td>
              <td className="px-4 py-3">
                <ColorBandBadge colorBand={employee.colorBand} minutes={employee.avgMinutes} />
              </td>
              <td className="px-4 py-3">
                {employee.deletionMarkedAt && (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span
                      title={`Пропал из выгрузки, будет удалён автоматически ${deletionDeadline(employee.deletionMarkedAt)}`}
                      className="whitespace-nowrap rounded-full bg-status-warning/15 px-2 py-0.5 text-xs font-medium text-status-warning"
                    >
                      Ожидает удаления · до {deletionDeadline(employee.deletionMarkedAt)}
                    </span>
                    {user?.role === "ADMIN" && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Удалить сотрудника «${employee.fullName}» сейчас?`)) {
                            deleteMutation.mutate(employee.id);
                          }
                        }}
                        className="whitespace-nowrap text-xs text-status-critical hover:underline"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
