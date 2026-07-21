import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { deriveStatus } from "@/lib/status";
import { ShareBuilder } from "@/components/ShareBuilder";

export default async function NewSharePage() {
  const { user, supabase } = await requireUser();

  const { data: settings } = await supabase
    .from("settings")
    .select("reminder_lead_days")
    .eq("owner_id", user.id)
    .maybeSingle();
  const leadDays = settings?.reminder_lead_days ?? 60;

  const { data: recData } = await supabase
    .from("recipients")
    .select("id, name, organization, email")
    .order("name");

  const { data: credData } = await supabase
    .from("credentials")
    .select("id, title, expiration_date, type:credential_types(label)")
    .order("type_id");

  const credentials = (credData ?? []).map((c: any) => ({
    id: c.id as string,
    title: c.title as string,
    typeLabel: (c.type?.label as string) ?? "",
    status: deriveStatus(c.expiration_date, leadDays),
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/shares" className="text-sm text-gray-500 hover:underline">
        ← Back to shares
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Send credentials</h1>
      <p className="mb-6 text-sm text-gray-500">
        Choose a recipient, check the documents to release, and set how long the
        secure link stays active.
      </p>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <ShareBuilder
          recipients={recData ?? []}
          credentials={credentials}
        />
      </div>
    </div>
  );
}
