/**
 * Auto-matching closes at (task_start - cutoffHours). Urgent tasks skip the cutoff.
 * Set cutoff hours to 0 via MATCHING_CUTOFF_HOURS_BEFORE_START=0 to disable the rule.
 */

export function parseMatchingCutoffHours(raw: string | undefined): number {
  const n = parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isFinite(n) || n < 0) {
    return 24;
  }
  return n;
}

export function matchingDeadlineAt(
  taskStart: Date,
  cutoffHours: number,
): Date {
  return new Date(taskStart.getTime() - cutoffHours * 3600 * 1000);
}

export function canMatchAutomatically(
  urgent: boolean,
  taskStart: Date,
  cutoffHours: number,
  now: Date = new Date(),
): boolean {
  if (urgent) {
    return true;
  }
  if (cutoffHours === 0) {
    return true;
  }
  return now.getTime() <= matchingDeadlineAt(taskStart, cutoffHours).getTime();
}
