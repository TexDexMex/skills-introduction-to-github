import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";

/** Returns the signed-in user or redirects to /login. Use in owner pages/actions. */
export async function requireUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { user, supabase };
}
