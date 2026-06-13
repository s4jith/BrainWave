"use client";

import { Card, CardSubtitle, CardTitle } from "@components/ui/Card";
import { Button } from "@components/ui/Button";
import { LoadingSpinner } from "@components/feedback/LoadingSpinner";
import { ErrorState } from "@components/feedback/ErrorState";
import { useAdminUsers, useToggleUserActive } from "../hooks/useAdminData";

interface Props {
  role: "student" | "teacher" | "head";
  title: string;
}

export function UserManagementTable({ role, title }: Props) {
  const q = useAdminUsers(role);
  const toggle = useToggleUserActive(role);

  if (q.isLoading) return <LoadingSpinner />;
  if (q.isError) return <ErrorState message={q.error?.message} />;

  const users = q.data?.users ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">{users.length} {role}s</p>
      </header>
      {users.length === 0 ? (
        <Card>
          <CardSubtitle>No {role} accounts yet.</CardSubtitle>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600">{u.class_level ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium " +
                        (u.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-600")
                      }
                    >
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggle.mutate(u.user_id)}
                      loading={toggle.isPending && toggle.variables === u.user_id}
                    >
                      {u.is_active ? "Disable" : "Enable"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AdminUsersHero() {
  return (
    <Card>
      <CardTitle>User management</CardTitle>
      <CardSubtitle>Pick a category from the side menu.</CardSubtitle>
    </Card>
  );
}
