-- Rebbi applications, learning requests, and messages when no Rebbeim are available.

ALTER TABLE guide.accounts
  DROP CONSTRAINT IF EXISTS guide_accounts_role_check;

ALTER TABLE guide.accounts
  ADD CONSTRAINT guide_accounts_role_check
  CHECK (role = ANY (ARRAY['user'::text, 'tester'::text, 'admin'::text, 'rabbi'::text]));

ALTER TABLE guide.accounts
  ADD COLUMN IF NOT EXISTS rabbi_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS rabbi_display_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rabbi_bio text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rabbi_answers jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE guide.accounts
  DROP CONSTRAINT IF EXISTS guide_accounts_rabbi_status_check;

ALTER TABLE guide.accounts
  ADD CONSTRAINT guide_accounts_rabbi_status_check
  CHECK (rabbi_status = ANY (ARRAY['none'::text, 'pending'::text, 'approved'::text, 'rejected'::text]));

CREATE TABLE IF NOT EXISTS guide.learning_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES guide.accounts(id) ON DELETE CASCADE,
  rabbi_id uuid REFERENCES guide.accounts(id) ON DELETE SET NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guide_learning_requests_status_check
    CHECK (status = ANY (ARRAY['open'::text, 'claimed'::text, 'closed'::text])),
  CONSTRAINT guide_learning_requests_message_len
    CHECK (char_length(trim(message)) >= 3)
);

CREATE INDEX IF NOT EXISTS guide_learning_requests_status_created
  ON guide.learning_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS guide_learning_requests_student
  ON guide.learning_requests (student_id);
CREATE INDEX IF NOT EXISTS guide_learning_requests_rabbi
  ON guide.learning_requests (rabbi_id);

CREATE TABLE IF NOT EXISTS guide.rabbi_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES guide.accounts(id) ON DELETE SET NULL,
  name text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guide_rabbi_messages_status_check
    CHECK (status = ANY (ARRAY['open'::text, 'closed'::text])),
  CONSTRAINT guide_rabbi_messages_message_len
    CHECK (char_length(trim(message)) >= 3)
);

CREATE INDEX IF NOT EXISTS guide_rabbi_messages_created
  ON guide.rabbi_messages (created_at DESC);

ALTER TABLE guide.learning_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide.rabbi_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY guide_learning_requests_no_direct ON guide.learning_requests
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY guide_rabbi_messages_no_direct ON guide.rabbi_messages
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

GRANT ALL ON TABLE guide.learning_requests TO postgres, service_role;
GRANT ALL ON TABLE guide.rabbi_messages TO postgres, service_role;
REVOKE ALL ON TABLE guide.learning_requests FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE guide.rabbi_messages FROM anon, authenticated, PUBLIC;
