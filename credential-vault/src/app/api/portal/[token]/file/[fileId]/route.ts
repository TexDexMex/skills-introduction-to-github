import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { loadShareByToken, passcodeCookieName } from "@/lib/portal";
import { logAudit } from "@/lib/audit";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "credentials";

/**
 * Recipient download. Authorizes in code: the token must resolve to a live
 * share, the passcode (if any) must be satisfied, and the requested file must
 * belong to a credential that is actually in this share.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string; fileId: string } },
) {
  const result = await loadShareByToken(params.token);
  if (result.status !== "ok") {
    return new NextResponse("This link is no longer active.", { status: 403 });
  }
  const { share } = result;

  if (share.requiresPasscode) {
    const ok = cookies().get(passcodeCookieName(share.id))?.value === "1";
    if (!ok) return new NextResponse("Passcode required.", { status: 403 });
  }

  const service = createSupabaseServiceClient();

  // The file must map to a credential included in THIS share.
  const { data: file } = await service
    .from("credential_files")
    .select("id, storage_path, filename, credential_id, owner_id")
    .eq("id", params.fileId)
    .maybeSingle();
  if (!file || file.owner_id !== share.ownerId) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { data: inShare } = await service
    .from("share_items")
    .select("id")
    .eq("share_id", share.id)
    .eq("credential_id", file.credential_id)
    .maybeSingle();
  if (!inShare) return new NextResponse("Not found", { status: 404 });

  const { data: signed, error } = await service.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path, 60, { download: file.filename });
  if (error || !signed) return new NextResponse("Error", { status: 500 });

  await logAudit(service, {
    ownerId: share.ownerId,
    actorType: "recipient",
    actorLabel: share.recipientName,
    action: "download",
    shareId: share.id,
    credentialId: file.credential_id,
    ip: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.redirect(signed.signedUrl);
}
