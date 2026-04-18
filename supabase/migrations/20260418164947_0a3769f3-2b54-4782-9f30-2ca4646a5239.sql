-- Move pgcrypto to dedicated extensions schema (security best practice)
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Move extension if currently in public
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pgcrypto' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'ALTER EXTENSION pgcrypto SET SCHEMA extensions';
  END IF;
END $$;

-- Update encrypt_secret_value to use extensions schema in search_path
CREATE OR REPLACE FUNCTION public.encrypt_secret_value()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NEW.key_value IS NOT NULL AND NEW.key_value != '' THEN
    NEW.encrypted_value = extensions.pgp_sym_encrypt(
      NEW.key_value,
      current_setting('app.settings.secret_key', true)
    );
  END IF;
  RETURN NEW;
END;
$function$;