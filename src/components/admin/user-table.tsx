"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface AdminUser {
  id: string;
  display_name: string;
  email: string;
  role: "admin" | "member";
  created_at: string;
  media_count: number;
}

export default function UserTable({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | "admin" | "member">("");
  const router = useRouter();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleRoleChange(userId: string, newRole: "admin" | "member") {
    const user = users.find((u) => u.id === userId);
    const action = newRole === "admin" ? "promote" : "demote";
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${user?.display_name} to ${newRole}?`)) return;

    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      await fetchUsers();
      router.refresh();
    } else {
      const data = await res.json();
      alert("Failed: " + data.error);
    }
  }

  async function handleDelete(userId: string) {
    const user = users.find((u) => u.id === userId);
    if (!confirm(`Permanently delete ${user?.display_name} and all their media records? This cannot be undone.`)) return;

    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (res.ok) {
      await fetchUsers();
      router.refresh();
    } else {
      const data = await res.json();
      alert("Failed: " + data.error);
    }
  }

  const filtered = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.display_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="glass-bright rounded-xl p-6">
      <h2 className="text-bc-gold text-xl font-bold mb-4">User Management</h2>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-bc-gold"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as "" | "admin" | "member")}
          className="p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-white/50">Loading users...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/20 text-white/60">
                <th className="text-left py-3 px-2 font-semibold">Name</th>
                <th className="text-left py-3 px-2 font-semibold">Email</th>
                <th className="text-left py-3 px-2 font-semibold">Role</th>
                <th className="text-left py-3 px-2 font-semibold">Joined</th>
                <th className="text-right py-3 px-2 font-semibold">Items</th>
                <th className="text-right py-3 px-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-white/10 text-white/80">
                  <td className="py-3 px-2 font-medium">{u.display_name}</td>
                  <td className="py-3 px-2 text-white/60">{u.email}</td>
                  <td className="py-3 px-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                        u.role === "admin"
                          ? "bg-bc-gold/30 text-bc-gold-light"
                          : "bg-white/15 text-white/70"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-white/60">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-2 text-right">{u.media_count}</td>
                  <td className="py-3 px-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() =>
                          handleRoleChange(
                            u.id,
                            u.role === "admin" ? "member" : "admin"
                          )
                        }
                        disabled={u.id === currentUserId}
                        title={u.id === currentUserId ? "Cannot change your own role" : ""}
                        className="px-3 py-1 text-xs rounded font-semibold bg-bc-gold/20 text-bc-gold-light hover:bg-bc-gold/30 transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {u.role === "admin" ? "Demote" : "Promote"}
                      </button>
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={u.id === currentUserId}
                        title={u.id === currentUserId ? "Cannot delete yourself" : ""}
                        className="px-3 py-1 text-xs rounded font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-8 text-white/50">No users match your search.</div>
          )}
        </div>
      )}
    </div>
  );
}
