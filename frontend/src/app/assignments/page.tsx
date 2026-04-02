"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2,
  MapPin,
  Clock,
  Wrench,
  ArrowRight,
  Ruler,
  RefreshCw,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import {
  assignmentApi,
  taskApi,
  offerApi,
  type Assignment,
  type Task,
  type Offer,
} from "@/lib/api";
import { useAuth } from "@/context/RoleContext";
import PlaceLine from "@/components/PlaceLine";
import { formatDateTimeRange } from "@/lib/datetime";

export default function AssignmentsPage() {
  const { user } = useAuth();
  const role = user?.role ?? "coordinator";

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  const [offers, setOffers] = useState<Record<string, Offer>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const taskReq =
        role === "shelter" && user?.name
          ? taskApi.list({ owner_name: user.name })
          : taskApi.list();
      const [aList, tList, oList] = await Promise.all([
        assignmentApi.list(),
        taskReq,
        offerApi.list(),
      ]);
      setAssignments(aList);
      setTasks(Object.fromEntries(tList.map((t) => [t.id, t])));
      setOffers(Object.fromEntries(oList.map((o) => [o.id, o])));
    } catch {
      setLoadError(
        "Could not load data from the server. Nothing was deleted — try again when the API is reachable."
      );
      /* Do not clear lists on error (that looked like “refresh removed everything”). */
    } finally {
      setLoading(false);
    }
  }, [role, user?.name]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Filter by role (mock identity):
   * - coordinator: all
   * - shelter: assignments whose task is in our task map (we only load tasks with owner_name = us)
   * - volunteer: offer.description === user.name
   */
  const visibleAssignments = assignments.filter((a) => {
    if (role === "coordinator") return true;
    if (role === "shelter") return Boolean(tasks[a.shelter_task_id]);
    if (role === "volunteer" && user?.name) {
      const offer = offers[a.volunteer_offer_id];
      return offer?.description === user.name;
    }
    return true;
  });

  const pageTitle =
    role === "coordinator"
      ? "All Assignments"
      : role === "shelter"
      ? "My Task Assignments"
      : "My Assignments";

  const pageDesc =
    role === "coordinator"
      ? "Who is matched to which task — overview table and full details below"
      : role === "shelter"
      ? "Which volunteer is on each of your tasks"
      : "Tasks assigned to you by the coordinator";

  return (
    <>
      <PageHeader title={pageTitle} description={pageDesc}>
        <Button
          variant="secondary"
          size="sm"
          onClick={load}
          disabled={loading}
          type="button"
          title="Loads the latest assignments from the server. Does not delete anything."
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Reload data
        </Button>
      </PageHeader>

      {loadError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {loadError}
        </div>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-muted">Loading...</p>
      ) : visibleAssignments.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          description={
            role === "coordinator"
              ? "Run matching and approve results to create assignments"
              : role === "volunteer"
              ? "You haven't been assigned to any tasks yet. The coordinator will match you soon."
              : "No volunteers have been assigned to your tasks yet."
          }
        />
      ) : (
        <>
          {/* Quick overview: task ↔ volunteer */}
          <Card className="mb-6 overflow-x-auto">
            <h2 className="text-sm font-semibold text-foreground">
              Task ↔ volunteer
            </h2>
            <p className="mt-1 text-xs text-muted">
              {role === "coordinator"
                ? "All approved pairs at a glance."
                : role === "shelter"
                ? "Volunteers on your tasks only."
                : "Your approved pairings."}
            </p>
            <table className="mt-4 w-full min-w-[280px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wider text-muted">
                  <th className="pb-2 pr-4">Task</th>
                  <th className="pb-2">Volunteer</th>
                </tr>
              </thead>
              <tbody>
                {[...visibleAssignments]
                  .sort((a, b) => {
                    const ta =
                      tasks[a.shelter_task_id]?.description ??
                      a.shelter_task_id;
                    const tb =
                      tasks[b.shelter_task_id]?.description ??
                      b.shelter_task_id;
                    return String(ta).localeCompare(String(tb));
                  })
                  .map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-border/70 last:border-0"
                    >
                      <td className="py-2.5 pr-4 align-top font-medium text-foreground">
                        {tasks[a.shelter_task_id]?.description ?? (
                          <span className="font-mono text-xs text-muted">
                            {a.shelter_task_id.slice(0, 8)}…
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 align-top text-foreground">
                        {offers[a.volunteer_offer_id]?.description ?? (
                          <span className="font-mono text-xs text-muted">
                            {a.volunteer_offer_id.slice(0, 8)}…
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Card>

          {/* Summary */}
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Card>
              <p className="text-xs font-medium uppercase text-muted">
                {role === "volunteer" ? "Your Assignments" : "Total Assignments"}
              </p>
              <p className="mt-1 text-2xl font-bold">
                {visibleAssignments.length}
              </p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase text-muted">
                Algorithm Used
              </p>
              <p className="mt-1 text-2xl font-bold capitalize">
                {visibleAssignments[0]?.algorithm ?? "—"}
              </p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase text-muted">
                Status
              </p>
              <p className="mt-1">
                <Badge variant="success">Approved</Badge>
              </p>
            </Card>
          </div>

          {/* Assignment cards */}
          <div className="space-y-3">
            {visibleAssignments.map((a) => {
              const task = tasks[a.shelter_task_id];
              const offer = offers[a.volunteer_offer_id];
              const dist =
                a.score && a.score > 0
                  ? (1 / a.score - 1).toFixed(2)
                  : "?";

              return (
                <Card
                  key={a.id}
                  className="border-emerald-200 bg-emerald-50/20"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    {/* Task details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50">
                          <CheckCircle2
                            size={14}
                            className="text-indigo-500"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                            Task
                          </p>
                          {task?.description ? (
                            <p className="text-sm font-medium">
                              {task.description}
                            </p>
                          ) : (
                            <p className="text-xs font-mono text-muted">
                              {a.shelter_task_id.slice(0, 12)}...
                            </p>
                          )}
                        </div>
                      </div>
                      {task && (
                        <div className="mt-2 space-y-1 pl-9 text-xs text-muted">
                          <div className="flex items-center gap-1.5">
                            <MapPin size={11} className="text-indigo-400" />
                            <PlaceLine
                              address={task.address}
                              lat={task.location.lat}
                              lon={task.location.lon}
                              className="line-clamp-2"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock size={11} className="text-indigo-400" />
                            {formatDateTimeRange(
                              task.time_window.start,
                              task.time_window.end
                            )}
                          </div>
                          <div className="flex items-start gap-1.5">
                            <Wrench
                              size={11}
                              className="mt-0.5 text-indigo-400"
                            />
                            <div className="flex flex-wrap gap-1">
                              {task.required_skills.map((s) => (
                                <Badge key={s}>{s}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Arrow + distance */}
                    <div className="flex items-center justify-center sm:pt-2">
                      <div className="flex flex-col items-center gap-0.5">
                        <ArrowRight
                          size={18}
                          className="hidden text-emerald-500 sm:block"
                        />
                        <span className="text-xs font-semibold text-emerald-600">
                          {dist} km
                        </span>
                      </div>
                    </div>

                    {/* Volunteer details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
                          <CheckCircle2
                            size={14}
                            className="text-emerald-500"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                            Volunteer
                          </p>
                          {offer?.description ? (
                            <p className="text-sm font-medium">
                              {offer.description}
                            </p>
                          ) : (
                            <p className="text-xs font-mono text-muted">
                              {a.volunteer_offer_id.slice(0, 12)}...
                            </p>
                          )}
                        </div>
                      </div>
                      {offer && (
                        <div className="mt-2 space-y-1 pl-9 text-xs text-muted">
                          <div className="flex items-center gap-1.5">
                            <MapPin size={11} className="text-emerald-400" />
                            <PlaceLine
                              address={offer.address}
                              lat={offer.location.lat}
                              lon={offer.location.lon}
                              className="line-clamp-2"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Ruler size={11} className="text-emerald-400" />
                            Max {offer.max_distance_km} km
                          </div>
                          <div className="flex items-start gap-1.5">
                            <Wrench
                              size={11}
                              className="mt-0.5 text-emerald-400"
                            />
                            <div className="flex flex-wrap gap-1">
                              {offer.skills.map((s) => (
                                <Badge key={s} variant="success">
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Score */}
                    <div className="text-right sm:pt-2">
                      <p className="text-[10px] uppercase text-muted">Score</p>
                      <p className="text-sm font-bold">
                        {a.score?.toFixed(3) ?? "—"}
                      </p>
                      <Badge variant="success">Approved</Badge>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
