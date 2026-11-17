-- Parche aditivo para la base existente (sin historial de migraciones).
-- Solo inicializa Navidad cuando la columna aún no existe; puede reejecutarse.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events'
      AND column_name = 'gift_exchange_enabled'
  ) THEN
    ALTER TABLE "events" ADD COLUMN "gift_exchange_enabled" BOOLEAN NOT NULL DEFAULT false;
    UPDATE "events" SET "gift_exchange_enabled" = true WHERE "slug" = 'navidad';
  END IF;
END $$;
