-- Parche aditivo: conserva los eventos existentes liberados solo al crear la columna.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'is_released') THEN
    ALTER TABLE events ADD COLUMN is_released boolean NOT NULL DEFAULT false;
    UPDATE events SET is_released = true;
  END IF;
END $$;
ALTER TABLE events ADD COLUMN IF NOT EXISTS dress_code text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS contributions text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS exchange_rules text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS additional_activities text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_deadline date;
