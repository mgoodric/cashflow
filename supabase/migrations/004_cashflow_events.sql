CREATE TABLE cashflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  event_type event_type NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  event_date DATE NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule JSONB,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cashflow_events_user_id ON cashflow_events(user_id);
CREATE INDEX idx_cashflow_events_account_id ON cashflow_events(account_id);
CREATE INDEX idx_cashflow_events_event_date ON cashflow_events(event_date);

ALTER TABLE cashflow_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events"
  ON cashflow_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events"
  ON cashflow_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events"
  ON cashflow_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own events"
  ON cashflow_events FOR DELETE
  USING (auth.uid() = user_id);
