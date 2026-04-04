import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  // Verify requester is admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Use service role client to list auth.users
  const admin = createAdminClient();
  const { data: authUsers, error: authError } = await admin.auth.admin.listUsers();
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Get profiles with media counts
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, role, created_at");
  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  // Get media counts per user
  const { data: mediaCounts } = await supabase
    .from("media")
    .select("created_by");

  const countMap: Record<string, number> = {};
  (mediaCounts ?? []).forEach((row) => {
    countMap[row.created_by] = (countMap[row.created_by] ?? 0) + 1;
  });

  // Merge auth.users emails with profiles
  const emailMap: Record<string, string> = {};
  (authUsers?.users ?? []).forEach((u) => {
    emailMap[u.id] = u.email ?? "";
  });

  const users = (profiles ?? []).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    email: emailMap[p.id] ?? "",
    role: p.role,
    created_at: p.created_at,
    media_count: countMap[p.id] ?? 0,
  }));

  return NextResponse.json(users);
}
