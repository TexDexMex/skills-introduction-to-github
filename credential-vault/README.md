# Chiron Anesthesia — Credential Vault

A private web app for a CRNA to **store credentialing documents**, get **reminded before they expire**, and **securely distribute selected documents** to facilities and agencies through scoped, expiring, revocable, audit-logged links.

Built to deploy on **`ChironAnesthesia.health`**. The public marketing site on
`ChironAnesthesia.com` (Wix) is untouched.

---

## What it does

- **Vault** — one record per credential (ACLS, BLS, PALS, state license, national board cert, TB/PPD, vaccinations, malpractice, CV, diploma, case logs, W-9, work history, references, TSCA, driver's license). Each carries issue/expiration dates and one or more document files with **version history** — a renewal supersedes the old file but keeps it on record.
- **Dashboard** — every credential color-coded **current / expiring soon / expired**, with a "needs attention" list up top.
- **Expiration reminders** — a daily job emails you at **60 / 30 / 14 / 7 / 1 days** before anything lapses (lead time configurable in Settings). Each tier sends once per expiration date.
- **Secure distribution** — check the boxes for exactly which documents to release, pick a recipient, and generate a **secure portal link**. The recipient sees only those documents; the link **expires**, can be **revoked** instantly, can be gated by a **passcode**, and every view/download is written to an **audit log**. Nothing sensitive is emailed as an attachment.

## Tech stack

| Layer | Choice |
|---|---|
| App (owner UI + recipient portal + API) | Next.js 14 (App Router, TypeScript) |
| Database, auth, file storage | Supabase (Postgres + Row-Level Security + Storage) |
| Email | Resend |
| Hosting + cron | Vercel |
| Styling | Tailwind CSS |

### How security is enforced
- Every owner table has Row-Level Security so a signed-in user only sees their own rows.
- The document bucket is **private**. Files are only ever reached through short-lived signed URLs minted server-side **after** an authorization check.
- The recipient portal, reminder cron, and downloads run server-side with the service-role key and authorize in code (token + expiry + revocation + share-membership + passcode).
- Security headers (HSTS, X-Frame-Options, nosniff) are set on every response.

---

## Local setup

### 1. Create a Supabase project
At [supabase.com](https://supabase.com), create a project. Then in **Project Settings → API** collect:
- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)

### 2. Run the schema migration
Open **SQL Editor** in Supabase and run the contents of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
This creates all tables, RLS policies, the seeded credential types, and the
private `credentials` storage bucket.

### 3. Create your owner login
In **Authentication → Users → Add user**, create a user with your email and a
strong password (email confirmed). That is your single sign-in. (Public sign-up
is not exposed by the app.)

### 4. Configure email (Resend)
At [resend.com](https://resend.com), create an API key and verify a sending
domain (e.g. `chironanesthesia.health`). Set `RESEND_API_KEY`, `EMAIL_FROM`,
and `REMINDER_TO_EMAIL`. Without a key, the app runs fine and just logs emails
to the console instead of sending.

### 5. Environment variables
```bash
cp .env.example .env.local
# fill in the values from the steps above
```

### 6. Install & run
```bash
npm install
npm run dev
# open http://localhost:3000 and sign in
```

Test the reminder sweep locally:
```bash
curl http://localhost:3000/api/cron/check-expirations
```

---

## Deploy to `ChironAnesthesia.health`

1. Push this repo to GitHub and **import it into Vercel**. Set the project
   **Root Directory** to `credential-vault`.
2. Add every variable from `.env.example` in **Vercel → Settings → Environment
   Variables** (set `NEXT_PUBLIC_APP_URL=https://chironanesthesia.health`).
3. In **Vercel → Settings → Domains**, add `chironanesthesia.health` and follow
   Vercel's DNS instructions at your domain registrar (A / CNAME records). HTTPS
   is provisioned automatically.
4. The daily reminder cron is declared in [`vercel.json`](vercel.json)
   (`0 13 * * *` = 13:00 UTC). Vercel automatically sends `CRON_SECRET` as a
   bearer token, which the endpoint verifies — so set `CRON_SECRET` in Vercel.

---

## ⚠️ Before you put real documents in it

This app holds high-sensitivity data (SSN on the W-9, driver's license,
TB/vaccination records). Treat it like PHI:

- **Sign BAAs and enable the compliance tiers** with Supabase (HIPAA add-on),
  Vercel, and Resend before uploading real documents. The code is built for this
  posture, but the agreements are an account/billing step only you can do.
- Turn on **point-in-time recovery / backups** in Supabase.
- Use a password manager for the owner login; enable 2FA (see roadmap).

## Roadmap (Phase 4 hardening)

- TOTP two-factor authentication on the owner login (Supabase MFA).
- Application-layer field encryption for the most sensitive values (SSN/W-9) on
  top of Supabase's at-rest encryption.
- Optional watermarking of previewed documents.
- PWA "Add to Home Screen" for an app-like mobile experience.

## Project layout

```
credential-vault/
├─ supabase/migrations/0001_init.sql   # schema, RLS, seed, storage bucket
├─ src/
│  ├─ lib/            # supabase clients, status logic, audit, email, tokens, portal
│  ├─ components/     # UI (forms, badges, share builder, passcode gate)
│  └─ app/
│     ├─ login/                       # owner sign-in
│     ├─ (owner)/                     # authenticated area
│     │  ├─ dashboard/                # credential list + status
│     │  ├─ credentials/              # create / detail / upload / edit / delete
│     │  ├─ shares/                   # packet builder + management + revoke
│     │  └─ settings/                 # reminder lead time + profile
│     ├─ portal/[token]/              # recipient portal (token-scoped)
│     └─ api/
│        ├─ files/[id]                # owner signed downloads
│        ├─ portal/[token]/file/...   # recipient signed downloads
│        └─ cron/check-expirations    # daily reminder sweep
└─ middleware.ts                      # session refresh + route guard
```
