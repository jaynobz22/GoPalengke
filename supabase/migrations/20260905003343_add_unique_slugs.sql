-- Add unique slug columns to profiles and stores
-- These slugs are used for public profile URLs like /s/aling-nena or /u/juan-delacruz

-- ============= PROFILES SLUG =============
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- ============= STORES SLUG =============
ALTER TABLE stores ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- ============= SLUG GENERATION FUNCTION =============
-- Converts a name into a URL-safe slug: lowercase, hyphens, no special chars
CREATE OR REPLACE FUNCTION generate_slug(input_name text, existing_table text, existing_id uuid DEFAULT NULL)
RETURNS text AS $$
DECLARE
  base_slug text;
  candidate text;
  counter int := 0;
  suffix text := '';
  is_unique boolean := false;
BEGIN
  -- Normalize: lowercase, replace spaces with hyphens, remove non-alphanumeric-hyphen
  base_slug := lower(trim(input_name));
  base_slug := regexp_replace(base_slug, '[^a-z0-9\s-]', '', 'g');
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  -- Fallback if empty
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'user';
  END IF;

  -- Check uniqueness and append counter if needed
  candidate := base_slug;
  WHILE NOT is_unique LOOP
    IF existing_table = 'profiles' THEN
      EXECUTE format('SELECT NOT EXISTS(SELECT 1 FROM profiles WHERE slug = %L%s)', candidate, CASE WHEN existing_id IS NOT NULL THEN format(' AND id <> %L', existing_id) ELSE '' END)
        INTO is_unique;
    ELSIF existing_table = 'stores' THEN
      EXECUTE format('SELECT NOT EXISTS(SELECT 1 FROM stores WHERE slug = %L%s)', candidate, CASE WHEN existing_id IS NOT NULL THEN format(' AND id <> %L', existing_id) ELSE '' END)
        INTO is_unique;
    ELSE
      is_unique := true;
    END IF;

    IF NOT is_unique THEN
      counter := counter + 1;
      candidate := base_slug || '-' || counter::text;
    END IF;
  END LOOP;

  RETURN candidate;
END;
$$ LANGUAGE plpgsql;

-- ============= BACKFILL EXISTING PROFILES =============
DO $$
DECLARE
  rec RECORD;
  new_slug text;
BEGIN
  FOR rec IN SELECT id, full_name FROM profiles WHERE slug IS NULL LOOP
    PERFORM generate_slug(rec.full_name, 'profiles', rec.id);
    EXECUTE format('SELECT generate_slug(%L, %L, %L)', rec.full_name, 'profiles', rec.id) INTO new_slug;
    UPDATE profiles SET slug = new_slug WHERE id = rec.id;
  END LOOP;
END $$;

-- ============= BACKFILL EXISTING STORES =============
DO $$
DECLARE
  rec RECORD;
  new_slug text;
BEGIN
  FOR rec IN SELECT id, name FROM stores WHERE slug IS NULL LOOP
    EXECUTE format('SELECT generate_slug(%L, %L, %L)', rec.name, 'stores', rec.id) INTO new_slug;
    UPDATE stores SET slug = new_slug WHERE id = rec.id;
  END LOOP;
END $$;

-- ============= AUTO-GENERATE SLUG ON INSERT (PROFILES) =============
CREATE OR REPLACE FUNCTION profiles_set_slug()
RETURNS TRIGGER AS $$
DECLARE
  new_slug text;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    EXECUTE format('SELECT generate_slug(%L, %L, %L)', NEW.full_name, 'profiles', NEW.id) INTO new_slug;
    NEW.slug := new_slug;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profiles_set_slug ON profiles;
CREATE TRIGGER trigger_profiles_set_slug BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_set_slug();

-- ============= AUTO-GENERATE SLUG ON INSERT (STORES) =============
CREATE OR REPLACE FUNCTION stores_set_slug()
RETURNS TRIGGER AS $$
DECLARE
  new_slug text;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    EXECUTE format('SELECT generate_slug(%L, %L, %L)', NEW.name, 'stores', NEW.id) INTO new_slug;
    NEW.slug := new_slug;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_stores_set_slug ON stores;
CREATE TRIGGER trigger_stores_set_slug BEFORE INSERT ON stores
  FOR EACH ROW EXECUTE FUNCTION stores_set_slug();

-- ============= INDEXES =============
CREATE INDEX IF NOT EXISTS idx_profiles_slug ON profiles(slug);
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
