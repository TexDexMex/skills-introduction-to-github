-- =============================================================================
-- CRNA Credential Vault — initial schema
-- =============================================================================
-- Design notes:
--   * Every owner-scoped table carries owner_id and is protected by Row-Level
--     Security so a signed-in user can only ever touch their own rows. The app
--     is single-owner today but this makes multi-user a config change, not a
--     rewrite.
--   * The recipient portal, the reminder cron, and signed downloads run on the
--     server with the service-role key (which bypasses RLS). Those paths do
--     their own authorization in code (token + expiry + revocation checks), so
--     no anon/authenticated access to storage is granted here.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Lookup: the kinds of credentials a CRNA tracks.
-- recurring = renews on a schedule (drives expiration reminders).
-- ---------------------------------------------------------------------------
create table if not exists credential_types (
  id                   text primary key,          -- slug, e.g. 'acls'
  label                text not null,
  category             text not null,             -- grouping for the UI
  recurring            boolean not null default false,
  default_valid_months integer,                   -- typical validity, prefills expiry
  sort_order           integer not null default 100
);

insert into credential_types (id, label, category, recurring, default_valid_months, sort_order) values
  ('drivers_license', 'Driver''s License',                'Identity',       true,  48, 10),
  ('state_license',   'State Licensure Verification',     'Licensure',      true,  24, 20),
  ('national_cert',   'National Board Certification (NBCRNA)', 'Licensure',  true,  48, 30),
  ('acls',            'ACLS Certification',               'Life Support',   true,  24, 40),
  ('bls',             'BLS Certification',                'Life Support',   true,  24, 50),
  ('pals',            'PALS Certification',               'Life Support',   true,  24, 60),
  ('tb_ppd',          'TB / PPD Test',                    'Health',         true,  12, 70),
  ('vaccination',     'Vaccination Records',              'Health',         false, null, 80),
  ('malpractice',     'Malpractice Insurance Verification','Insurance',     true,  12, 90),
  ('cv',              'Curriculum Vitae',                 'Professional',   false, null, 100),
  ('diploma',         'Diploma',                          'Professional',   false, null, 110),
  ('case_logs',       'Case Logs',                        'Professional',   false, null, 120),
  ('work_history',    'Work History',                     'Professional',   false, null, 130),
  ('references',      'Work References',                  'Professional',   false, null, 140),
  ('w9',              'W-9',                              'Financial',      false, null, 150),
  ('tsca',            'TSCA',                             'Professional',   false, null, 160)
on conflict (id) do nothing;

alter table credential_types enable row level security;
create policy "credential_types readable by authenticated"
  on credential_types for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Credentials — one row per credential the owner holds.
-- ---------------------------------------------------------------------------
create table if not exists credentials (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users (id) on delete cascade,
  type_id         text not null references credential_types (id),
  title           text not null,
  issuing_body    text,
  issue_date      date,
  expiration_date date,                            -- null = does not expire
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists credentials_owner_idx on credentials (owner_id);
create index if not exists credentials_expiration_idx on credentials (expiration_date);

-- ---------------------------------------------------------------------------
-- Credential files — supports multiple files per credential and full version
-- history. Uploading a renewal marks the new file current and keeps the old.
-- ---------------------------------------------------------------------------
create table if not exists credential_files (
  id            uuid primary key default gen_random_uuid(),
  credential_id uuid not null references credentials (id) on delete cascade,
  owner_id      uuid not null references auth.users (id) on delete cascade,
  storage_path  text not null,                     -- path inside the private bucket
  filename      text not null,
  mime_type     text,
  size_bytes    bigint,
  version       integer not null default 1,
  is_current    boolean not null default true,
  uploaded_at   timestamptz not null default now()
);
create index if not exists credential_files_credential_idx on credential_files (credential_id);

-- ---------------------------------------------------------------------------
-- Recipients — facilities / agencies you send credentials to.
-- ---------------------------------------------------------------------------
create table if not exists recipients (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  name         text not null,
  organization text,
  email        text not null,
  created_at   timestamptz not null default now()
);
create index if not exists recipients_owner_idx on recipients (owner_id);

-- ---------------------------------------------------------------------------
-- Shares — a "packet" released to one recipient. access_token is the secret
-- in the portal URL; the packet is live until expires_at unless revoked.
-- ---------------------------------------------------------------------------
create table if not exists shares (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  recipient_id  uuid not null references recipients (id) on delete restrict,
  access_token  text not null unique,
  message       text,
  passcode_hash text,                              -- optional extra gate
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists shares_owner_idx on shares (owner_id);
create index if not exists shares_token_idx on shares (access_token);

-- The specific credentials included in a share (the checked-off boxes).
create table if not exists share_items (
  id            uuid primary key default gen_random_uuid(),
  share_id      uuid not null references shares (id) on delete cascade,
  credential_id uuid not null references credentials (id) on delete cascade,
  unique (share_id, credential_id)
);

-- ---------------------------------------------------------------------------
-- Reminder log — prevents sending the same tier twice for the same expiry.
-- Includes expiration_date so a renewal (new expiry) re-arms all tiers.
-- ---------------------------------------------------------------------------
create table if not exists reminder_log (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users (id) on delete cascade,
  credential_id   uuid not null references credentials (id) on delete cascade,
  expiration_date date not null,
  tier_days       integer not null,
  sent_at         timestamptz not null default now(),
  unique (credential_id, expiration_date, tier_days)
);

-- ---------------------------------------------------------------------------
-- Audit log — every view/download/share/revoke, by owner or recipient.
-- ---------------------------------------------------------------------------
create table if not exists audit_log (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid references auth.users (id) on delete set null,
  actor_type    text not null,                     -- 'owner' | 'recipient' | 'system'
  actor_label   text,                              -- email / recipient name / 'cron'
  action        text not null,                     -- 'view' | 'download' | 'share_created' | 'share_revoked' | ...
  share_id      uuid references shares (id) on delete set null,
  credential_id uuid references credentials (id) on delete set null,
  ip            text,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index if not exists audit_log_owner_idx on audit_log (owner_id, created_at desc);
create index if not exists audit_log_share_idx on audit_log (share_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Per-owner settings.
-- ---------------------------------------------------------------------------
create table if not exists settings (
  owner_id           uuid primary key references auth.users (id) on delete cascade,
  full_name          text,
  reminder_lead_days integer not null default 60,
  reminder_tiers     integer[] not null default '{60,30,14,7,1}',
  updated_at         timestamptz not null default now()
);

-- ===========================================================================
-- Row-Level Security: owner can only touch their own rows.
-- ===========================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'credentials','credential_files','recipients','shares',
    'reminder_log','audit_log','settings'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format($f$
      create policy "owner_all_%1$s" on %1$I
      for all to authenticated
      using (owner_id = auth.uid())
      with check (owner_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- share_items has no owner_id column; scope it through its parent share.
alter table share_items enable row level security;
create policy "owner_all_share_items" on share_items
  for all to authenticated
  using (exists (select 1 from shares s where s.id = share_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from shares s where s.id = share_id and s.owner_id = auth.uid()));

-- ===========================================================================
-- Private storage bucket for the actual documents.
-- No anon/authenticated object policies are created: all reads/writes go
-- through server code using the service-role key, which enforces authz itself.
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('credentials', 'credentials', false)
on conflict (id) do nothing;
