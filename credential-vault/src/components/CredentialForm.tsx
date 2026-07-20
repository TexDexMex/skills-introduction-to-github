"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import type { Credential, CredentialType } from "@/lib/types";

type ActionState = { error: string; ok?: boolean };
type Action = (prev: unknown, fd: FormData) => Promise<ActionState>;

const field =
  "w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

export function CredentialForm({
  action,
  types,
  defaults,
  showType = true,
  showFile = true,
  submitLabel = "Save credential",
}: {
  action: Action;
  types: CredentialType[];
  defaults?: Credential;
  showType?: boolean;
  showFile?: boolean;
  submitLabel?: string;
}) {
  const [state, formAction] = useFormState(action, { error: "" });

  return (
    <form action={formAction} className="space-y-5">
      {defaults?.id && <input type="hidden" name="id" value={defaults.id} />}
      <div className="grid gap-5 sm:grid-cols-2">
        {showType && (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">Type</label>
            <select
              name="type_id"
              required
              className={field}
              defaultValue={defaults?.type_id ?? ""}
            >
              <option value="" disabled>
                Select a credential type…
              </option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.category} — {t.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">Title</label>
          <input
            name="title"
            required
            defaultValue={defaults?.title ?? ""}
            placeholder="e.g. ACLS Provider Card"
            className={field}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">Issuing body</label>
          <input
            name="issuing_body"
            defaultValue={defaults?.issuing_body ?? ""}
            placeholder="e.g. American Heart Association"
            className={field}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Issue date</label>
          <input
            name="issue_date"
            type="date"
            defaultValue={defaults?.issue_date ?? ""}
            className={field}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Expiration date
          </label>
          <input
            name="expiration_date"
            type="date"
            defaultValue={defaults?.expiration_date ?? ""}
            className={field}
          />
          <p className="mt-1 text-xs text-gray-400">
            Leave blank if it does not expire.
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">Notes</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={defaults?.notes ?? ""}
            className={field}
          />
        </div>
        {showFile && (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">Document</label>
            <input
              name="file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.heic,.webp"
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-light file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand"
            />
            <p className="mt-1 text-xs text-gray-400">
              PDF or image, up to 25 MB.
            </p>
          </div>
        )}
      </div>

      {state?.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-green-600">Saved.</p>
      ) : null}

      <div className="flex items-center gap-3">
        <Submit label={submitLabel} />
        <Link href="/dashboard" className="text-sm text-gray-500 hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
