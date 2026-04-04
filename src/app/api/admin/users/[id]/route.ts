import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  // Cannot delete yourself
  if (id === user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get all media by this user to clean up storage
  const { data: userMedia } = await supabase
    .from("media")
    .select("id")
    .eq("created_by", id);

  if (userMedia && userMedia.length > 0) {
    const mediaIds = userMedia.map((m) => m.id);

    // Get all photo storage paths
    const { data: photos } = await supabase
      .from("media_photos")
      .select("storage_path")
      .in("media_id", mediaIds);

    // Remove storage files
    if (photos && photos.length > 0) {
      const paths = photos.map((p) => p.storage_path);
      await admin.storage.from("media-photos").remove(paths);
    }
  }

  // Delete profile (media + media_photos cascade via FK)
  const { error: profileError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", id);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Delete auth.users entry
  const { error: authError } = await admin.auth.admin.deleteUser(id);
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
