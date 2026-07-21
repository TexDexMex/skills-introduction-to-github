"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

export async function saveSettings(_prev: unknown, formData: FormData) {
  const { user, supabase } = await requireUser();

  const leadDays = parseInt(String(formData.get("reminder_lead_days")), 10);
  if (isNaN(leadDays) || leadDays < 1 || leadDays > 365) {
    return { error: "Lead time must be between 1 and 365 days." };
  }
  const fullName = String(formData.get("full_name") || "").trim() || null;

  const { error } = await supabase.from("settings").upsert(
    {
      owner_id: user.id,
      full_name: fullName,
      reminder_lead_days: leadDays,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { error: "", ok: true };
}
