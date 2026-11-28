BEGIN;
CREATE TABLE IF NOT EXISTS exchange_draws (
 id uuid PRIMARY KEY, event_id uuid NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
 revision integer NOT NULL DEFAULT 1 CHECK (revision > 0), snapshot_hash varchar(64) NOT NULL,
 event_name text NOT NULL, event_date date NOT NULL, exchange_rules text,
 sorted_by varchar(120) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), locked_at timestamptz
);
CREATE TABLE IF NOT EXISTS exchange_assignments (
 id uuid PRIMARY KEY, draw_id uuid NOT NULL REFERENCES exchange_draws(id) ON DELETE CASCADE,
 giver_id uuid REFERENCES guests(id) ON DELETE SET NULL, recipient_id uuid REFERENCES guests(id) ON DELETE SET NULL,
 giver_name varchar(120) NOT NULL, giver_email varchar(160) NOT NULL,
 recipient_name varchar(120) NOT NULL, gift_suggestions varchar(500) NOT NULL,
 position integer NOT NULL, status varchar(20) NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0,
 attempted_at timestamptz, sent_at timestamptz, last_error varchar(500), message_id varchar(255),
 UNIQUE(draw_id,giver_id), UNIQUE(draw_id,recipient_id),
 CHECK (giver_id IS DISTINCT FROM recipient_id OR giver_id IS NULL),
 CHECK (status IN ('pending','sending','sent','failed','uncertain'))
);
CREATE INDEX IF NOT EXISTS exchange_assignments_giver_id_idx ON exchange_assignments(giver_id);
-- La misma fila de evento serializa modificaciones de participantes y publicación del sorteo.
CREATE OR REPLACE FUNCTION guard_exchange_attendance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ref uuid; event_refs uuid[]; affected boolean;
BEGIN
 IF TG_OP='INSERT' THEN event_refs:=ARRAY[NEW.event_id]; affected:=NEW.participates_in_exchange;
 ELSIF TG_OP='DELETE' THEN event_refs:=ARRAY[OLD.event_id]; affected:=OLD.participates_in_exchange;
 ELSE
  event_refs:=ARRAY[OLD.event_id,NEW.event_id];
  affected:=(OLD.participates_in_exchange OR NEW.participates_in_exchange) AND
   (OLD.event_id IS DISTINCT FROM NEW.event_id OR OLD.guest_id IS DISTINCT FROM NEW.guest_id OR
    OLD.status IS DISTINCT FROM NEW.status OR OLD.participates_in_exchange IS DISTINCT FROM NEW.participates_in_exchange);
 END IF;
 FOR ref IN SELECT id FROM events WHERE id=ANY(event_refs) ORDER BY id FOR UPDATE LOOP
  IF affected AND EXISTS(SELECT 1 FROM exchange_draws WHERE event_id=ref AND locked_at IS NOT NULL) THEN
   RAISE EXCEPTION 'EXCHANGE_DRAW_LOCKED' USING ERRCODE='P0001';
  END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS exchange_attendance_guard ON event_guests;
CREATE TRIGGER exchange_attendance_guard BEFORE INSERT OR UPDATE OR DELETE ON event_guests
 FOR EACH ROW EXECUTE FUNCTION guard_exchange_attendance();
CREATE OR REPLACE FUNCTION guard_exchange_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM exchange_draws WHERE event_id=OLD.id AND locked_at IS NOT NULL) THEN
  IF TG_OP='DELETE' OR NEW.gift_exchange_enabled IS DISTINCT FROM OLD.gift_exchange_enabled THEN
   RAISE EXCEPTION 'EXCHANGE_DRAW_LOCKED' USING ERRCODE='P0001';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS exchange_event_guard ON events;
CREATE TRIGGER exchange_event_guard BEFORE DELETE OR UPDATE OF gift_exchange_enabled ON events
 FOR EACH ROW EXECUTE FUNCTION guard_exchange_event();
CREATE OR REPLACE FUNCTION guard_exchange_guest_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM exchange_assignments a JOIN exchange_draws d ON d.id=a.draw_id
   WHERE d.locked_at IS NOT NULL AND (a.giver_id=OLD.id OR a.recipient_id=OLD.id)) THEN
  RAISE EXCEPTION 'EXCHANGE_DRAW_LOCKED' USING ERRCODE='P0001';
 END IF;
 RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS exchange_guest_delete_guard ON guests;
CREATE TRIGGER exchange_guest_delete_guard BEFORE DELETE ON guests
 FOR EACH ROW EXECUTE FUNCTION guard_exchange_guest_delete();
COMMIT;
