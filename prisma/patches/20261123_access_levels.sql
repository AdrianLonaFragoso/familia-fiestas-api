-- Migración aditiva de accesos; conserva ADMIN_API_KEY como superusuario inicial.
DO $$ BEGIN
CREATE TABLE IF NOT EXISTS access_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name varchar(120) NOT NULL,email varchar(160),is_active boolean NOT NULL DEFAULT true,created_at timestamptz(6) NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS access_keys (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES access_accounts(id) ON DELETE CASCADE,digest varchar(64) NOT NULL UNIQUE,prefix varchar(16) NOT NULL,created_at timestamptz(6) NOT NULL DEFAULT now(),revoked_at timestamptz(6));
CREATE INDEX IF NOT EXISTS access_keys_account_id_idx ON access_keys(account_id);
CREATE TABLE IF NOT EXISTS account_events (account_id uuid NOT NULL REFERENCES access_accounts(id) ON DELETE CASCADE,event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,PRIMARY KEY(account_id,event_id));
CREATE INDEX IF NOT EXISTS account_events_event_id_idx ON account_events(event_id);
ALTER TABLE families ADD COLUMN IF NOT EXISTS created_by_account_id uuid;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS created_by_account_id uuid;
END $$;
