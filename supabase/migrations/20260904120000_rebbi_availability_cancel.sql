-- Rebbi availability and cancelled learning requests.

ALTER TABLE guide.accounts
  ADD COLUMN IF NOT EXISTS accepting_students boolean NOT NULL DEFAULT true;

ALTER TABLE guide.learning_requests
  DROP CONSTRAINT IF EXISTS guide_learning_requests_status_check;

ALTER TABLE guide.learning_requests
  ADD CONSTRAINT guide_learning_requests_status_check
  CHECK (status = ANY (ARRAY['open'::text, 'claimed'::text, 'closed'::text, 'cancelled'::text]));
