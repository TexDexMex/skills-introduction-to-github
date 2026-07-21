import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { CredentialForm } from "@/components/CredentialForm";
import { createCredential } from "../actions";
import type { CredentialType } from "@/lib/types";

export default async function NewCredentialPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("credential_types")
    .select("*")
    .order("sort_order");
  const types = (data ?? []) as CredentialType[];

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard" className="text-sm text-gray-500 hover:underline">
        ← Back
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-semibold">Add credential</h1>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <CredentialForm action={createCredential} types={types} />
      </div>
    </div>
  );
}
