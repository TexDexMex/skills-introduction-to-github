import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "credentials";

/**
 * Owner download. The user client (RLS) confirms the file belongs to the
 * signed-in owner, then a short-lived signed URL is minted server-side.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: file } = await supabase
    .from("credential_files")
    .select("storage_path, filename, credential_id, owner_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!file) return new NextResponse("Not found", { status: 404 });

  const service = createSupabaseServiceClient();
  const { data: signed, error } = await service.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path, 60, { download: file.filename });
  if (error || !signed) return new NextResponse("Error", { status: 500 });

  await logAudit(supabase, {
    ownerId: user.id,
    actorType: "owner",
    actorLabel: user.email,
    action: "download",
    credentialId: file.credential_id,
    ip: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.redirect(signed.signedUrl);
}
