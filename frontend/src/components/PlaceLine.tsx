"use client";

import { locationLabel } from "@/lib/locations";

/**
 * Shows a verbal address when available; otherwise preset/approximate label or short coords.
 * Hover (title) shows precise coordinates for matching / maps.
 */
export default function PlaceLine({
  address,
  lat,
  lon,
  className,
}: {
  address?: string | null;
  lat: number;
  lon: number;
  className?: string;
}) {
  const text = address?.trim() || locationLabel(lat, lon);
  const title = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  return (
    <span className={className} title={title}>
      {text}
    </span>
  );
}
