import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { deriveStatus, daysUntil } from "@/lib/status";
import { formatDate, formatDateTime, formatBytes } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { CredentialForm } from "@/components/CredentialForm";
import { UploadVersion } from "@/components/UploadVersion";
import { updateCredential, deleteCredential } from "../actions";
import type { Credential, CredentialFile, CredentialType } from "@/lib/types";

export default async function CredentialDetail({
  params,
}: {
  params: { id: string };
}) {
  const { user, supabase } = await requireUser();

  const { data: cred } = await supabase
    .from("credentials")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!cred) notFound();
  const credential = cred as Credential;

  const { data: settings } = await supabase
    .from("settings")
    .select("reminder_lead_days")
    .eq("owner_id", user.id)
    .maybeSingle();
  const leadDays = settings?.reminder_lead_days ?? 60;

  const { data: typeData } = await supabase
    .from("credential_types")
    .select("*")
    .order("sort_order");
  const types = (typeData ?? []) as CredentialType[];
  const typeLabel = types.find((t) => t.id === credential.type_id)?.label;

  const { data: fileData } = await supabase
    .from("credential_files")
    .select("*")
    .eq("credential_id", credential.id)
    .order("version", { ascending: false });
  const files = (fileData ?? []) as CredentialFile[];

  const status = deriveStatus(credential.expiration_date, leadDays);
  const days = daysUntil(credential.expiration_date);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:underline">
          ← Back to dashboard
        </Link>
        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{credential.title}</h1>
            <p className="text-sm text-gray-500">{typeLabel}</p>
          </div>
          <div className="text-right">
            <StatusBadge status={status} />
            {days !== null && (
              <p className="mt-1 text-xs text-gray-500">
                {days < 0
                  ? `Expired ${formatDate(credential.expiration_date)}`
                  : `Expires ${formatDate(credential.expiration_date)} · ${days} days`}
              </p>
            )}
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Documents ({files.length})
        </h2>
        {files.length === 0 ? (
          <p className="text-sm text-gray-400">No files uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{f.filename}</span>
                    {f.is_current && (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                        current
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    v{f.version} · {formatBytes(f.size_bytes)} ·{" "}
                    {formatDateTime(f.uploaded_at)}
                  </div>
                </div>
                <a
                  href={`/api/files/${f.id}`}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 border-t border-gray-100 pt-5">
          <UploadVersion credentialId={credential.id} />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Details
        </h2>
        <CredentialForm
          action={updateCredential}
          types={types}
          defaults={credential}
          showType={false}
          showFile={false}
          submitLabel="Save changes"
        />
      </section>

      <section className="rounded-lg border border-red-200 bg-red-50/50 p-6">
        <h2 className="text-sm font-semibold text-red-800">Danger zone</h2>
        <p className="mb-3 mt-1 text-sm text-red-700">
          Deleting removes this credential and all its files permanently.
        </p>
        <form action={deleteCredential}>
          <input type="hidden" name="id" value={credential.id} />
          <button className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100">
            Delete credential
          </button>
        </form>
      </section>
    </div>
  );
}
