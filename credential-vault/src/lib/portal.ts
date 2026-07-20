import { createSupabaseServiceClient } from "./supabase/server";

export type PortalDocument = {
  credentialId: string;
  title: string;
  typeLabel: string;
  files: {
    id: string;
    filename: string;
    uploaded_at: string;
    size_bytes: number | null;
  }[];
};

export type PortalShare = {
  id: string;
  ownerId: string;
  requiresPasscode: boolean;
  message: string | null;
  expiresAt: string;
  recipientName: string;
  ownerName: string;
};

export type PortalResult =
  | { status: "invalid" | "revoked" | "expired" }
  | { status: "ok"; share: PortalShare; documents: PortalDocument[] };

/**
 * Resolve a recipient portal token to its share, enforcing revocation and
 * expiry. Runs with the service client (server-only); the token is the secret.
 */
export async function loadShareByToken(token: string): Promise<PortalResult> {
  const service = createSupabaseServiceClient();

  const { data: share } = await service
    .from("shares")
    .select(
      "id, owner_id, message, expires_at, revoked_at, passcode_hash, recipient:recipients(name)",
    )
    .eq("access_token", token)
    .maybeSingle();

  if (!share) return { status: "invalid" };
  if (share.revoked_at) return { status: "revoked" };
  if (new Date(share.expires_at) < new Date()) return { status: "expired" };

  const { data: settings } = await service
    .from("settings")
    .select("full_name")
    .eq("owner_id", share.owner_id)
    .maybeSingle();

  const { data: items } = await service
    .from("share_items")
    .select(
      "credential:credentials(id, title, type:credential_types(label), files:credential_files(id, filename, uploaded_at, size_bytes, is_current))",
    )
    .eq("share_id", share.id);

  const documents: PortalDocument[] = (items ?? []).map((it: any) => ({
    credentialId: it.credential?.id,
    title: it.credential?.title ?? "Document",
    typeLabel: it.credential?.type?.label ?? "",
    files: (it.credential?.files ?? [])
      .filter((f: any) => f.is_current)
      .map((f: any) => ({
        id: f.id,
        filename: f.filename,
        uploaded_at: f.uploaded_at,
        size_bytes: f.size_bytes,
      })),
  }));

  return {
    status: "ok",
    share: {
      id: share.id,
      ownerId: share.owner_id,
      requiresPasscode: !!share.passcode_hash,
      message: share.message,
      expiresAt: share.expires_at,
      recipientName: (share as any).recipient?.name ?? "",
      ownerName: settings?.full_name || "Chiron Anesthesia",
    },
    documents,
  };
}

/** Cookie name marking a share's passcode as satisfied for this browser. */
export function passcodeCookieName(shareId: string): string {
  return `portal_ok_${shareId}`;
}
