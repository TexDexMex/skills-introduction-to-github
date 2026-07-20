import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { CopyLink } from "@/components/CopyLink";
import { revokeShare } from "../actions";

export default async function ShareDetail({
  params,
}: {
  params: { id: string };
}) {
  const { supabase } = await requireUser();

  const { data: share } = await supabase
    .from("shares")
    .select(
      "id, access_token, message, expires_at, revoked_at, created_at, passcode_hash, recipient:recipients(name, organization, email)",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!share) notFound();
  const s = share as any;

  const { data: items } = await supabase
    .from("share_items")
    .select("credential:credentials(id, title, type:credential_types(label))")
    .eq("share_id", params.id);

  const { data: audit } = await supabase
    .from("audit_log")
    .select("action, actor_type, actor_label, created_at")
    .eq("share_id", params.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const isRevoked = !!s.revoked_at;
  const isExpired = new Date(s.expires_at) < new Date();
  const active = !isRevoked && !isExpired;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const portalUrl = `${appUrl}/portal/${s.access_token}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/shares" className="text-sm text-gray-500 hover:underline">
        ← Back to shares
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{s.recipient?.name}</h1>
          <p className="text-sm text-gray-500">
            {s.recipient?.organization ? `${s.recipient.organization} · ` : ""}
            {s.recipient?.email}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            active
              ? "bg-green-100 text-green-700"
              : isRevoked
                ? "bg-gray-100 text-gray-600"
                : "bg-red-100 text-red-700"
          }`}
        >
          {isRevoked ? "Revoked" : isExpired ? "Expired" : "Active"}
        </span>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Secure portal link
        </h2>
        <CopyLink url={portalUrl} />
        <p className="mt-2 text-xs text-gray-400">
          Expires {formatDateTime(s.expires_at)}.
          {s.passcode_hash ? " Passcode required." : ""}
          {active
            ? " Recipient sees only the documents below."
            : " This link is no longer active."}
        </p>
        {active && (
          <form action={revokeShare} className="mt-4">
            <input type="hidden" name="id" value={s.id} />
            <button className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
              Revoke access now
            </button>
          </form>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Shared documents ({items?.length ?? 0})
        </h2>
        <ul className="divide-y divide-gray-100">
          {(items ?? []).map((it: any) => (
            <li key={it.credential?.id} className="py-2">
              <Link
                href={`/credentials/${it.credential?.id}`}
                className="font-medium hover:text-brand"
              >
                {it.credential?.title}
              </Link>
              <span className="ml-2 text-xs text-gray-400">
                {it.credential?.type?.label}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Access log
        </h2>
        {audit && audit.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {audit.map((a, i) => (
              <li key={i} className="flex items-center justify-between">
                <span className="text-gray-700">
                  <span className="font-medium">{a.action}</span>
                  <span className="text-gray-400">
                    {" "}
                    · {a.actor_type}
                    {a.actor_label ? ` (${a.actor_label})` : ""}
                  </span>
                </span>
                <span className="text-gray-400">
                  {formatDateTime(a.created_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">No activity yet.</p>
        )}
      </section>
    </div>
  );
}
