"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, X, Loader2 } from "lucide-react";

interface LocationValue {
  lat: number;
  lon: number;
  label: string;
}

interface Preset {
  label: string;
  lat: number;
  lon: number;
}

interface Props {
  value: LocationValue | null;
  onChange: (v: LocationValue | null) => void;
  presets?: Preset[];
  label?: string;
  placeholder?: string;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

/**
 * Location autocomplete input.
 *
 * - Shows preset quick-pick buttons
 * - Searches OpenStreetMap Nominatim API as user types (debounced)
 * - Displays results in a dropdown
 * - Shows selected location with a clear button
 */
export default function LocationPicker({
  value,
  onChange,
  presets = [],
  label = "Location",
  placeholder = "Type an address...",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationValue[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`,
        {
          headers: {
            "Accept-Language": "en",
            // Nominatim policy: identify the app
            "User-Agent": "VolunteerMatcher/1.0 (local dev)",
          },
        }
      );
      const data: NominatimResult[] = await res.json();
      setResults(
        data.map((r) => ({
          lat: parseFloat(r.lat),
          lon: parseFloat(r.lon),
          label: r.display_name,
        }))
      );
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleInputChange(val: string) {
    setQuery(val);
    setShowDropdown(true);

    // Debounce API calls (400ms)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  }

  function selectLocation(loc: LocationValue) {
    onChange(loc);
    setQuery("");
    setResults([]);
    setShowDropdown(false);
  }

  function clearLocation() {
    onChange(null);
    setQuery("");
    setResults([]);
  }

  // If already selected, show the selection
  if (value) {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          {label}
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-2">
          <MapPin size={14} className="shrink-0 text-emerald-500" />
          <span className="flex-1 truncate text-sm text-foreground">
            {value.label}
          </span>
          <button
            type="button"
            onClick={clearLocation}
            className="rounded p-0.5 text-muted hover:text-danger"
            title="Clear location"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef}>
      <label className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {searching && (
          <Loader2
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted"
          />
        )}

        {/* Dropdown */}
        {showDropdown && results.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-white shadow-lg">
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectLocation(r)}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
              >
                <MapPin size={12} className="mt-0.5 shrink-0 text-indigo-400" />
                <span className="line-clamp-2">{r.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Preset quick picks */}
      {presets.length > 0 && (
        <div className="mt-2">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted">
            Quick pick
          </p>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  selectLocation({ lat: p.lat, lon: p.lon, label: p.label })
                }
                className="rounded-md border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-primary hover:text-foreground"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
