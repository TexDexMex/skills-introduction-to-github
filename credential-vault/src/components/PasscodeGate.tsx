"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitPasscode } from "@/app/portal/[token]/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
    >
      {pending ? "Checking…" : "Unlock documents"}
    </button>
  );
}

export function PasscodeGate({ token }: { token: string }) {
  const [state, formAction] = useFormState(submitPasscode, { error: "" });
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="mb-1 block text-sm font-medium">Passcode</label>
        <input
          name="passcode"
          type="password"
          autoFocus
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
        <p className="mt-1 text-xs text-gray-400">
          Provided to you separately by the sender.
        </p>
      </div>
      {state?.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      <Submit />
    </form>
  );
}
