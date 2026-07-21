"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveSettings } from "@/app/(owner)/settings/actions";

const field =
  "w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save settings"}
    </button>
  );
}

export function SettingsForm({
  defaults,
}: {
  defaults: { full_name: string; reminder_lead_days: number };
}) {
  const [state, formAction] = useFormState(saveSettings, { error: "" });
  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium">Full name</label>
        <input
          name="full_name"
          defaultValue={defaults.full_name}
          placeholder="Shown to recipients on shared packets"
          className={field}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">
          Reminder lead time (days)
        </label>
        <input
          name="reminder_lead_days"
          type="number"
          min={1}
          max={365}
          defaultValue={defaults.reminder_lead_days}
          className={field}
        />
        <p className="mt-1 text-xs text-gray-400">
          Credentials within this many days of expiring show as “expiring soon”.
        </p>
      </div>
      {state?.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      {state?.ok ? <p className="text-sm text-green-600">Saved.</p> : null}
      <Submit />
    </form>
  );
}
