"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { generateAccessToken, hashPasscode } from "@/lib/tokens";
import { sendShareInvite } from "@/lib/email";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function createShare(_prev: unknown, formData: FormData) {
  const { user, supabase } = await requireUser();

  const credentialIds = formData.getAll("credential_ids").map(String).filter(Boolean);
  if (credentialIds.length === 0) {
    return { error: "Select at least one credential to send." };
  }

  // Resolve recipient: existing selection or a new one.
  let recipientId = String(formData.get("recipient_id") || "").trim();
  if (!recipientId) {
    const name = String(formData.get("new_name") || "").trim();
    const email = String(formData.get("new_email") || "").trim();
    if (!name || !email) {
      return { error: "Choose a recipient or enter a new name and email." };
    }
    const { data: rec, error: recErr } = await supabase
      .from("recipients")
      .insert({
        owner_id: user.id,
        name,
        email,
        organization: String(formData.get("new_org") || "").trim() || null,
      })
      .select("id")
      .single();
    if (recErr || !rec) return { error: recErr?.message || "Could not add recipient." };
    recipientId = rec.id;
  }

  const days = parseInt(String(formData.get("expires_in_days") || "14"), 10);
  const expiresAt = new Date(
    Date.now() + (isNaN(days) ? 14 : days) * 86400000,
  ).toISOString();

  const passcodeRaw = String(formData.get("passcode") || "").trim();
  const token = generateAccessToken();

  const { data: share, error: shareErr } = await supabase
    .from("shares")
    .insert({
      owner_id: user.id,
      recipient_id: recipientId,
      access_token: token,
      message: String(formData.get("message") || "").trim() || null,
      passcode_hash: passcodeRaw ? hashPasscode(passcodeRaw) : null,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (shareErr || !share) return { error: shareErr?.message || "Could not create share." };

  const items = credentialIds.map((cid) => ({
    share_id: share.id,
    credential_id: cid,
  }));
  const { error: itemsErr } = await supabase.from("share_items").insert(items);
  if (itemsErr) return { error: itemsErr.message };

  // Send the invite (best-effort; a mail failure shouldn't discard the share).
  const { data: recipient } = await supabase
    .from("recipients")
    .select("name, email")
    .eq("id", recipientId)
    .single();
  const { data: settings } = await supabase
    .from("settings")
    .select("full_name")
    .eq("owner_id", user.id)
    .maybeSingle();

  try {
    if (recipient) {
      await sendShareInvite({
        to: recipient.email,
        recipientName: recipient.name,
        ownerName: settings?.full_name || "Chiron Anesthesia",
        portalUrl: `${appUrl()}/portal/${token}`,
        expiresAt: new Date(expiresAt).toLocaleDateString("en-US", {
          dateStyle: "medium",
        } as Intl.DateTimeFormatOptions),
        hasPasscode: !!passcodeRaw,
        message: String(formData.get("message") || "") || null,
      });
    }
  } catch (e) {
    console.error("invite email failed", e);
  }

  await logAudit(supabase, {
    ownerId: user.id,
    actorType: "owner",
    actorLabel: user.email,
    action: "share_created",
    shareId: share.id,
  });

  revalidatePath("/shares");
  redirect(`/shares/${share.id}`);
}

export async function revokeShare(formData: FormData) {
  const { user, supabase } = await requireUser();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await supabase
    .from("shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  await logAudit(supabase, {
    ownerId: user.id,
    actorType: "owner",
    actorLabel: user.email,
    action: "share_revoked",
    shareId: id,
  });
  revalidatePath("/shares");
  revalidatePath(`/shares/${id}`);
}
