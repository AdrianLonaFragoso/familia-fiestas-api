-- Aditivo e idempotente: las cuentas actuales siguen siendo anfitriones.
DO $$ BEGIN
ALTER TABLE access_accounts ADD COLUMN IF NOT EXISTS role varchar(20) NOT NULL DEFAULT 'host';
ALTER TABLE access_accounts ADD COLUMN IF NOT EXISTS guest_id uuid REFERENCES guests(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS access_accounts_guest_id_key ON access_accounts(guest_id);
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='access_accounts_role_guest_check') THEN
 ALTER TABLE access_accounts ADD CONSTRAINT access_accounts_role_guest_check CHECK ((role='host' AND guest_id IS NULL) OR (role='guest' AND guest_id IS NOT NULL));
END IF;
END $$;
