import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

function shareState(s: { revoked_at: string | null; expires_at: string }) {
  if (s.revoked_at) return { label: "Revoked", cls: "bg-gray-100 text-gray-600" };
  if (new Date(s.expires_at) < new Date())
    return { label: "Expired", cls: "bg-red-100 text-red-700" };
  return { label: "Active", cls: "bg-green-100 text-green-700" };
}

export default async function SharesPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("shares")
    .select(
      "id, expires_at, revoked_at, created_at, recipient:recipients(name, organization), items:share_items(count)",
    )
    .order("created_at", { ascending: false });
  const shares = (data ?? []) as any[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Shares</h1>
        <Link
          href="/shares/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Send credentials
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Recipient</th>
              <th className="px-4 py-3">Documents</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shares.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  No shares yet.
                </td>
              </tr>
            )}
            {shares.map((s) => {
              const st = shareState(s);
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/shares/${s.id}`}
                      className="font-medium hover:text-brand"
                    >
                      {s.recipient?.name ?? "—"}
                    </Link>
                    {s.recipient?.organization && (
                      <div className="text-xs text-gray-400">
                        {s.recipient.organization}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.items?.[0]?.count ?? 0}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDateTime(s.created_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDateTime(s.expires_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}
                    >
                      {st.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
