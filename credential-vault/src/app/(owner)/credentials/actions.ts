"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "credentials";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB per file

function str(fd: FormData, key: string): string {
  return String(fd.get(key) || "").trim();
}
function nullableDate(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v || null;
}

/**
 * Upload a file into the private bucket and record it as the current version
 * of a credential, superseding any prior current file. Runs with the service
 * client (server-only) so no public storage access is ever granted.
 */
async function storeFile(
  ownerId: string,
  credentialId: string,
  file: File,
): Promise<void> {
  if (file.size === 0) return;
  if (file.size > MAX_BYTES) {
    throw new Error("File exceeds the 25 MB limit.");
  }
  const service = createSupabaseServiceClient();

  const { data: existing } = await service
    .from("credential_files")
    .select("version")
    .eq("credential_id", credentialId)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = (existing?.[0]?.version ?? 0) + 1;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${ownerId}/${credentialId}/v${nextVersion}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await service.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  // New upload becomes the current version; demote older ones.
  await service
    .from("credential_files")
    .update({ is_current: false })
    .eq("credential_id", credentialId);

  await service.from("credential_files").insert({
    credential_id: credentialId,
    owner_id: ownerId,
    storage_path: path,
    filename: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    version: nextVersion,
    is_current: true,
  });
}

export async function createCredential(_prev: unknown, formData: FormData) {
  const { user, supabase } = await requireUser();
  const typeId = str(formData, "type_id");
  const title = str(formData, "title");
  if (!typeId || !title) {
    return { error: "Type and title are required." };
  }

  const { data: cred, error } = await supabase
    .from("credentials")
    .insert({
      owner_id: user.id,
      type_id: typeId,
      title,
      issuing_body: str(formData, "issuing_body") || null,
      issue_date: nullableDate(formData, "issue_date"),
      expiration_date: nullableDate(formData, "expiration_date"),
      notes: str(formData, "notes") || null,
    })
    .select("id")
    .single();
  if (error || !cred) {
    return { error: error?.message || "Could not create credential." };
  }

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    try {
      await storeFile(user.id, cred.id, file);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  await logAudit(supabase, {
    ownerId: user.id,
    actorType: "owner",
    actorLabel: user.email,
    action: "credential_created",
    credentialId: cred.id,
  });

  revalidatePath("/dashboard");
  redirect(`/credentials/${cred.id}`);
}

export async function updateCredential(_prev: unknown, formData: FormData) {
  const { user, supabase } = await requireUser();
  const id = str(formData, "id");
  if (!id) return { error: "Missing credential id." };

  const { error } = await supabase
    .from("credentials")
    .update({
      title: str(formData, "title"),
      issuing_body: str(formData, "issuing_body") || null,
      issue_date: nullableDate(formData, "issue_date"),
      expiration_date: nullableDate(formData, "expiration_date"),
      notes: str(formData, "notes") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/credentials/${id}`);
  revalidatePath("/dashboard");
  return { error: "", ok: true };
}

/** Upload a renewal / additional file to an existing credential. */
export async function uploadVersion(_prev: unknown, formData: FormData) {
  const { user, supabase } = await requireUser();
  const id = str(formData, "id");
  const file = formData.get("file");
  if (!id || !(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  try {
    await storeFile(user.id, id, file);
  } catch (e) {
    return { error: (e as Error).message };
  }
  await logAudit(supabase, {
    ownerId: user.id,
    actorType: "owner",
    actorLabel: user.email,
    action: "file_uploaded",
    credentialId: id,
  });
  revalidatePath(`/credentials/${id}`);
  return { error: "", ok: true };
}

export async function deleteCredential(formData: FormData) {
  const { user, supabase } = await requireUser();
  const id = String(formData.get("id") || "");
  if (!id) return;

  // Remove stored files first (service client), then the row (cascades).
  const service = createSupabaseServiceClient();
  const { data: files } = await service
    .from("credential_files")
    .select("storage_path")
    .eq("credential_id", id)
    .eq("owner_id", user.id);
  if (files?.length) {
    await service.storage.from(BUCKET).remove(files.map((f) => f.storage_path));
  }
  await supabase.from("credentials").delete().eq("id", id);
  await logAudit(supabase, {
    ownerId: user.id,
    actorType: "owner",
    actorLabel: user.email,
    action: "credential_deleted",
  });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
