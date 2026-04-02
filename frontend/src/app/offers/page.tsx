"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, MapPin, Clock, Wrench, Ruler, CheckCircle2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import { offerApi, assignmentApi, type Offer, type Assignment } from "@/lib/api";
import { useAuth } from "@/context/RoleContext";
import { VOLUNTEER_LOCATIONS } from "@/lib/locations";
import LocationPicker from "@/components/LocationPicker";
import PlaceLine from "@/components/PlaceLine";
import { formatDateTimeRange } from "@/lib/datetime";

const SKILL_OPTIONS = [
  "medical",
  "logistics",
  "first_aid",
  "water",
  "shelter",
  "food",
];

function defaultWindow() {
  const now = new Date();
  const start = new Date(now.getTime() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 6 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 16);
  return { start: fmt(start), end: fmt(end) };
}

export default function OffersPage() {
  const { user } = useAuth();
  const role = user?.role ?? "coordinator";
  const isVolunteer = role === "volunteer";

  const [offers, setOffers] = useState<Offer[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const aw = defaultWindow();
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lon: number;
    label: string;
  } | null>(null);
  const [skills, setSkills] = useState<string[]>(["food", "logistics"]);
  const [aStart, setAStart] = useState(aw.start);
  const [aEnd, setAEnd] = useState(aw.end);
  const [maxDist, setMaxDist] = useState("15");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([offerApi.list(), assignmentApi.list()])
      .then(([o, a]) => { setOffers(o); setAssignments(a); })
      .catch(() => { setOffers([]); setAssignments([]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const assignedOfferIds = new Set(assignments.map((a) => a.volunteer_offer_id));

  // Volunteer sees only their own offers (matched by name)
  const visibleOffers = isVolunteer
    ? offers.filter((o) => o.description === user?.name)
    : offers;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedLocation) { setError("Please select a location"); return; }
    setSaving(true);
    try {
      await offerApi.create({
        location: { lat: selectedLocation.lat, lon: selectedLocation.lon },
        address: selectedLocation.label,
        skills,
        availability: [
          {
            start: new Date(aStart).toISOString().replace(".000Z", ""),
            end: new Date(aEnd).toISOString().replace(".000Z", ""),
          },
        ],
        max_distance_km: parseFloat(maxDist),
        description: user?.name ?? "Volunteer",
      });
      setShowForm(false);
      setSelectedLocation(null);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create offer");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try { await offerApi.delete(id); load(); } catch {}
  }

  function toggleSkill(s: string) {
    setSkills((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  const pageTitle = isVolunteer ? "My Profile" : "Volunteers";
  const pageDesc = isVolunteer
    ? "Manage your skills, availability, and location"
    : "All registered volunteer offers";

  return (
    <>
      <PageHeader title={pageTitle} description={pageDesc}>
        {(isVolunteer || role === "coordinator") && (
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus size={16} />
            {isVolunteer ? "Register" : "New Offer"}
          </Button>
        )}
      </PageHeader>

      {/* Create form */}
      {showForm && (
        <Card className="mb-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            {isVolunteer ? "Register Your Availability" : "Register Volunteer"}
          </h2>
          {user && isVolunteer && (
            <p className="mb-4 text-sm text-foreground">
              Registering as <span className="font-semibold">{user.name}</span>
            </p>
          )}
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Location */}
            <LocationPicker
              value={selectedLocation}
              onChange={setSelectedLocation}
              presets={VOLUNTEER_LOCATIONS}
              label="Your location (address)"
              placeholder="Search by address or pick an area…"
            />
            <p className="text-[11px] text-muted">
              Coordinates are filled from your choice; hover the address on your card to see them.
            </p>

            {/* Max distance */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                How far can you travel? (km)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={maxDist}
                onChange={(e) => setMaxDist(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>

            {/* Availability — one continuous window per offer (API enforces a single range) */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Available from (date &amp; time)
                </label>
                <input
                  type="datetime-local"
                  value={aStart}
                  onChange={(e) => setAStart(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Available until (date &amp; time)
                </label>
                <input
                  type="datetime-local"
                  value={aEnd}
                  onChange={(e) => setAEnd(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
            </div>

            {/* Skills */}
            <div>
              <label className="mb-2 block text-xs font-medium text-muted">
                Your Skills
              </label>
              <div className="flex flex-wrap gap-2">
                {SKILL_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSkill(s)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      skills.includes(s)
                        ? "border-emerald-400 bg-accent-light text-emerald-700"
                        : "border-border text-muted hover:border-emerald-400 hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={saving || skills.length === 0}>
                {saving ? "Registering..." : "Register"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <p className="py-12 text-center text-sm text-muted">Loading...</p>
      ) : visibleOffers.length === 0 ? (
        <EmptyState
          title={isVolunteer ? "No profile yet" : "No volunteers yet"}
          description={
            isVolunteer
              ? "Register your skills and availability to get matched with tasks"
              : "No volunteer offers registered yet"
          }
        >
          {(isVolunteer || role === "coordinator") && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus size={14} />
              {isVolunteer ? "Register Now" : "Register First Volunteer"}
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleOffers.map((o) => {
            const isAssigned = assignedOfferIds.has(o.id);
            return (
              <Card
                key={o.id}
                className={`group relative ${isAssigned ? "border-emerald-200 bg-emerald-50/30" : ""}`}
              >
                <button
                  onClick={() => handleDelete(o.id)}
                  className="absolute top-3 right-3 rounded-md p-1.5 text-muted opacity-0 transition-all hover:bg-danger-light hover:text-danger group-hover:opacity-100"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>

                {/* Name */}
                <p className="text-sm font-semibold">
                  {o.description || "Volunteer"}
                </p>

                {/* Assigned badge */}
                {isAssigned && (
                  <div className="mt-1.5 flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    <span className="text-xs font-medium text-emerald-600">
                      Assigned to a task
                    </span>
                  </div>
                )}

                <div className="mt-3 space-y-2 text-xs text-muted">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="shrink-0 text-emerald-400" />
                    <PlaceLine
                      address={o.address}
                      lat={o.location.lat}
                      lon={o.location.lon}
                      className="line-clamp-2"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Ruler size={12} className="text-emerald-400" />
                    <span>Can travel up to {o.max_distance_km} km</span>
                  </div>
                  {o.availability.map((a, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Clock size={12} className="text-emerald-400" />
                      <span>
                        {formatDateTimeRange(a.start, a.end)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-start gap-1.5">
                    <Wrench size={12} className="mt-0.5 text-emerald-400" />
                    <div className="flex flex-wrap gap-1">
                      {o.skills.map((s) => (
                        <Badge key={s} variant="success">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
