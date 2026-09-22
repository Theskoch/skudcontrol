import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { EmployeeListItem } from "../lib/types";
import { EmployeeTable } from "../components/employee-table/EmployeeTable";
import { ImportReportModal } from "../components/employee-table/ImportReportModal";

export function EmployeeListPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["employees", search],
    queryFn: () => api.get<EmployeeListItem[]>(`/employees?search=${encodeURIComponent(search)}`),
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Сотрудники</h1>
          <p className="text-sm text-ink-muted">
            Учёт прихода и ухода по всем сотрудникам{typeof data?.length === "number" ? ` · ${data.length}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени..."
            className="w-56 rounded-lg border border-line-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-accent-violet"
          />
          {user?.role === "ADMIN" && (
            <button
              onClick={() => setShowImportModal(true)}
              className="whitespace-nowrap rounded-lg bg-accent-violet px-3 py-2 text-sm font-medium text-white hover:bg-accent-violet-strong"
            >
              Импорт отчёта
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-line-hairline bg-surface px-6 py-12 text-center text-ink-muted">
          Загрузка...
        </div>
      ) : (
        <EmployeeTable employees={data ?? []} />
      )}

      {showImportModal && <ImportReportModal onClose={() => setShowImportModal(false)} />}
    </div>
  );
}
