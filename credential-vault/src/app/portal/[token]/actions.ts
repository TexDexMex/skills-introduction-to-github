"use server";

import { cookies } from "next/headers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { verifyPasscode } from "@/lib/tokens";
import { passcodeCookieName } from "@/lib/portal";

export async function submitPasscode(_prev: unknown, formData: FormData) {
  const token = String(formData.get("token") || "");
  const passcode = String(formData.get("passcode") || "");
  if (!token || !passcode) return { error: "Enter the passcode." };

  const service = createSupabaseServiceClient();
  const { data: share } = await service
    .from("shares")
    .select("id, passcode_hash, expires_at, revoked_at")
    .eq("access_token", token)
    .maybeSingle();

  if (!share || share.revoked_at || new Date(share.expires_at) < new Date()) {
    return { error: "This link is no longer active." };
  }
  if (!share.passcode_hash || !verifyPasscode(passcode, share.passcode_hash)) {
    return { error: "Incorrect passcode." };
  }

  const maxAge = Math.max(
    60,
    Math.floor((new Date(share.expires_at).getTime() - Date.now()) / 1000),
  );
  cookies().set(passcodeCookieName(share.id), "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: `/portal/${token}`,
    maxAge,
  });

  return { error: "", ok: true };
}
