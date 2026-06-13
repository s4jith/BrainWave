"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { cn } from "@utils/cn";
import { useUserStore } from "@stores/userStore";
import type { UserRole } from "@/types/user";

interface NavItem {
  label: string;
  href: string;
}

const navByRole: Record<UserRole, NavItem[]> = {
  student: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Test Center", href: "/test" },
    { label: "Notes", href: "/notes" },
    { label: "Report Card", href: "/report-card" },
    { label: "My Groups", href: "/my-groups" },
  ],
  teacher: [
    { label: "Dashboard", href: "/teacher-dashboard" },
    { label: "My Tests", href: "/teacher-tests" },
    { label: "Groups", href: "/teacher-groups" },
    { label: "Queries", href: "/teacher-queries" },
    { label: "Reports", href: "/teacher-reports" },
    { label: "Question Bank", href: "/question-bank" },
  ],
  admin: [
    { label: "Dashboard", href: "/admin-dashboard" },
    { label: "Students", href: "/student-management" },
    { label: "Teachers", href: "/teacher-management" },
    { label: "Groups", href: "/group-management" },
    { label: "Books", href: "/book-management" },
    { label: "Subjects", href: "/subjects-management" },
    { label: "Curriculum", href: "/curriculum-management" },
    { label: "Reports", href: "/admin-reports" },
    { label: "Settings", href: "/admin-settings" },
  ],
  head: [
    { label: "Dashboard", href: "/head-dashboard" },
    { label: "Groups", href: "/head-groups" },
    { label: "Reports", href: "/head-reports" },
    { label: "Tests", href: "/head-tests" },
  ],
};

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useUserStore();
  const role = (user.role ?? "student") as UserRole;
  const items = navByRole[role] ?? navByRole.student;

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="p-6">
          <Link href={`/${role === "student" ? "dashboard" : `${role}-dashboard`}`} className="text-xl font-bold text-red-500">
            BRAINWAVE
          </Link>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{role}</p>
        </div>
        <nav className="flex-1 px-3 pb-6">
          <ul className="space-y-1">
            {items.map((item) => {
              const active = pathname?.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "block rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-3 text-sm">
            <User className="h-5 w-5 text-slate-500" />
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">{user.name || "User"}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-7xl p-6 md:p-10">{children}</div>
      </main>
    </div>
  );
}
