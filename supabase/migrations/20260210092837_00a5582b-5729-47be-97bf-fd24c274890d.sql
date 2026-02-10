
-- Create private schema for internal encryption functions
CREATE SCHEMA IF NOT EXISTS private;

-- Create a private table to store the encryption key
CREATE TABLE private.encryption_keys (
  id serial PRIMARY KEY,
  key_name text UNIQUE NOT NULL,
  key_value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Revoke all access from public roles
REVOKE ALL ON SCHEMA private FROM public, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM public, anon, authenticated;

-- Generate and store a random encryption key using pgcrypto (already available in Supabase)
INSERT INTO private.encryption_keys (key_name, key_value)
VALUES ('profile_encryption_key', encode(extensions.gen_random_bytes(32), 'hex'));

-- Function to retrieve the encryption key
CREATE OR REPLACE FUNCTION private.get_encryption_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT key_value FROM private.encryption_keys WHERE key_name = 'profile_encryption_key' LIMIT 1;
$$;

-- Encrypt a text value with ENC: prefix marker to prevent double-encryption
CREATE OR REPLACE FUNCTION private.encrypt_value(val text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF val IS NULL OR val = '' THEN RETURN NULL; END IF;
  IF val LIKE 'ENC:%' THEN RETURN val; END IF;
  RETURN 'ENC:' || encode(extensions.pgp_sym_encrypt(val, private.get_encryption_key()), 'base64');
END;
$$;

-- Decrypt a text value (handles ENC: prefix, passes through unencrypted values)
CREATE OR REPLACE FUNCTION private.decrypt_value(val text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF val IS NULL OR val = '' THEN RETURN NULL; END IF;
  IF NOT val LIKE 'ENC:%' THEN RETURN val; END IF;
  RETURN extensions.pgp_sym_decrypt(decode(substring(val from 5), 'base64'), private.get_encryption_key());
END;
$$;

-- Change notification_preferences from jsonb to text for encrypted storage
ALTER TABLE public.profiles
  ALTER COLUMN notification_preferences TYPE text
  USING notification_preferences::text;

ALTER TABLE public.profiles
  ALTER COLUMN notification_preferences SET DEFAULT NULL;

-- Encrypt existing phone_number data in-place
UPDATE public.profiles
SET phone_number = private.encrypt_value(phone_number)
WHERE phone_number IS NOT NULL AND phone_number != '';

-- Encrypt existing notification_preferences data in-place
UPDATE public.profiles
SET notification_preferences = private.encrypt_value(notification_preferences)
WHERE notification_preferences IS NOT NULL AND notification_preferences != '';

-- Create trigger to auto-encrypt sensitive fields on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.encrypt_profile_sensitive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.phone_number = private.encrypt_value(NEW.phone_number);
  NEW.notification_preferences = private.encrypt_value(NEW.notification_preferences);
  RETURN NEW;
END;
$$;

CREATE TRIGGER encrypt_profile_fields
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.encrypt_profile_sensitive();

-- RPC function to return decrypted profile for the authenticated user
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', p.id,
    'created_at', p.created_at,
    'updated_at', p.updated_at,
    'notification_email', p.notification_email,
    'notification_preferences', CASE
      WHEN p.notification_preferences IS NOT NULL AND p.notification_preferences != ''
      THEN private.decrypt_value(p.notification_preferences)::jsonb
      ELSE '{"sms": false, "slack": false, "downtime": true, "recovery": true}'::jsonb
    END,
    'avatar_url', p.avatar_url,
    'phone_number', private.decrypt_value(p.phone_number),
    'email', p.email,
    'subscription_plan', p.subscription_plan,
    'theme_preference', p.theme_preference,
    'slack_username', p.slack_username,
    'slack_channel', p.slack_channel,
    'full_name', p.full_name
  ) INTO result
  FROM public.profiles p
  WHERE p.id = auth.uid();

  RETURN result;
END;
$$;
