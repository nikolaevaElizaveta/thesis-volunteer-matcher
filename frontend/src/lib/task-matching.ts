import type { Task } from "./api";

/** Backend sets `can_match_automatically`; missing field = older API, treat as open. */
export function taskAllowedInAutoMatch(t: Task): boolean {
  return t.can_match_automatically !== false;
}

/** Unassigned tasks split by auto-matching eligibility (same rule as POST /match). */
export function openTaskCounts(
  taskList: Task[],
  approvedTaskIds: Set<string>
): { matchableOpen: number; pastDeadlineOpen: number } {
  const unassigned = taskList.filter((t) => !approvedTaskIds.has(t.id));
  return {
    matchableOpen: unassigned.filter(taskAllowedInAutoMatch).length,
    pastDeadlineOpen: unassigned.filter((t) => !taskAllowedInAutoMatch(t)).length,
  };
}
