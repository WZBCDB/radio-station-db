import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import UserTable from "@/components/admin/user-table";
import StatsPanel from "@/components/admin/stats-panel";

export const dynamic = "force-dynamic";

async function getCurrentUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user!.id;
}

export default async function AdminPage() {
  const currentUserId = await getCurrentUserId();

  return (
    <div className="space-y-7">
      <UserTable currentUserId={currentUserId} />

      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass rounded-xl p-5 animate-pulse h-48" />
            ))}
          </div>
        }
      >
        <StatsPanel />
      </Suspense>
    </div>
  );
}
