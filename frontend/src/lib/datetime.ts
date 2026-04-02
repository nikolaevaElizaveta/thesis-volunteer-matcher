/**
 * Human-readable date + time for task windows and volunteer availability.
 */

/** Single instant for “matching until …” lines */
export function formatInstantLocal(
  iso: string,
  locale?: string,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale ?? undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function formatDateTimeRange(
  startIso: string,
  endIso: string,
  locale?: string,
): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return `${startIso} – ${endIso}`;
  }

  const loc = locale ?? undefined;
  const sameCalendarDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();

  const dateTime = new Intl.DateTimeFormat(loc, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const timeOnly = new Intl.DateTimeFormat(loc, { timeStyle: "short" });

  if (sameCalendarDay) {
    return `${dateTime.format(s)} – ${timeOnly.format(e)}`;
  }
  return `${dateTime.format(s)} – ${dateTime.format(e)}`;
}
