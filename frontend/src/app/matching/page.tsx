"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Zap,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Check,
  Trash2,
  MapPin,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import {
  matchApi,
  assignmentApi,
  taskApi,
  offerApi,
  type MatchResult,
  type Task,
  type Offer,
  type Assignment,
} from "@/lib/api";
import PlaceLine from "@/components/PlaceLine";
import { useAuth } from "@/context/RoleContext";
import { taskAllowedInAutoMatch } from "@/lib/task-matching";

type Algorithm = "greedy" | "hungarian" | "max_coverage" | "bottleneck";

interface RunResult {
  algorithm: Algorithm;
  matches: MatchResult[];
  timeMs: number;
  /** Tasks included in this matching run (not already approved) */
  taskCount: number;
  /** Offers included in this matching run */
  offerCount: number;
  /** Task ids that were eligible for this run (for unmatched UI) */
  eligibleTaskIds: string[];
  /** Open tasks excluded by server deadline filter in this run */
  tasksSkippedDeadline?: number;
}

export default function MatchingPage() {
  const { user } = useAuth();
  const isCoordinator = user?.role === "coordinator";
  const [algorithm, setAlgorithm] = useState<Algorithm>("greedy");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState("");

  // Approve state
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Cached entity maps for display
  const [taskMap, setTaskMap] = useState<Record<string, Task>>({});
  const [offerMap, setOfferMap] = useState<Record<string, Offer>>({});

  /** Pre-check pool so “Run Matching” is disabled when nothing can be matched */
  const [poolLoading, setPoolLoading] = useState(true);
  const [canRunMatching, setCanRunMatching] = useState(false);
  const [matchingHint, setMatchingHint] = useState<string | null>(null);

  function approvedAssignmentSets(assignments: Assignment[]) {
    const taskIds = new Set<string>();
    const offerIds = new Set<string>();
    for (const a of assignments) {
      if (a.status !== "approved") continue;
      taskIds.add(a.shelter_task_id);
      offerIds.add(a.volunteer_offer_id);
    }
    return { taskIds, offerIds };
  }

  const refreshMatchingPool = useCallback(async () => {
    setPoolLoading(true);
    try {
      const [tasks, offers, assignments] = await Promise.all([
        taskApi.list(),
        offerApi.list(),
        assignmentApi.list(),
      ]);

      if (tasks.length === 0) {
        setCanRunMatching(false);
        setMatchingHint(
          "Add at least one shelter task before running matching."
        );
        return;
      }
      if (offers.length === 0) {
        setCanRunMatching(false);
        setMatchingHint(
          "Add at least one volunteer offer before running matching."
        );
        return;
      }

      const { taskIds: lockedTaskIds, offerIds: lockedOfferIds } =
        approvedAssignmentSets(assignments);
      const eligibleTasks = tasks.filter((t) => !lockedTaskIds.has(t.id));
      const eligibleOffers = offers.filter((o) => !lockedOfferIds.has(o.id));

      if (eligibleTasks.length === 0) {
        setCanRunMatching(false);
        setMatchingHint(
          "Every task already has an approved volunteer assignment. Add new tasks, or use “Clear all assignments” below to start over."
        );
        return;
      }
      if (eligibleOffers.length === 0) {
        setCanRunMatching(false);
        setMatchingHint(
          "Every volunteer offer is already assigned. Add new offers, or clear assignments to re-match."
        );
        return;
      }

      const matchableTasks = eligibleTasks.filter(taskAllowedInAutoMatch);
      if (matchableTasks.length === 0) {
        setCanRunMatching(false);
        setMatchingHint(
          "Every open task is past the auto-matching deadline (default: 24h before the task starts). Add tasks with more lead time, or enable “Urgent” when creating a task to keep it in the matcher."
        );
        return;
      }

      setCanRunMatching(true);
      setMatchingHint(null);
    } catch {
      setCanRunMatching(false);
      setMatchingHint("Could not load tasks or assignments. Check the API.");
    } finally {
      setPoolLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMatchingPool();
  }, [refreshMatchingPool]);

  async function handleRun() {
    setError("");
    setRunning(true);
    setResult(null);
    setApproved(false);

    try {
      const [tasks, offers, assignments] = await Promise.all([
        taskApi.list(),
        offerApi.list(),
        assignmentApi.list(),
      ]);

      if (tasks.length === 0 || offers.length === 0) {
        setError(
          `Need at least 1 task and 1 offer. Currently: ${tasks.length} tasks, ${offers.length} offers.`
        );
        return;
      }

      const { taskIds: lockedTaskIds, offerIds: lockedOfferIds } =
        approvedAssignmentSets(assignments);

      const eligibleTasks = tasks.filter((t) => !lockedTaskIds.has(t.id));
      const eligibleOffers = offers.filter((o) => !lockedOfferIds.has(o.id));

      if (eligibleTasks.length === 0) {
        setError(
          "Every task already has an approved volunteer assignment. Add new tasks, or use “Clear all assignments” below to start over."
        );
        return;
      }

      if (eligibleOffers.length === 0) {
        setError(
          "Every volunteer offer is already assigned. Add new offers, or clear assignments to re-match."
        );
        return;
      }

      const matchableTasks = eligibleTasks.filter(taskAllowedInAutoMatch);
      if (matchableTasks.length === 0) {
        setError(
          "No tasks are eligible for auto-matching: every open task passed the pre-start deadline. Use “Urgent” on new tasks or schedule starts further ahead."
        );
        return;
      }

      setTaskMap(Object.fromEntries(tasks.map((t) => [t.id, t])));
      setOfferMap(Object.fromEntries(offers.map((o) => [o.id, o])));

      const t0 = performance.now();
      const res = await matchApi.run(algorithm);
      const timeMs = performance.now() - t0;

      setResult({
        algorithm,
        matches: res.matches,
        timeMs,
        taskCount: res.tasks_in_run ?? matchableTasks.length,
        offerCount: eligibleOffers.length,
        eligibleTaskIds: matchableTasks.map((t) => t.id),
        tasksSkippedDeadline: res.tasks_skipped_deadline,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Matching failed");
    } finally {
      setRunning(false);
    }
  }

  async function handleApprove() {
    if (!result || result.matches.length === 0) return;
    setApproving(true);
    setError("");

    try {
      await assignmentApi.approve(
        result.matches.map((m) => ({
          shelter_task_id: m.shelter_task_id,
          volunteer_offer_id: m.volunteer_offer_id,
          score: m.score,
        })),
        result.algorithm
      );
      setApproved(true);
      await refreshMatchingPool();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setApproving(false);
    }
  }

  function handleDiscard() {
    setResult(null);
    setApproved(false);
  }

  async function handleClearAllAssignments() {
    if (
      !confirm(
        "Remove ALL approved assignments? Shelters and volunteers will no longer see them until you match again."
      )
    ) {
      return;
    }
    setClearing(true);
    setError("");
    try {
      await assignmentApi.clear();
      setResult(null);
      setApproved(false);
      await refreshMatchingPool();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setClearing(false);
    }
  }

  const coverage = result
    ? ((result.matches.length / result.taskCount) * 100).toFixed(1)
    : null;

  const totalDist = result
    ? result.matches
        .reduce((sum, m) => sum + (m.score > 0 ? 1 / m.score - 1 : 0), 0)
        .toFixed(2)
    : null;

  return (
    <>
      <PageHeader
        title="Run Matching"
        description="Proposes pairs only for tasks and volunteers not already approved. Tasks usually leave auto-matching 24 hours before they start unless marked Urgent when created. Approve adds assignments; use clear-all to replace them."
      />

      {/* Controls */}
      <Card className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
              Algorithm
            </label>
            <div className="flex gap-2">
              {(["greedy", "hungarian", "max_coverage", "bottleneck"] as Algorithm[]).map(
                (a) => (
                  <button
                    key={a}
                    onClick={() => setAlgorithm(a)}
                    disabled={approved}
                    className={`rounded-lg border px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                      algorithm === a
                        ? "border-primary bg-primary-light text-indigo-700"
                        : "border-border text-muted hover:border-primary hover:text-foreground"
                    } disabled:opacity-50`}
                  >
                    {a === "greedy"
                      ? "Greedy (Nearest)"
                      : a === "hungarian"
                        ? "Hungarian (Min distance)"
                        : a === "max_coverage"
                          ? "Max coverage"
                          : "Bottleneck (Min-max distance)"}
                  </button>
                ),
              )}
            </div>
          </div>

          <Button
            onClick={handleRun}
            disabled={
              poolLoading || running || approved || !canRunMatching
            }
            className="w-full sm:w-auto"
            title={
              !canRunMatching && !poolLoading && matchingHint
                ? matchingHint
                : undefined
            }
          >
            <Zap size={16} />
            {poolLoading
              ? "Checking pool…"
              : running
                ? "Matching..."
                : "Run Matching"}
          </Button>
        </div>

        {!poolLoading && matchingHint && !error && (
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {matchingHint}
          </p>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-danger-light px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {isCoordinator && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-xs text-muted">
              Need to re-assign from scratch? This removes every approved
              assignment.
            </p>
            <Button
              variant="danger"
              type="button"
              disabled={clearing || running}
              onClick={handleClearAllAssignments}
            >
              <Trash2 size={16} />
              {clearing ? "Clearing…" : "Clear all assignments"}
            </Button>
          </div>
        )}
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Approved banner */}
          {approved && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-accent-light px-5 py-4">
              <CheckCircle2 size={20} className="text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">
                  Assignments approved
                </p>
                <p className="text-xs text-emerald-600">
                  {result.matches.length} assignments have been saved.
                  Shelters and volunteers can now see their assignments.
                </p>
              </div>
            </div>
          )}

          {result.tasksSkippedDeadline != null &&
            result.tasksSkippedDeadline > 0 && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-950">
                <span className="font-semibold">Deadline filter: </span>
                {result.tasksSkippedDeadline} other open task(s) were not sent
                to the matcher (past the pre-start cutoff). Recreate them with
                more lead time or check &quot;Urgent&quot; when creating.
              </div>
            )}

          {/* Summary stats */}
          <div className="mb-6 grid gap-3 sm:grid-cols-4">
            <Card>
              <p className="text-xs font-medium uppercase text-muted">
                Algorithm
              </p>
              <p className="mt-1 text-lg font-bold capitalize">
                {result.algorithm}
              </p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase text-muted">
                Matches
              </p>
              <p className="mt-1 text-lg font-bold">
                {result.matches.length}
                <span className="text-sm font-normal text-muted">
                  {" "}
                  / {result.taskCount} tasks
                </span>
              </p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase text-muted">
                Coverage
              </p>
              <p className="mt-1 text-lg font-bold">{coverage}%</p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase text-muted">
                Total Distance
              </p>
              <p className="mt-1 text-lg font-bold">{totalDist} km</p>
            </Card>
          </div>

          {/* Approve / Discard actions */}
          {!approved && result.matches.length > 0 && (
            <div className="mb-6 flex gap-3">
              <Button onClick={handleApprove} disabled={approving}>
                <Check size={16} />
                {approving
                  ? "Approving..."
                  : `Approve ${result.matches.length} Assignments`}
              </Button>
              <Button variant="secondary" onClick={handleDiscard}>
                <Trash2 size={16} />
                Discard
              </Button>
            </div>
          )}

          {/* New run after approve */}
          {approved && (
            <div className="mb-6">
              <Button
                variant="secondary"
                onClick={() => {
                  setResult(null);
                  setApproved(false);
                }}
              >
                Run New Matching
              </Button>
            </div>
          )}

          {/* Match list */}
          {result.matches.length === 0 ? (
            <EmptyState
              title="No matches found"
              description="No feasible task-volunteer pairs under current constraints"
            />
          ) : (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                {approved ? "Approved" : "Proposed"} Pairs (
                {result.matches.length})
              </h2>
              {result.matches.map((m, i) => {
                const task = taskMap[m.shelter_task_id];
                const offer = offerMap[m.volunteer_offer_id];
                const dist =
                  m.score > 0 ? (1 / m.score - 1).toFixed(2) : "?";

                return (
                  <Card
                    key={i}
                    className={`flex flex-col gap-3 sm:flex-row sm:items-center ${
                      approved ? "border-emerald-200 bg-emerald-50/30" : ""
                    }`}
                  >
                    {/* Task side */}
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
                          <p className="text-sm font-medium">
                            {task?.description || m.shelter_task_id.slice(0, 8) + "..."}
                          </p>
                        </div>
                      </div>
                      {task && (
                        <div className="mt-1.5 space-y-1 pl-9">
                          <p className="text-xs text-muted flex items-center gap-1">
                            <MapPin size={10} className="text-indigo-400" />
                            <PlaceLine
                              address={task.address}
                              lat={task.location.lat}
                              lon={task.location.lon}
                              className="line-clamp-2"
                            />
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {task.required_skills.map((s) => (
                              <Badge key={s}>{s}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <ArrowRight
                          size={18}
                          className="hidden text-primary sm:block"
                        />
                        <span className="text-xs font-medium text-primary">
                          {dist} km
                        </span>
                      </div>
                    </div>

                    {/* Offer side */}
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
                          <p className="text-sm font-medium">
                            {offer?.description || m.volunteer_offer_id.slice(0, 8) + "..."}
                          </p>
                        </div>
                      </div>
                      {offer && (
                        <div className="mt-1.5 space-y-1 pl-9">
                          <p className="text-xs text-muted flex items-center gap-1">
                            <MapPin size={10} className="text-emerald-400" />
                            <PlaceLine
                              address={offer.address}
                              lat={offer.location.lat}
                              lon={offer.location.lon}
                              className="line-clamp-2"
                            />
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {offer.skills.map((s) => (
                              <Badge key={s} variant="success">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Score + status */}
                    <div className="text-right">
                      <p className="text-xs text-muted">Score</p>
                      <p className="text-sm font-bold text-foreground">
                        {m.score.toFixed(3)}
                      </p>
                      {approved && (
                        <Badge variant="success">Approved</Badge>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Unmatched tasks (within this run’s eligible pool only) */}
          {result.matches.length < result.taskCount && (
            <div className="mt-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                Unmatched Tasks (
                {result.taskCount - result.matches.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {result.eligibleTaskIds
                  .filter(
                    (id) =>
                      !result.matches.some(
                        (m) => m.shelter_task_id === id
                      )
                  )
                  .map((id) => (
                    <div
                      key={id}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs"
                    >
                      <XCircle size={12} className="text-danger" />
                      <span className="font-medium text-foreground">
                        {taskMap[id]?.description || id.slice(0, 8) + "..."}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
