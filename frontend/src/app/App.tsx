import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { LoginPage } from "../pages/LoginPage";
import { EmployeeListPage } from "../pages/EmployeeListPage";
import { EmployeeDetailPage } from "../pages/EmployeeDetailPage";
import { AccountsPage } from "../pages/AccountsPage";
import { ApiPage } from "../pages/ApiPage";
import { ApiDocsPage } from "../pages/ApiDocsPage";
import { AppLayout } from "./AppLayout";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-ink-muted">
        Загрузка...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout>
              <EmployeeListPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/employees/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <EmployeeDetailPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AccountsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/api-settings"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ApiPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/api-docs"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ApiDocsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
