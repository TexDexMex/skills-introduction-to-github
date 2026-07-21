import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM || "credentials@chironanesthesia.health";

const resend = apiKey ? new Resend(apiKey) : null;

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    // No email provider configured (e.g. local dev). Log instead of failing.
    console.warn(`[email disabled] would send "${subject}" to ${to}`);
    return { skipped: true };
  }
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) {
    console.error("email send failed", error);
    throw new Error(error.message);
  }
  return { skipped: false };
}

const shell = (body: string) => `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
    <div style="background:#0d5c63;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0;font-weight:600">
      Chiron Anesthesia · Credentials
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px">
      ${body}
    </div>
  </div>`;

/** Reminder to the owner that a credential is approaching expiry. */
export function sendExpirationReminder(opts: {
  to: string;
  items: { title: string; expiration: string; daysLeft: number }[];
  appUrl: string;
}) {
  const rows = opts.items
    .map(
      (i) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0">${i.title}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:#b45309;font-weight:600">
          ${i.daysLeft} day${i.daysLeft === 1 ? "" : "s"} (${i.expiration})
        </td>
      </tr>`,
    )
    .join("");
  const body = `
    <p>The following credential${opts.items.length === 1 ? " is" : "s are"} approaching expiration:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">${rows}</table>
    <a href="${opts.appUrl}/dashboard"
       style="display:inline-block;background:#0d5c63;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px">
      Open credential vault
    </a>`;
  return send(
    opts.to,
    `Credential expiration reminder (${opts.items.length})`,
    shell(body),
  );
}

/** Invite a recipient to the secure portal for a specific share. */
export function sendShareInvite(opts: {
  to: string;
  recipientName: string;
  ownerName: string;
  portalUrl: string;
  expiresAt: string;
  hasPasscode: boolean;
  message?: string | null;
}) {
  const body = `
    <p>Hello ${opts.recipientName},</p>
    <p>${opts.ownerName} has shared credentialing documents with you through a secure portal.</p>
    ${opts.message ? `<p style="background:#f8fafc;border-left:3px solid #0d5c63;padding:8px 12px;margin:12px 0">${opts.message}</p>` : ""}
    <p style="margin:20px 0">
      <a href="${opts.portalUrl}"
         style="display:inline-block;background:#0d5c63;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px">
        View secure documents
      </a>
    </p>
    <p style="color:#6b7280;font-size:13px">
      This link expires on ${opts.expiresAt}.${opts.hasPasscode ? " A passcode is required — it will be provided to you separately." : ""}
      Access is logged. Do not forward this link.
    </p>`;
  return send(opts.to, `${opts.ownerName} shared credentials with you`, shell(body));
}
