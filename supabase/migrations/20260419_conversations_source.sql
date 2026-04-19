-- Migration: source context for conversations
-- Columns (source, source_id, origin_city, origin_state,
-- destination_city, destination_state) already exist in the schema.
-- This file creates the indexes and trigger only.

-- 1. Indexes for filter queries
CREATE INDEX IF NOT EXISTS idx_conversations_source
  ON conversations (source);

CREATE INDEX IF NOT EXISTS idx_conversations_source_id
  ON conversations (source_id);

-- 2. Trigger: auto-fill origin/destination from the source table.
--    freights stores city/state as text columns (origin_city, origin_state, etc.)
--    preferred_routes stores them the same way.
CREATE OR REPLACE FUNCTION sync_conversation_route_data()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.source = 'freight' AND NEW.source_id IS NOT NULL
     AND (NEW.origin_city IS NULL OR NEW.destination_city IS NULL) THEN
    SELECT origin_city, origin_state, destination_city, destination_state
      INTO NEW.origin_city, NEW.origin_state, NEW.destination_city, NEW.destination_state
      FROM freights
      WHERE id = NEW.source_id;
  END IF;

  IF NEW.source = 'route' AND NEW.source_id IS NOT NULL
     AND (NEW.origin_city IS NULL OR NEW.destination_city IS NULL) THEN
    SELECT origin_city, origin_state, destination_city, destination_state
      INTO NEW.origin_city, NEW.origin_state, NEW.destination_city, NEW.destination_state
      FROM preferred_routes
      WHERE id = NEW.source_id;
  END IF;

  RETURN NEW;
END;
$$;

-- BEFORE INSERT so the values are written in the same row (no secondary UPDATE needed)
DROP TRIGGER IF EXISTS trg_conversation_route_sync ON conversations;
CREATE TRIGGER trg_conversation_route_sync
  BEFORE INSERT ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION sync_conversation_route_data();

-- Usage from app when starting a chat from a freight:
--
--   supabase.from('conversations').insert({
--     participant1_id: userId,
--     participant2_id: companyUserId,
--     source: 'freight',
--     source_id: freightId,
--     -- origin_city/state and destination_city/state filled by trigger
--   })
--
-- For a route: source='route', source_id=routeId
-- For a direct chat: omit source (defaults to 'direct')
