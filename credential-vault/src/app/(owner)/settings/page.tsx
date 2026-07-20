import { requireUser } from "@/lib/auth";
import { SettingsForm } from "@/components/SettingsForm";
import type { Settings } from "@/lib/types";

export default async function SettingsPage() {
  const { user, supabase } = await requireUser();
  const { data } = await supabase
    .from("settings")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();
  const settings = data as Settings | null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <SettingsForm
          defaults={{
            full_name: settings?.full_name ?? "",
            reminder_lead_days: settings?.reminder_lead_days ?? 60,
          }}
        />
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
        <h2 className="mb-2 font-medium text-gray-700">Reminder tiers</h2>
        <p>
          Reminder emails go to{" "}
          <span className="font-medium text-gray-700">
            {process.env.REMINDER_TO_EMAIL || "your configured inbox"}
          </span>{" "}
          at 60, 30, 14, 7, and 1 days before any credential expires (bounded by
          your lead time above). Each tier is sent once per expiration date.
        </p>
      </div>
    </div>
  );
}
