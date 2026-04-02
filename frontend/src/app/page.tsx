"use client";

import { useEffect, useState } from "react";
import {
  ClipboardList,
  Users,
  Zap,
  ArrowRight,
  Activity,
  Building2,
  HandHelping,
  Shield,
  ClipboardCheck,
  Search,
} from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import {
  taskApi,
  offerApi,
  assignmentApi,
  type Task,
  type Assignment,
  type Offer,
} from "@/lib/api";
import { useRole } from "@/context/RoleContext";
import { useAuth } from "@/context/RoleContext";

/** Tasks or volunteer-offers pool: primary number on cards = `open` (still needs a match). */
interface PoolStats {
  open: number;
  assigned: number;
  total: number;
}

function poolFromTasks(
  taskList: Task[],
  approvedTaskIds: Set<string>
): PoolStats {
  const total = taskList.length;
  const assigned = taskList.filter((t) => approvedTaskIds.has(t.id)).length;
  return { open: total - assigned, assigned, total };
}

function poolFromOffers(
  offerList: Offer[],
  assignedOfferIds: Set<string>
): PoolStats {
  const total = offerList.length;
  const assigned = offerList.filter((o) => assignedOfferIds.has(o.id)).length;
  return { open: total - assigned, assigned, total };
}

function taskPoolSubline(p: PoolStats): string {
  if (p.total === 0) return "No tasks in the system yet";
  return `${p.assigned} already matched · ${p.total} total`;
}

function offerPoolSubline(p: PoolStats): string {
  if (p.total === 0) return "No volunteer profiles yet";
  return `${p.assigned} already matched · ${p.total} total profiles`;
}

const GREETINGS = {
  coordinator: {
    title: "Coordinator Dashboard",
    description: "Full system overview — manage tasks, offers, and matching",
    icon: Shield,
  },
  shelter: {
    title: "Shelter Dashboard",
    description: "Create tasks and track volunteer assignments",
    icon: Building2,
  },
  volunteer: {
    title: "Volunteer Dashboard",
    description: "Find tasks that need your help and track your assignments",
    icon: HandHelping,
  },
};

