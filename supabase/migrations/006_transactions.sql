CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  import_session_id UUID REFERENCES import_sessions(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- Core transaction data
  transaction_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  payee TEXT,
  payee_normalized TEXT,
  memo TEXT,
  check_number TEXT,

  -- Classification
  transaction_type TEXT NOT NULL DEFAULT 'expense',
  source TEXT NOT NULL DEFAULT 'qif',

  -- Linkage
  event_id UUID REFERENCES cashflow_events(id) ON DELETE SET NULL,
  suggested_event_id UUID REFERENCES cashflow_events(id) ON DELETE SET NULL,

  -- Reconciliation
  is_cleared BOOLEAN NOT NULL DEFAULT false,

  -- Audit
  original_category TEXT,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  flag_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_payee_normalized ON transactions(payee_normalized);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_import_session ON transactions(import_session_id);
CREATE INDEX idx_transactions_event_id ON transactions(event_id);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id);
