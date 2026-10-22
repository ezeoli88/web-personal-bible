import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { meQueryOptions, type Me } from "./useMe";

export interface AuthState {
  status: "loading" | "anonymous" | "authenticated";
  email: string | null;
  role: Me["role"];
  me: Me | undefined;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const query = useQuery(meQueryOptions());
  const me = query.data;
  const status: AuthState["status"] = query.isPending
    ? "loading"
    : me?.authenticated
      ? "authenticated"
      : "anonymous";
  const value: AuthState = {
    status,
    email: me?.email ?? null,
    role: me?.authenticated ? me.role ?? null : undefined,
    me,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return value;
}
