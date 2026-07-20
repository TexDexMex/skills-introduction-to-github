import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { daysUntil } from "@/lib/status";
import { sendExpirationReminder } from "@/lib/email";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_TIERS = [60, 30, 14, 7, 1];

/**
 * Daily reminder sweep (invoked by Vercel Cron). For each owner, finds
 * credentials whose expiration has entered a reminder tier and emails a single
 * digest. Each (credential, expiration, tier) is logged so it fires only once;
 * on the first crossing into a window only the tightest tier sends, and larger
 * tiers are marked handled to avoid a burst.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const service = createSupabaseServiceClient();
  const reminderTo = process.env.REMINDER_TO_EMAIL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Owners with at least a settings row; fall back to scanning all credentials.
  const { data: owners } = await service
    .from("settings")
    .select("owner_id, reminder_tiers");
  const ownerRows =
    owners && owners.length > 0
      ? owners
      : await service
          .from("credentials")
          .select("owner_id")
          .then((r) => {
            const ids = new Set((r.data ?? []).map((c: any) => c.owner_id));
            return Array.from(ids).map((id) => ({
              owner_id: id,
              reminder_tiers: DEFAULT_TIERS,
            }));
          });

  let emailsSent = 0;
  let remindersLogged = 0;

  for (const owner of ownerRows) {
    const tiers = (owner.reminder_tiers?.length
      ? owner.reminder_tiers
      : DEFAULT_TIERS) as number[];

    const { data: creds } = await service
      .from("credentials")
      .select("id, title, expiration_date")
      .eq("owner_id", owner.owner_id)
      .not("expiration_date", "is", null);

    const dueItems: { title: string; expiration: string; daysLeft: number }[] = [];
    const logRows: {
      owner_id: string;
      credential_id: string;
      expiration_date: string;
      tier_days: number;
    }[] = [];

    for (const c of creds ?? []) {
      const days = daysUntil(c.expiration_date);
      if (days === null || days < 0) continue;

      const applicable = tiers.filter((t) => days <= t);
      if (applicable.length === 0) continue;
      const tightest = Math.min(...applicable);

      const { data: already } = await service
        .from("reminder_log")
        .select("id")
        .eq("credential_id", c.id)
        .eq("expiration_date", c.expiration_date)
        .eq("tier_days", tightest)
        .maybeSingle();
      if (already) continue;

      dueItems.push({
        title: c.title,
        expiration: formatDate(c.expiration_date),
        daysLeft: days,
      });
      // Suppress this tier and every larger (already-passed) tier.
      for (const t of applicable) {
        logRows.push({
          owner_id: owner.owner_id,
          credential_id: c.id,
          expiration_date: c.expiration_date,
          tier_days: t,
        });
      }
    }

    if (dueItems.length === 0) continue;

    if (reminderTo) {
      try {
        await sendExpirationReminder({ to: reminderTo, items: dueItems, appUrl });
        emailsSent++;
      } catch (e) {
        console.error("reminder email failed", e);
        continue; // don't log as sent if the email failed
      }
    }

    if (logRows.length > 0) {
      await service
        .from("reminder_log")
        .upsert(logRows, {
          onConflict: "credential_id,expiration_date,tier_days",
          ignoreDuplicates: true,
        });
      remindersLogged += logRows.length;
    }
  }

  return NextResponse.json({
    ok: true,
    emailsSent,
    remindersLogged,
    ranAt: new Date().toISOString(),
  });
}
