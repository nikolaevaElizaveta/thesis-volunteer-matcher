"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { authApi, type AuthResponse } from "@/lib/api";

/* ---------- Types ---------- */

export type Role = "coordinator" | "shelter" | "volunteer";

export interface AuthUser {
  /** Display name (matches task owner_name / offer description in demos) */
  name: string;
  role: Role;
  username: string;
}

export interface RegisterInput {
  username: string;
  password: string;
  display_name: string;
  role: "shelter" | "volunteer";
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const STORAGE_USER = "vm_auth_user";
export const STORAGE_TOKEN = "vm_access_token";

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_USER);
    const token = localStorage.getItem(STORAGE_TOKEN);
    if (!stored || !token) return null;
    const parsed = JSON.parse(stored) as AuthUser;
    if (parsed.name && parsed.role && parsed.username) {
      return parsed;
    }
  } catch {
    /* ignore malformed local data */
  }
  return null;
}

function userFromAuthResponse(data: AuthResponse): AuthUser {
  return {
    username: data.user.username,
    name: data.user.display_name,
    role: data.user.role,
  };
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

/* ---------- Provider ---------- */

export function RoleProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());
  const [loading] = useState(false);

  function persistSession(data: AuthResponse) {
    const u = userFromAuthResponse(data);
    localStorage.setItem(STORAGE_TOKEN, data.access_token);
    localStorage.setItem(STORAGE_USER, JSON.stringify(u));
    setUser(u);
  }

  async function login(username: string, password: string) {
    const data = await authApi.login(username, password);
    persistSession(data);
  }

  async function register(input: RegisterInput) {
    const data = await authApi.register({
      username: input.username,
      password: input.password,
      display_name: input.display_name,
      role: input.role,
    });
    persistSession(data);
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(STORAGE_USER);
    localStorage.removeItem(STORAGE_TOKEN);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useRole(): { role: Role; setRole: (r: Role) => void } {
  const { user, logout } = useContext(AuthContext);
  return {
    role: user?.role ?? "coordinator",
    setRole: () => logout(),
  };
}
