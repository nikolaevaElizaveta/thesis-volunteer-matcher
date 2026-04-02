/**
 * Shared predefined location lists used by tasks and offers pages.
 * Provides a human-readable label resolver from coordinates.
 */

export interface PresetLocation {
  label: string;
  lat: number;
  lon: number;
}

export const TASK_LOCATIONS: PresetLocation[] = [
  { label: "Shelter #1 — Nevsky District", lat: 59.9254, lon: 30.4658 },
  { label: "Shelter #2 — Vasileostrovskaya", lat: 59.9439, lon: 30.2667 },
  { label: "Shelter #3 — Moskovskaya", lat: 59.8903, lon: 30.3187 },
  { label: "Shelter #4 — Petrogradskaya", lat: 59.9663, lon: 30.3117 },
  { label: "Community Center — Admiralteysky", lat: 59.9306, lon: 30.3141 },
  { label: "Red Cross Office — Centralniy", lat: 59.9343, lon: 30.3351 },
];

export const VOLUNTEER_LOCATIONS: PresetLocation[] = [
  { label: "Near Nevsky Prospect", lat: 59.9343, lon: 30.3351 },
  { label: "Vasileostrovskaya area", lat: 59.9439, lon: 30.2667 },
  { label: "Moskovskaya area", lat: 59.8903, lon: 30.3187 },
  { label: "Petrogradskaya area", lat: 59.9663, lon: 30.3117 },
  { label: "Kupchino area", lat: 59.8616, lon: 30.3753 },
  { label: "Primorskaya area", lat: 59.9487, lon: 30.234 },
];

const ALL_LOCATIONS = [...TASK_LOCATIONS, ...VOLUNTEER_LOCATIONS];

/** Resolve the closest matching preset label for given coordinates */
export function locationLabel(lat: number, lon: number): string {
  const match = ALL_LOCATIONS.find(
    (l) => Math.abs(l.lat - lat) < 0.002 && Math.abs(l.lon - lon) < 0.002
  );
  return match ? match.label : `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}
