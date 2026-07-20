import type { CredentialStatus } from "./types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Whole days from today (UTC midnight) until the given date. Negative = past. */
export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00Z").getTime();
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return Math.round((target - todayUtc) / MS_PER_DAY);
}

/**
 * Derive a credential's status from its expiration date.
 *   none     — never expires
 *   expired  — expiration date has passed
 *   expiring — within `leadDays` of expiring
 *   current  — valid and outside the lead window
 */
export function deriveStatus(
  expirationDate: string | null,
  leadDays: number,
): CredentialStatus {
  const days = daysUntil(expirationDate);
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days <= leadDays) return "expiring";
  return "current";
}

export const STATUS_META: Record<
  CredentialStatus,
  { label: string; badge: string; dot: string }
> = {
  current: {
    label: "Current",
    badge: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-500",
  },
  expiring: {
    label: "Expiring soon",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  expired: {
    label: "Expired",
    badge: "bg-red-100 text-red-800 border-red-200",
    dot: "bg-red-500",
  },
  none: {
    label: "No expiry",
    badge: "bg-gray-100 text-gray-700 border-gray-200",
    dot: "bg-gray-400",
  },
};
