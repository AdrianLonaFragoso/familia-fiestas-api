DO $$
BEGIN
  ALTER TABLE guests ADD COLUMN IF NOT EXISTS gender varchar(10);
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'guests_gender_check' AND conrelid = 'guests'::regclass) THEN
    ALTER TABLE guests ADD CONSTRAINT guests_gender_check CHECK (gender IN ('male', 'female'));
  END IF;
END $$;
