import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const targetEmail = process.argv[2];

const { data, error } = await supabase.auth.admin.listUsers();
if (error) {
  console.error("listUsers error:", error);
  process.exit(1);
}

if (!targetEmail) {
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, role");
  if (profilesError) {
    console.error("profiles error:", profilesError);
    process.exit(1);
  }
  const byId = new Map(data.users.map((u) => [u.id, u.email]));
  console.log(
    profiles.map((p) => ({
      email: byId.get(p.id),
      display_name: p.display_name,
      role: p.role,
    }))
  );
  process.exit(0);
}

const user = data.users.find(
  (u) => u.email?.toLowerCase() === targetEmail.toLowerCase()
);

if (!user) {
  console.log(`No auth user found with email ${targetEmail}`);
  console.log(
    "All users:",
    data.users.map((u) => u.email)
  );
  process.exit(0);
}

console.log("Found user:", {
  id: user.id,
  email: user.email,
  email_confirmed_at: user.email_confirmed_at,
  created_at: user.created_at,
  last_sign_in_at: user.last_sign_in_at,
});

const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("*")
  .eq("id", user.id)
  .single();

if (profileError) {
  console.error("profile lookup error:", profileError);
} else {
  console.log("Profile row:", profile);
}
