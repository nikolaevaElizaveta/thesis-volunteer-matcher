/**
 * API service layer — communicates with the NestJS backend (port 3000).
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const TOKEN_KEY = "vm_access_token";

function bearerHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem(TOKEN_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function isAuthPublicPath(path: string): boolean {
  const p = path.split("?")[0];
  return p === "/auth/login" || p === "/auth/register";
}

/* ---------- Generic helpers ---------- */

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(isAuthPublicPath(path) ? {} : bearerHeaders()),
      ...((init?.headers as Record<string, string>) ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let nestMessage: string | null = null;
    try {
      const j = JSON.parse(body) as { message?: string | string[] };
      if (j?.message != null) {
        nestMessage = Array.isArray(j.message)
          ? j.message.join(", ")
          : String(j.message);
      }
    } catch {
      /* not JSON */
    }
    throw new Error(
      nestMessage ?? `${res.status} ${res.statusText}: ${body}`,
    );
  }
  return res.json() as Promise<T>;
}

/* ---------- Auth ---------- */

export type AuthRole = "coordinator" | "shelter" | "volunteer";

export interface AuthResponse {
  access_token: string;
  user: {
    username: string;
    display_name: string;
    role: AuthRole;
  };
}

export const authApi = {
  login: (username: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: username.trim(), password }),
    }),

  register: (body: {
    username: string;
    password: string;
    display_name: string;
    role: "shelter" | "volunteer";
  }) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: body.username.trim(),
        password: body.password,
        display_name: body.display_name.trim(),
        role: body.role,
      }),
    }),
};

/* ---------- Types ---------- */

export interface Location {
  lat: number;
  lon: number;
}

export interface TimeWindow {
  start: string;
  end: string;
}

export interface AvailabilityWindow {
  start: string;
  end: string;
}

export interface Task {
  id: string;
  location: Location;
  required_skills: string[];
  time_window: TimeWindow;
  /** Used as title on the frontend; maps to 'description' in matcher */
  description?: string;
  /** Human-readable place (from search / presets); coordinates in `location` */
  address?: string;
  /** Shelter login name that owns this task (mock multi-tenancy) */
  owner_name?: string;
  /** Last-minute tasks: stay in auto-matching inside the usual pre-start window */
  urgent?: boolean;
  /** ISO: auto-matching closes after this instant (unless urgent) */
  matching_deadline_at?: string;
  /** False = excluded from POST /match until start time moves or urgent set */
  can_match_automatically?: boolean;
}

export interface Offer {
  id: string;
  location: Location;
  skills: string[];
  availability: AvailabilityWindow[];
  max_distance_km: number;
  /** Used as volunteer display name on the frontend */
  description?: string;
  /** Human-readable place; coordinates in `location` */
  address?: string;
}

export interface MatchResult {
  shelter_task_id: string;
  volunteer_offer_id: string;
  score: number;
}

export interface MatchResponse {
  matches: MatchResult[];
  /** Tasks actually sent to matcher (after deadline filter) */
  tasks_in_run?: number;
  /** Open tasks excluded by deadline (not urgent) */
  tasks_skipped_deadline?: number;
}

/* ---------- Tasks ---------- */

export const taskApi = {
  list: (params?: { owner_name?: string }) => {
    const q =
      params?.owner_name != null && params.owner_name !== ""
        ? `?owner_name=${encodeURIComponent(params.owner_name)}`
        : "";
    return request<Task[]>(`/tasks${q}`);
  },
  get: (id: string) => request<Task>(`/tasks/${id}`),
  create: (data: Omit<Task, "id"> & { owner_name?: string }) =>
    request<Task>("/tasks", { method: "POST", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/tasks/${id}`, { method: "DELETE" }),
};

/* ---------- Offers ---------- */

export const offerApi = {
  list: () => request<Offer[]>("/offers"),
  get: (id: string) => request<Offer>(`/offers/${id}`),
  create: (data: Omit<Offer, "id">) =>
    request<Offer>("/offers", { method: "POST", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/offers/${id}`, { method: "DELETE" }),
};

/* ---------- Matching ---------- */

export const matchApi = {
  run: (algorithm: "greedy" | "hungarian" | "max_coverage" | "bottleneck" = "greedy") =>
    request<MatchResponse>("/match", {
      method: "POST",
      body: JSON.stringify({ algorithm }),
    }),
};

/* ---------- Assignments ---------- */

export interface Assignment {
  id: string;
  shelter_task_id: string;
  volunteer_offer_id: string;
  score?: number;
  algorithm: string;
  status: "approved" | "rejected" | "pending";
  created_at: string;
}

export const assignmentApi = {
  /** Coordinator approves a batch of matches */
  approve: (
    matches: { shelter_task_id: string; volunteer_offer_id: string; score?: number }[],
    algorithm: "greedy" | "hungarian" | "max_coverage" | "bottleneck"
  ) =>
    request<Assignment[]>("/assignments", {
      method: "POST",
      body: JSON.stringify({ matches, algorithm }),
    }),

  /** List all assignments, optionally filtered */
  list: (params?: { task_id?: string; offer_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.task_id) qs.set("task_id", params.task_id);
    if (params?.offer_id) qs.set("offer_id", params.offer_id);
    const query = qs.toString();
    return request<Assignment[]>(`/assignments${query ? `?${query}` : ""}`);
  },

  /** Clear all assignments */
  clear: () =>
    request<{ message: string }>("/assignments", { method: "DELETE" }),
};
