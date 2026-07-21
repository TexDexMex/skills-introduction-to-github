import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditInput = {
  ownerId: string | null;
  actorType: "owner" | "recipient" | "system";
  actorLabel?: string | null;
  action: string;
  shareId?: string | null;
  credentialId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Append an entry to the audit log. Accepts any Supabase client; recipient and
 * cron actions pass a service-role client since they have no user session.
 * Never throws into the caller — a failed audit write must not break a download.
 */
export async function logAudit(client: SupabaseClient, input: AuditInput) {
  try {
    await client.from("audit_log").insert({
      owner_id: input.ownerId,
      actor_type: input.actorType,
      actor_label: input.actorLabel ?? null,
      action: input.action,
      share_id: input.shareId ?? null,
      credential_id: input.credentialId ?? null,
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
    });
  } catch (err) {
    console.error("audit log write failed", err);
  }
}
