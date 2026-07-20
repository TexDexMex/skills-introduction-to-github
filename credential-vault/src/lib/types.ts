export type CredentialType = {
  id: string;
  label: string;
  category: string;
  recurring: boolean;
  default_valid_months: number | null;
  sort_order: number;
};

export type Credential = {
  id: string;
  owner_id: string;
  type_id: string;
  title: string;
  issuing_body: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CredentialFile = {
  id: string;
  credential_id: string;
  owner_id: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  version: number;
  is_current: boolean;
  uploaded_at: string;
};

export type Recipient = {
  id: string;
  owner_id: string;
  name: string;
  organization: string | null;
  email: string;
  created_at: string;
};

export type Share = {
  id: string;
  owner_id: string;
  recipient_id: string;
  access_token: string;
  message: string | null;
  passcode_hash: string | null;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

export type AuditEntry = {
  id: string;
  owner_id: string | null;
  actor_type: "owner" | "recipient" | "system";
  actor_label: string | null;
  action: string;
  share_id: string | null;
  credential_id: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export type Settings = {
  owner_id: string;
  full_name: string | null;
  reminder_lead_days: number;
  reminder_tiers: number[];
  updated_at: string;
};

export type CredentialStatus = "current" | "expiring" | "expired" | "none";
