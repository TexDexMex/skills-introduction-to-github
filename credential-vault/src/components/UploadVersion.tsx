"use client";

import { useFormState, useFormStatus } from "react-dom";
import { uploadVersion } from "@/app/(owner)/credentials/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
    >
      {pending ? "Uploading…" : "Upload new version"}
    </button>
  );
}

export function UploadVersion({ credentialId }: { credentialId: string }) {
  const [state, formAction] = useFormState(uploadVersion, { error: "" });
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={credentialId} />
      <input
        name="file"
        type="file"
        required
        accept=".pdf,.png,.jpg,.jpeg,.heic,.webp"
        className="block text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-light file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand"
      />
      <Submit />
      {state?.error ? (
        <span className="text-sm text-red-600">{state.error}</span>
      ) : null}
      {state?.ok ? (
        <span className="text-sm text-green-600">Uploaded.</span>
      ) : null}
    </form>
  );
}
