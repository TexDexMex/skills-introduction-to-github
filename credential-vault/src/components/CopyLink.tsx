"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={url}
        className="w-full flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked; user can select manually */
          }
        }}
        className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
