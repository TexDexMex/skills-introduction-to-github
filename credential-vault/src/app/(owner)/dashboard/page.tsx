import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { deriveStatus, daysUntil, STATUS_META } from "@/lib/status";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import type { CredentialStatus } from "@/lib/types";

type Row = {
  id: string;
  title: string;
  type_id: string;
  issuing_body: string | null;
  expiration_date: string | null;
  type: { label: string; category: string } | null;
  files: { count: number }[];
};

export default async function DashboardPage() {
  const { user, supabase } = await requireUser();

  const { data: settings } = await supabase
    .from("settings")
    .select("reminder_lead_days")
    .eq("owner_id", user.id)
    .maybeSingle();
  const leadDays = settings?.reminder_lead_days ?? 60;

  const { data } = await supabase
    .from("credentials")
    .select(
      "id, title, type_id, issuing_body, expiration_date, type:credential_types(label,category), files:credential_files(count)",
    )
    .order("expiration_date", { ascending: true, nullsFirst: false });
  const rows = (data ?? []) as unknown as Row[];

  const withStatus = rows.map((r) => ({
    ...r,
    status: deriveStatus(r.expiration_date, leadDays),
    days: daysUntil(r.expiration_date),
  }));

  const attention = withStatus
    .filter((r) => r.status === "expiring" || r.status === "expired")
    .sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9));

  const counts = withStatus.reduce(
    (acc, r) => {
      acc[r.status]++;
      return acc;
    },
    { current: 0, expiring: 0, expired: 0, none: 0 } as Record<
      CredentialStatus,
      number
    >,
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Credentials</h1>
          <p className="text-sm text-gray-500">
            {rows.length} document{rows.length === 1 ? "" : "s"} on file
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/shares/new"
            className="rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand-light"
          >
            Send credentials
          </Link>
          <Link
            href="/credentials/new"
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Add credential
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["expired", "expiring", "current", "none"] as CredentialStatus[]).map(
          (s) => (
            <div
              key={s}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${STATUS_META[s].dot}`} />
                <span className="text-xs text-gray-500">
                  {STATUS_META[s].label}
                </span>
              </div>
              <div className="mt-1 text-2xl font-semibold">{counts[s]}</div>
            </div>
          ),
        )}
      </div>

      {attention.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
          <h2 className="mb-3 text-sm font-semibold text-amber-900">
            Needs attention ({attention.length})
          </h2>
          <ul className="divide-y divide-amber-100">
            {attention.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <Link
                  href={`/credentials/${r.id}`}
                  className="font-medium hover:text-brand"
                >
                  {r.title}
                </Link>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-600">
                    {r.status === "expired"
                      ? `Expired ${formatDate(r.expiration_date)}`
                      : `${r.days} day${r.days === 1 ? "" : "s"} left`}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Credential</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Files</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {withStatus.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  No credentials yet.{" "}
                  <Link href="/credentials/new" className="text-brand underline">
                    Add your first one
                  </Link>
                  .
                </td>
              </tr>
            )}
            {withStatus.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/credentials/${r.id}`}
                    className="font-medium hover:text-brand"
                  >
                    {r.title}
                  </Link>
                  {r.issuing_body && (
                    <div className="text-xs text-gray-400">{r.issuing_body}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{r.type?.label}</td>
                <td className="px-4 py-3 text-gray-600">
                  {formatDate(r.expiration_date)}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {r.files?.[0]?.count ?? 0}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
