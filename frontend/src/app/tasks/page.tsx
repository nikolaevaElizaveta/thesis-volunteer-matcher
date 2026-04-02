"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  MapPin,
  Clock,
  Wrench,
  CheckCircle2,
  User,
  Users,
  Sparkles,
  AlarmClock,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import {
  taskApi,
  assignmentApi,
  offerApi,
  type Task,
  type Assignment,
} from "@/lib/api";
import { TASK_LOCATIONS as LOCATIONS } from "@/lib/locations";
import LocationPicker from "@/components/LocationPicker";
import PlaceLine from "@/components/PlaceLine";
import { formatDateTimeRange, formatInstantLocal } from "@/lib/datetime";
import { useAuth } from "@/context/RoleContext";

const SKILL_OPTIONS = [
  "medical",
  "logistics",
  "first_aid",
  "water",
  "shelter",
  "food",
];

function defaultTimeWindow() {
  const now = new Date();
  const start = new Date(now.getTime() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 16);
  return { start: fmt(start), end: fmt(end) };
}

export default function TasksPage() {
  const { user } = useAuth();
  const role = user?.role ?? "coordinator";
  const canCreate = role === "shelter" || role === "coordinator";

  const [tasks, setTasks] = useState<Task[]>([]);
  /** Volunteer only: tasks that already have a volunteer (read-only “community” section) */
  const [coveredTasks, setCoveredTasks] = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  /** task id → volunteer display name (from offer), for coordinator & shelter */
  const [volunteerByTaskId, setVolunteerByTaskId] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const tw = defaultTimeWindow();
  const [title, setTitle] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lon: number;
    label: string;
  } | null>(null);
  const [skills, setSkills] = useState<string[]>(["food"]);
  const [start, setStart] = useState(tw.start);
  const [end, setEnd] = useState(tw.end);
  const [urgent, setUrgent] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const taskReq =
      role === "shelter" && user?.name
        ? taskApi.list({ owner_name: user.name })
        : taskApi.list();

    Promise.all([taskReq, assignmentApi.list(), offerApi.list()])
      .then(([t, a, offers]) => {
        const offerById = Object.fromEntries(offers.map((o) => [o.id, o]));
        const vMap: Record<string, string> = {};
        for (const asg of a) {
          if (asg.status !== "approved") continue;
          const name = offerById[asg.volunteer_offer_id]?.description?.trim();
          if (name) vMap[asg.shelter_task_id] = name;
        }
        setVolunteerByTaskId(vMap);

        const approvedIds = new Set(
          a.filter((x) => x.status === "approved").map((x) => x.shelter_task_id)
        );
        if (role === "volunteer") {
          const open = t.filter((task) => !approvedIds.has(task.id));
          const filled = t.filter((task) => approvedIds.has(task.id));
          setTasks(open);
          setCoveredTasks(
            [...filled].sort((a, b) =>
              (a.description || "").localeCompare(b.description || "")
            )
          );
        } else {
          setTasks(t);
          setCoveredTasks([]);
        }
        setAssignments(a);
      })
      .catch(() => {
        setTasks([]);
        setCoveredTasks([]);
        setAssignments([]);
        setVolunteerByTaskId({});
      })
      .finally(() => setLoading(false));
  }, [role, user?.name]);

  useEffect(() => {
    load();
  }, [load]);

  const assignedTaskIds = new Set(assignments.map((a) => a.shelter_task_id));

  const showGlobalEmpty =
    !loading &&
    tasks.length === 0 &&
    (role !== "volunteer" || coveredTasks.length === 0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Title is required"); return; }
    if (!selectedLocation) { setError("Please select a location"); return; }
    setSaving(true);
    try {
      await taskApi.create({
        location: { lat: selectedLocation.lat, lon: selectedLocation.lon },
        address: selectedLocation.label,
        urgent,
        required_skills: skills,
        time_window: {
          start: new Date(start).toISOString().replace(".000Z", ""),
          end: new Date(end).toISOString().replace(".000Z", ""),
        },
        description: title.trim(),
        ...(role === "shelter" && user?.name
          ? { owner_name: user.name }
          : {}),
      });
      setShowForm(false);
      setTitle("");
      setSelectedLocation(null);
      setUrgent(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try { await taskApi.delete(id); load(); } catch {}
  }

  function toggleSkill(s: string) {
    setSkills((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  const pageTitle =
    role === "volunteer"
      ? "Tasks & activity"
      : role === "shelter"
      ? "My Tasks"
      : "Shelter Tasks";

  const pageDesc =
    role === "volunteer"
      ? "Pick an open task to learn what’s needed — see below how others are already helping"
      : role === "shelter"
      ? "Tasks you created under your account — only you see them here"
      : "All tasks in the system";

  return (
    <>
      <PageHeader title={pageTitle} description={pageDesc}>
        {canCreate && (
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus size={16} />
            New Task
          </Button>
        )}
      </PageHeader>

      {/* Create form — only for shelter & coordinator */}
      {showForm && canCreate && (
        <Card className="mb-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Create New Task
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Title */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                Task Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Food distribution for 50 people"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
                required
              />
            </div>

            {/* Location picker with search */}
            <LocationPicker
              value={selectedLocation}
              onChange={setSelectedLocation}
              presets={LOCATIONS}
              label="Where help is needed (address)"
              placeholder="Search by address or pick a quick place…"
            />
            <p className="text-[11px] text-muted">
              Matching still uses coordinates; on the card, hover the address line to see them.
            </p>

            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-slate-50/50 px-3 py-2.5">
              <input
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
                className="mt-0.5 rounded border-border"
              />
              <span className="text-sm">
                <span className="font-medium text-foreground">Urgent</span>
                <span className="block text-xs text-muted">
                  Keep this task in auto-matching even if it starts within 24h
                  (last-minute need). Leave off for normal planning.
                </span>
              </span>
            </label>

            {/* Time window */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Start (date &amp; time)
                </label>
                <input
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  End (date &amp; time)
                </label>
                <input
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
            </div>

            {/* Skills */}
            <div>
              <label className="mb-2 block text-xs font-medium text-muted">
                Required Skills
              </label>
              <div className="flex flex-wrap gap-2">
                {SKILL_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSkill(s)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      skills.includes(s)
                        ? "border-primary bg-primary-light text-indigo-700"
                        : "border-border text-muted hover:border-primary hover:text-foreground"
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
                {saving ? "Creating..." : "Create Task"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowForm(false);
                  setUrgent(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Task list */}
      {loading ? (
        <p className="py-12 text-center text-sm text-muted">Loading...</p>
      ) : showGlobalEmpty ? (
        <EmptyState
          title="No tasks yet"
          description={
            canCreate
              ? "Create a shelter task to get started"
              : role === "volunteer"
              ? "No open tasks right now. Check “Volunteers already helping” if any tasks are filled."
              : "No tasks available right now. Check back soon!"
          }
        >
          {canCreate && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus size={14} />
              Create First Task
            </Button>
          )}
        </EmptyState>
      ) : (
        <>
          {/* Open tasks (everyone) / primary list for volunteer */}
          {tasks.length > 0 && (
            <>
              {role === "volunteer" && (
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-500" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Still need someone
                  </h2>
                  <Badge variant="success" className="text-[10px]">
                    You can offer to help
                  </Badge>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...tasks].sort((a, b) => {
                  const aAssigned = assignedTaskIds.has(a.id) ? 1 : 0;
                  const bAssigned = assignedTaskIds.has(b.id) ? 1 : 0;
                  return aAssigned - bAssigned;
                }).map((t) => {
                  const isAssigned = assignedTaskIds.has(t.id);
                  return (
                    <Card
                      key={t.id}
                      className={`group relative ${isAssigned ? "border-emerald-200 bg-emerald-50/30" : ""}`}
                    >
                      {canCreate && (
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="absolute top-3 right-3 rounded-md p-1.5 text-muted opacity-0 transition-all hover:bg-danger-light hover:text-danger group-hover:opacity-100"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}

                      <p className="text-sm font-semibold">
                        {t.description || "Untitled task"}
                      </p>
                      {t.urgent && (
                        <div className="mt-1">
                          <Badge variant="warning">Urgent</Badge>
                        </div>
                      )}

                      {isAssigned && (
                        <div className="mt-1.5 flex flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-emerald-500" />
                            <span className="text-xs font-medium text-emerald-600">
                              Volunteer assigned
                            </span>
                          </div>
                          {(role === "coordinator" || role === "shelter") &&
                            volunteerByTaskId[t.id] && (
                              <div className="flex items-center gap-1 pl-0.5 text-xs text-foreground">
                                <User
                                  size={12}
                                  className="shrink-0 text-emerald-600"
                                />
                                <span className="font-medium">
                                  {volunteerByTaskId[t.id]}
                                </span>
                              </div>
                            )}
                        </div>
                      )}

                      <div className="mt-3 space-y-2 text-xs text-muted">
                        {t.matching_deadline_at != null && (
                          <div className="flex items-start gap-1.5 text-[11px] leading-snug">
                            <AlarmClock
                              size={12}
                              className="mt-0.5 shrink-0 text-amber-600"
                            />
                            <span>
                              {t.can_match_automatically === false ? (
                                <>
                                  <span className="font-medium text-amber-800">
                                    Auto-matching closed
                                  </span>
                                  <span className="text-muted">
                                    {" "}
                                    (deadline was{" "}
                                    {formatInstantLocal(t.matching_deadline_at)}
                                    )
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="font-medium text-foreground">
                                    Auto-matching until{" "}
                                  </span>
                                  {formatInstantLocal(t.matching_deadline_at)}
                                </>
                              )}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <MapPin
                            size={12}
                            className="shrink-0 text-indigo-400"
                          />
                          <PlaceLine
                            address={t.address}
                            lat={t.location.lat}
                            lon={t.location.lon}
                            className="line-clamp-2"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-indigo-400" />
                          <span>
                            {formatDateTimeRange(
                              t.time_window.start,
                              t.time_window.end
                            )}
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <Wrench
                            size={12}
                            className="mt-0.5 text-indigo-400"
                          />
                          <div className="flex flex-wrap gap-1">
                            {t.required_skills.map((s) => (
                              <Badge key={s}>{s}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {role === "volunteer" && tasks.length === 0 && coveredTasks.length > 0 && (
            <Card className="mb-6 border-amber-100 bg-amber-50/40">
              <p className="text-sm text-amber-900">
                Every listed task already has a volunteer right now. New tasks
                may appear soon — or browse below to see community activity.
              </p>
            </Card>
          )}

          {/* Volunteer: filled tasks — visibility only, not “selectable” */}
          {role === "volunteer" && coveredTasks.length > 0 && (
            <section className={tasks.length > 0 ? "mt-10" : ""}>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Users size={18} className="text-emerald-600" />
                <h2 className="text-sm font-semibold text-foreground">
                  Volunteers already helping
                </h2>
                <span className="text-xs text-muted">
                  These tasks are covered — shown so everyone sees the community
                  is active
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {coveredTasks.map((t) => {
                  const name = volunteerByTaskId[t.id];
                  const isYou = Boolean(
                    user?.name && name && name === user.name
                  );
                  return (
                    <Card
                      key={t.id}
                      className="relative border-slate-200 bg-slate-50/80 opacity-95"
                      aria-label="Assigned task — view only"
                    >
                      <div className="absolute right-3 top-3">
                        <Badge variant="success" className="text-[10px]">
                          Filled
                        </Badge>
                      </div>
                      <p className="pr-16 text-sm font-semibold text-slate-700">
                        {t.description || "Untitled task"}
                      </p>
                      {t.urgent && (
                        <div className="mt-1">
                          <Badge variant="warning">Urgent</Badge>
                        </div>
                      )}
                      <div className="mt-2 flex items-start gap-1.5 text-xs">
                        <User size={12} className="mt-0.5 shrink-0 text-emerald-600" />
                        <div>
                          {isYou ? (
                            <span className="font-medium text-emerald-800">
                              You’re assigned to this task
                            </span>
                          ) : name ? (
                            <span className="text-slate-600">
                              <span className="font-medium text-foreground">
                                {name}
                              </span>{" "}
                              is helping
                            </span>
                          ) : (
                            <span className="text-slate-600">
                              A volunteer is assigned
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 space-y-2 text-xs text-slate-500">
                        {t.matching_deadline_at != null && (
                          <div className="flex items-start gap-1.5 text-[11px] leading-snug">
                            <AlarmClock
                              size={12}
                              className="mt-0.5 shrink-0 text-amber-600"
                            />
                            <span>
                              {t.can_match_automatically === false
                                ? `Auto-matching closed (deadline was ${formatInstantLocal(t.matching_deadline_at)})`
                                : `Auto-matching until ${formatInstantLocal(t.matching_deadline_at)}`}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <MapPin size={12} className="shrink-0" />
                          <PlaceLine
                            address={t.address}
                            lat={t.location.lat}
                            lon={t.location.lon}
                            className="line-clamp-2"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} />
                          <span>
                            {formatDateTimeRange(
                              t.time_window.start,
                              t.time_window.end
                            )}
                          </span>
                        </div>
                      </div>
                      <p className="mt-3 text-[10px] uppercase tracking-wide text-slate-400">
                        Not available to join — coordinator matched this already
                      </p>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
