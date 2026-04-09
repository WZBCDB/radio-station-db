import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Profile } from "@/lib/types";

async function getAdminProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data || data.role !== "admin") return null;
  return data;
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getAdminProfile();
  if (!profile) redirect("/dashboard");

  return (
    <div className="min-h-screen p-5">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center text-white mb-7 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold drop-shadow-md">
              WZBC Admin
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Station management for {profile.display_name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-white/70 hover:text-white text-sm font-semibold transition"
            >
              Users &amp; Stats
            </Link>
            <Link
              href="/admin/bulk"
              className="text-white/70 hover:text-white text-sm font-semibold transition"
            >
              Bulk Operations
            </Link>
            <Link
              href="/dashboard"
              className="bg-bc-gold/20 text-white border-2 border-bc-gold px-4 py-2 rounded-md font-semibold text-sm hover:bg-bc-gold/30 transition"
            >
              Back to Dashboard
            </Link>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
