-- Isolated Guide schema. Not part of Shelfie/BoardView public tables.
-- Hosted on the org's existing Supabase project because the free plan
-- allows only two active projects. Data API does not expose this schema.

CREATE SCHEMA IF NOT EXISTS guide;

REVOKE ALL ON SCHEMA guide FROM PUBLIC;
REVOKE ALL ON SCHEMA guide FROM anon, authenticated;
GRANT USAGE ON SCHEMA guide TO postgres, service_role;

CREATE TABLE guide.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  phone text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guide_accounts_role_check CHECK (role = ANY (ARRAY['user'::text, 'tester'::text, 'admin'::text])),
  CONSTRAINT guide_accounts_username_len CHECK (char_length(trim(username)) >= 3),
  CONSTRAINT guide_accounts_phone_len CHECK (char_length(phone) >= 8)
);

CREATE UNIQUE INDEX guide_accounts_username_lower ON guide.accounts (lower(username));
CREATE UNIQUE INDEX guide_accounts_phone ON guide.accounts (phone);

CREATE TABLE guide.sessions (
  token_hash text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES guide.accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX guide_sessions_account_id ON guide.sessions (account_id);
CREATE INDEX guide_sessions_expires_at ON guide.sessions (expires_at);

CREATE TABLE guide.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES guide.accounts(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guide_tickets_status_check CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'closed'::text]))
);

CREATE INDEX guide_tickets_created_at ON guide.tickets (created_at DESC);
CREATE INDEX guide_tickets_account_id ON guide.tickets (account_id);

CREATE TABLE guide.training (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tester_id uuid NOT NULL REFERENCES guide.accounts(id) ON DELETE CASCADE,
  tester_username text NOT NULL,
  prompt text NOT NULL,
  ai_response text NOT NULL DEFAULT '',
  correction text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX guide_training_created_at ON guide.training (created_at DESC);
CREATE INDEX guide_training_tester_id ON guide.training (tester_id);

CREATE TABLE guide.settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE guide.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide.training ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide.settings ENABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA guide TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA guide TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA guide GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA guide GRANT ALL ON SEQUENCES TO postgres, service_role;

REVOKE ALL ON ALL TABLES IN SCHEMA guide FROM anon, authenticated, PUBLIC;
