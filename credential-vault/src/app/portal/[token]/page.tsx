import { cookies, headers } from "next/headers";
import { loadShareByToken, passcodeCookieName } from "@/lib/portal";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { formatDate, formatDateTime, formatBytes } from "@/lib/format";
import { PasscodeGate } from "@/components/PasscodeGate";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-brand">Chiron Anesthesia</h1>
        <p className="text-sm text-gray-500">Secure credential portal</p>
      </div>
      {children}
    </main>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-gray-500">{body}</p>
    </div>
  );
}

export default async function PortalPage({
  params,
}: {
  params: { token: string };
}) {
  const result = await loadShareByToken(params.token);

  if (result.status !== "ok") {
    const notices = {
      invalid: {
        title: "Link not found",
        body: "This portal link is invalid. Please check with the sender for a current link.",
      },
      revoked: {
        title: "Access revoked",
        body: "The sender has revoked access to these documents.",
      },
      expired: {
        title: "Link expired",
        body: "This secure link has expired. Please request a new one from the sender.",
      },
    };
    const n = notices[result.status];
    return (
      <Shell>
        <Notice title={n.title} body={n.body} />
      </Shell>
    );
  }

  const { share, documents } = result;

  // Passcode gate.
  if (share.requiresPasscode) {
    const ok = cookies().get(passcodeCookieName(share.id))?.value === "1";
    if (!ok) {
      return (
        <Shell>
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="mb-4 text-sm text-gray-600">
              {share.ownerName} shared documents with you. Enter the passcode to
              continue.
            </p>
            <PasscodeGate token={params.token} />
          </div>
        </Shell>
      );
    }
  }

  // Record the view.
  const h = headers();
  const service = createSupabaseServiceClient();
  await logAudit(service, {
    ownerId: share.ownerId,
    actorType: "recipient",
    actorLabel: share.recipientName,
    action: "portal_viewed",
    shareId: share.id,
    ip: h.get("x-forwarded-for"),
    userAgent: h.get("user-agent"),
  });

  return (
    <Shell>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-600">
          <span className="font-medium">{share.ownerName}</span> has shared the
          following documents with{" "}
          <span className="font-medium">{share.recipientName}</span>.
        </p>
        {share.message && (
          <p className="mt-3 rounded-md border-l-2 border-brand bg-brand-light/40 px-3 py-2 text-sm text-gray-700">
            {share.message}
          </p>
        )}
        <p className="mt-3 text-xs text-gray-400">
          Access expires {formatDate(share.expiresAt)}. Downloads are logged.
        </p>

        <ul className="mt-5 divide-y divide-gray-100">
          {documents.map((d) => (
            <li key={d.credentialId} className="py-3">
              <div className="mb-1 font-medium">
                {d.title}
                <span className="ml-2 text-xs text-gray-400">{d.typeLabel}</span>
              </div>
              {d.files.length === 0 ? (
                <p className="text-xs text-gray-400">No file attached.</p>
              ) : (
                <ul className="space-y-1">
                  {d.files.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-600">
                        {f.filename}{" "}
                        <span className="text-gray-400">
                          · {formatBytes(f.size_bytes)} ·{" "}
                          {formatDateTime(f.uploaded_at)}
                        </span>
                      </span>
                      <a
                        href={`/api/portal/${params.token}/file/${f.id}`}
                        className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
                      >
                        Download
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-center text-xs text-gray-400">
        This is a private link. Please do not forward it.
      </p>
    </Shell>
  );
}
