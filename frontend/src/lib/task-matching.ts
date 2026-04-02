import type { Task } from "./api";

/** Backend sets `can_match_automatically`; missing field = older API, treat as open. */
export function taskAllowedInAutoMatch(t: Task): boolean {
  return t.can_match_automatically !== false;
}