export default function Dashboard() {
  const { role } = useRole();
  const { user } = useAuth();
  // Keep only setters (values are not used directly in this component)
  const [, setTasks] = useState<Task[]>([]);
  const [, setAssignments] = useState<Assignment[]>([]);
  /** Coordinator & volunteer: full-system pools. Shelter: only “my tasks” pool. */
  const [taskPool, setTaskPool] = useState<PoolStats>({
    open: 0,
    assigned: 0,
    total: 0,
  });
  /** Coordinator: all offers. Volunteer: only this user’s offers. Shelter: unused (zeros). */
  const [offerPool, setOfferPool] = useState<PoolStats>({
    open: 0,
    assigned: 0,
    total: 0,
  });
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const r = user?.role ?? "coordinator";
    const taskListPromise =
      r === "shelter" && user?.name
        ? taskApi.list({ owner_name: user.name })
        : taskApi.list();
    Promise.all([taskListPromise, offerApi.list(), assignmentApi.list()])
      .then(([allTasks, offerList, assignmentList]) => {
        setAssignments(assignmentList);
        const approvedTaskIds = new Set(
          assignmentList
            .filter((a) => a.status === "approved")
            .map((a) => a.shelter_task_id)
        );
        const assignedOfferIds = new Set(
          assignmentList
            .filter((a) => a.status === "approved")
            .map((a) => a.volunteer_offer_id)
        );
        const offerById = Object.fromEntries(offerList.map((o) => [o.id, o]));

        if (r === "shelter" && user?.name) {
          // API already filters by owner_name (case-insensitive on server)
          const mine = allTasks;
          setTasks(mine);
          setTaskPool(poolFromTasks(mine, approvedTaskIds));
          setOfferPool({ open: 0, assigned: 0, total: 0 });
          setAssignmentCount(
            assignmentList.filter((a) =>
              mine.some((t) => t.id === a.shelter_task_id)
            ).length
          );
          return;
        }

        if (r === "volunteer" && user?.name) {
          setTasks(allTasks);
          setTaskPool(poolFromTasks(allTasks, approvedTaskIds));
          const myOffers = offerList.filter((o) => o.description === user.name);
          setOfferPool(poolFromOffers(myOffers, assignedOfferIds));
          setAssignmentCount(
            assignmentList.filter(
              (a) => offerById[a.volunteer_offer_id]?.description === user.name
            ).length
          );
          return;
        }

        setTasks(allTasks);
        setTaskPool(poolFromTasks(allTasks, approvedTaskIds));
        setOfferPool(poolFromOffers(offerList, assignedOfferIds));
        setAssignmentCount(assignmentList.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.role, user?.name]);

  /** Coordinator: both pools have “open” rows — you may run matching (feasible pairs not pre-checked). */
  const coordinatorReadyToMatch =
    taskPool.open > 0 && offerPool.open > 0;
  const coordinatorAllTasksAssigned =
    taskPool.total > 0 &&
    taskPool.open === 0 &&
    offerPool.total > 0;

  const greeting = GREETINGS[role];

  /* Cards: big number = still open for matching; muted line = context (best-practice: highlight actionable work). */
  const allCards = [
    /* ---- Coordinator cards ---- */
    {
      key: "tasks-coord",
      label: "Open tasks",
      primary: taskPool.open,
      subline: taskPoolSubline(taskPool),
      icon: ClipboardList,
      color: "text-indigo-500",
      bg: "bg-indigo-50",
      href: "/tasks",
      roles: ["coordinator"],
    },
    {
      key: "offers-coord",
      label: "Open volunteer slots",
      primary: offerPool.open,
      subline: offerPoolSubline(offerPool),
      icon: Users,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
      href: "/offers",
      roles: ["coordinator"],
    },
    {
      key: "match",
      label: "Ready to Match",
      primary: coordinatorReadyToMatch
        ? "Yes"
        : coordinatorAllTasksAssigned
          ? "Done"
          : "No",
      subline: coordinatorReadyToMatch
        ? `${taskPool.open} open task(s) · ${offerPool.open} open volunteer(s) — run matching to check if any pairs are feasible`
        : coordinatorAllTasksAssigned
          ? "Every task has an approved volunteer"
          : taskPool.total === 0 || offerPool.total === 0
            ? "Add tasks and volunteer profiles first"
            : taskPool.open === 0
              ? "No unmatched tasks"
              : "No unmatched volunteer profiles",
      icon: Zap,
      color: coordinatorReadyToMatch
        ? "text-amber-500"
        : coordinatorAllTasksAssigned
          ? "text-emerald-600"
          : "text-slate-400",
      bg: coordinatorReadyToMatch
        ? "bg-amber-50"
        : coordinatorAllTasksAssigned
          ? "bg-emerald-50"
          : "bg-slate-50",
      href: "/matching",
      roles: ["coordinator"],
    },

    /* ---- Shelter cards ---- */
    {
      key: "tasks-shelter",
      label: "Open tasks (mine)",
      primary: taskPool.open,
      subline: taskPoolSubline(taskPool),
      icon: ClipboardList,
      color: "text-indigo-500",
      bg: "bg-indigo-50",
      href: "/tasks",
      roles: ["shelter"],
    },
    {
      key: "assignments-shelter",
      label: "Volunteers assigned",
      primary: assignmentCount,
      subline:
        taskPool.total > 0
          ? `${taskPool.assigned} of ${taskPool.total} tasks have a volunteer`
          : "No tasks yet",
      icon: ClipboardCheck,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
      href: "/assignments",
      roles: ["shelter"],
    },

    /* ---- Volunteer cards ---- */
    {
      key: "tasks-vol",
      label: "Open tasks you can take",
      primary: taskPool.open,
      subline: taskPoolSubline(taskPool),
      icon: Search,
      color: "text-indigo-500",
      bg: "bg-indigo-50",
      href: "/tasks",
      roles: ["volunteer"],
    },
    {
      key: "assignments-vol",
      label: "My assignments",
      primary: assignmentCount,
      subline:
        offerPool.total > 0
          ? `${offerPool.open} profile(s) still matchable · ${offerPool.assigned} already matched`
          : "Add a volunteer profile under My Profile to get matched",
      icon: ClipboardCheck,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
      href: "/assignments",
      roles: ["volunteer"],
    },
  ];

  const visibleCards = allCards.filter((c) => c.roles.includes(role));

  /* Steps visible per role */
  const allSteps = [
    {
      roles: ["shelter"],
      node: (
        <>
          <Link href="/tasks" className="text-primary hover:underline">
            Create tasks
          </Link>{" "}
          that need volunteer help
        </>
      ),
    },
    {
      roles: ["shelter"],
      node: <>Wait for the coordinator to run matching</>,
    },
    {
      roles: ["shelter"],
      node: (
        <>
          Check{" "}
          <Link href="/assignments" className="text-primary hover:underline">
            My Assignments
          </Link>{" "}
          to see which volunteers are assigned
        </>
      ),
    },
    {
      roles: ["volunteer"],
      node: (
        <>
          <Link href="/offers" className="text-primary hover:underline">
            Register your profile
          </Link>{" "}
          — skills, availability, and how far you can travel
        </>
      ),
    },
    {
      roles: ["volunteer"],
      node: (
        <>
          <Link href="/tasks" className="text-primary hover:underline">
            Browse available tasks
          </Link>{" "}
          from shelters near you
        </>
      ),
    },
    {
      roles: ["volunteer"],
      node: (
        <>
          Check{" "}
          <Link href="/assignments" className="text-primary hover:underline">
            My Assignments
          </Link>{" "}
          — the coordinator will match you to the best task
        </>
      ),
    },
    {
      roles: ["coordinator"],
      node: (
        <>
          Review{" "}
          <Link href="/tasks" className="text-primary hover:underline">
            shelter tasks
          </Link>{" "}
          and{" "}
          <Link href="/offers" className="text-primary hover:underline">
            volunteer offers
          </Link>
        </>
      ),
    },
    {
      roles: ["coordinator"],
      node: (
        <>
          Go to{" "}
          <Link href="/matching" className="text-primary hover:underline">
            Matching
          </Link>{" "}
          and run Greedy, Hungarian, or Max coverage matching
        </>
      ),
    },
    {
      roles: ["coordinator"],
      node: <>Approve matched pairs to create assignments</>,
    },
  ];

  const visibleSteps = allSteps.filter((s) => s.roles.includes(role));

  return (
    <>
      <PageHeader
        title={greeting.title}
        description={greeting.description}
      />

      {/* Welcome message */}
      {user && (
        <p className="mb-6 text-sm text-muted">
          Welcome back, <span className="font-medium text-foreground">{user.name}</span>
        </p>
      )}

      {/* Stat cards */}
      <div
        className={`grid gap-4 ${
          visibleCards.length === 3
            ? "sm:grid-cols-2 lg:grid-cols-3"
            : visibleCards.length === 2
            ? "sm:grid-cols-2"
            : ""
        }`}
      >
        {visibleCards.map((c) => (
          <Link key={c.key} href={c.href}>
            <Card className="group cursor-pointer transition-shadow hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">
                    {c.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">
                    {loading ? "..." : c.primary}
                  </p>
                  {c.subline ? (
                    <p className="mt-1.5 text-xs leading-snug text-muted">
                      {c.subline}
                    </p>
                  ) : null}
                </div>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.bg}`}
                >
                  <c.icon size={22} className={c.color} />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-muted group-hover:text-primary">
                <span>View details</span>
                <ArrowRight size={12} />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick start */}
      <Card className="mt-8">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light">
            <Activity size={18} className="text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">
              {role === "coordinator"
                ? "Quick Start"
                : role === "shelter"
                ? "How it works for shelters"
                : "How it works for volunteers"}
            </h2>
            <ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm text-muted">
              {visibleSteps.map((s, i) => (
                <li key={i}>{s.node}</li>
              ))}
            </ol>
          </div>
        </div>
      </Card>
    </>
  );
}
