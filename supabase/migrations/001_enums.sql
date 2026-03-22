-- Account type enum
CREATE TYPE account_type AS ENUM ('checking', 'savings', 'credit', 'loan', 'investment');

-- Event type enum
CREATE TYPE event_type AS ENUM ('income', 'expense');
