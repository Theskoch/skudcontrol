import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import type { CurrentUser } from "./types";

type AuthContextValue = {
  user: CurrentUser | null;
  isLoading: boolean;
  refetch: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        return await api.get<CurrentUser>("/auth/me");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  return (
    <AuthContext.Provider value={{ user: data ?? null, isLoading, refetch: () => refetch() }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useLogout() {
  return async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Even if the request fails (network blip, etc.), the caller still
      // does a hard navigation to /login below - a stuck "Выйти" button is
      // worse than a cookie that lingers server-side until it expires on its own.
    }
    // Deliberately NOT touching the React Query cache here: the caller does a
    // full page reload right after this resolves, which already wipes all
    // client state. Mutating the cache too raced ProtectedRoute's own
    // auth-state watch, which could momentarily redirect via client-side
    // routing a beat before the hard navigation fired, flashing between the
    // two and making logout look like it "bounced back."
  };
}
