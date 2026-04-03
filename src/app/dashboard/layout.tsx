import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

async function getProfile(): Promise<Profile | null> {
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

  if (error) {
    console.error("Error fetching profile:", error);
    return null;
  }

  return data;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  return (
    <div className="min-h-screen p-5">
      <div className="max-w-7xl mx-auto">
        <DashboardHeader profile={profile} />
        {children}
      </div>
    </div>
  );
}

function DashboardHeader({ profile }: { profile: Profile }) {
  return (
    <header className="flex justify-between items-center text-white mb-7 flex-wrap gap-4">
      <h1 className="text-3xl font-bold drop-shadow-md">
        WZBC Media Database
      </h1>
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <div className="font-bold text-sm">{profile.display_name}</div>
          <div className="text-xs opacity-90">
            {profile.role === "admin" ? "Admin" : "Member"}
          </div>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="bg-bc-gold/20 text-white border-2 border-bc-gold px-4 py-2 rounded-md font-semibold text-sm hover:bg-bc-gold/30 transition"
          >
            Logout
          </button>
        </form>
      </div>
    </header>
  );
}
