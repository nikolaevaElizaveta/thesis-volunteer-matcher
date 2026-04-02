"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Zap,
  ClipboardCheck,
  Menu,
  X,
  Heart,
  Building2,
  HandHelping,
  Shield,
  LogOut,
  Search,
} from "lucide-react";
import { useState } from "react";
import { useAuth, type Role } from "@/context/RoleContext";

/* ---------- Navigation config per role ---------- */

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  roles: Role[];
}

const NAV: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["coordinator", "shelter", "volunteer"],
  },
  {
    href: "/tasks",
    label: "My Tasks",
    icon: ClipboardList,
    roles: ["shelter"],
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: Search,
    roles: ["volunteer"],
  },
  {
    href: "/tasks",
    label: "Shelter Tasks",
    icon: ClipboardList,
    roles: ["coordinator"],
  },
  {
    href: "/offers",
    label: "My Profile",
    icon: HandHelping,
    roles: ["volunteer"],
  },
  {
    href: "/offers",
    label: "Volunteers",
    icon: Users,
    roles: ["coordinator"],
  },
  {
    href: "/matching",
    label: "Matching",
    icon: Zap,
    roles: ["coordinator"],
  },
  {
    href: "/assignments",
    label: "My Assignments",
    icon: ClipboardCheck,
    roles: ["coordinator", "shelter", "volunteer"],
  },
];

/* ---------- Role display config ---------- */

const ROLE_META: Record<
  Role,
  {
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
    bg: string;
  }
> = {
  coordinator: {
    label: "Coordinator",
    icon: Shield,
    color: "text-amber-400",
    bg: "bg-amber-500/20",
  },
  shelter: {
    label: "Shelter",
    icon: Building2,
    color: "text-indigo-400",
    bg: "bg-indigo-500/20",
  },
  volunteer: {
    label: "Volunteer",
    icon: HandHelping,
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
  },
};

/* ---------- Component ---------- */

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();

  const role = user?.role ?? "coordinator";
  const visibleNav = NAV.filter((item) => item.roles.includes(role));
  const meta = ROLE_META[role];

  return (
    <>
      {/* Mobile header bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center gap-3 bg-sidebar px-4 text-white md:hidden">
        <button onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Heart size={20} className="text-indigo-400" />
        <span className="text-sm font-semibold tracking-wide">
          Volunteer Matcher
        </span>
      </div>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 flex h-full w-64 flex-col bg-sidebar text-white transition-transform duration-200 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500">
            <Heart size={18} />
          </div>
          <div>
            <p className="text-sm font-bold tracking-wide">
              Volunteer Matcher
            </p>
            <p className="text-xs text-slate-400">Intelligent Allocation</p>
          </div>
        </div>

        {/* User card */}
        {user && (
          <div className="mx-3 mt-2 rounded-lg bg-slate-800 p-3">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.bg}`}
              >
                <meta.icon size={16} className={meta.color} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {user.name}
                </p>
                <p className={`text-xs ${meta.color}`}>{meta.label}</p>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
          {visibleNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={label}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-active text-white"
                    : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-700 px-3 py-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <LogOut size={16} />
            Sign Out
          </button>
          <p className="mt-2 px-3 text-[10px] text-slate-600">
            Prototype
          </p>
        </div>
      </aside>
    </>
  );
}
