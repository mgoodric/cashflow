CREATE TABLE import_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'qif',
  filename TEXT NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_sessions_user_id ON import_sessions(user_id);

ALTER TABLE import_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own import sessions"
  ON import_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own import sessions"
  ON import_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own import sessions"
  ON import_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own import sessions"
  ON import_sessions FOR DELETE
  USING (auth.uid() = user_id);
