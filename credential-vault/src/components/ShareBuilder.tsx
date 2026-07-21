"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createShare } from "@/app/(owner)/shares/actions";
import { StatusBadge } from "./StatusBadge";
import type { CredentialStatus } from "@/lib/types";

const field =
  "w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand";

type Recipient = {
  id: string;
  name: string;
  organization: string | null;
  email: string;
};
type Cred = {
  id: string;
  title: string;
  typeLabel: string;
  status: CredentialStatus;
};

function Submit({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || count === 0}
      className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
    >
      {pending
        ? "Sending…"
        : `Create secure link${count ? ` (${count})` : ""}`}
    </button>
  );
}

export function ShareBuilder({
  recipients,
  credentials,
}: {
  recipients: Recipient[];
  credentials: Cred[];
}) {
  const [state, formAction] = useFormState(createShare, { error: "" });
  const [recipientId, setRecipientId] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <form action={formAction} className="space-y-6">
      {/* Recipient */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Recipient</h3>
        <select
          name="recipient_id"
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          className={field}
        >
          <option value="">+ New recipient</option>
          {recipients.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {r.organization ? ` · ${r.organization}` : ""} ({r.email})
            </option>
          ))}
        </select>
        {recipientId === "" && (
          <div className="mt-3 grid gap-3 rounded-md bg-gray-50 p-3 sm:grid-cols-2">
            <input name="new_name" placeholder="Contact name" className={field} />
            <input name="new_org" placeholder="Organization" className={field} />
            <input
              name="new_email"
              type="email"
              placeholder="Email"
              className={`${field} sm:col-span-2`}
            />
          </div>
        )}
      </div>

      {/* Documents */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">
          Documents to include ({checked.size})
        </h3>
        {credentials.length === 0 ? (
          <p className="text-sm text-gray-400">
            No credentials to share yet. Add some first.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
            {credentials.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    name="credential_ids"
                    value={c.id}
                    checked={checked.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                  />
                  <span className="flex-1">
                    <span className="font-medium">{c.title}</span>
                    <span className="ml-2 text-xs text-gray-400">
                      {c.typeLabel}
                    </span>
                  </span>
                  <StatusBadge status={c.status} />
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Options */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Link expires in</label>
          <select name="expires_in_days" defaultValue="14" className={field}>
            <option value="3">3 days</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Passcode <span className="text-gray-400">(optional)</span>
          </label>
          <input
            name="passcode"
            placeholder="Share separately from the link"
            className={field}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">
            Message <span className="text-gray-400">(optional)</span>
          </label>
          <textarea name="message" rows={2} className={field} />
        </div>
      </div>

      {state?.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}

      <Submit count={checked.size} />
    </form>
  );
}
