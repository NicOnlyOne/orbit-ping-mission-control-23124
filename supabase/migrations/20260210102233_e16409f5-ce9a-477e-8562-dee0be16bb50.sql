
-- Encrypt existing email data in-place
UPDATE public.profiles
SET email = private.encrypt_value(email)
WHERE email IS NOT NULL AND email != '';

-- Update get_my_profile RPC to also decrypt email
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
    'email', private.decrypt_value(p.email),
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

-- Update the trigger to also encrypt email
CREATE OR REPLACE FUNCTION public.encrypt_profile_sensitive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.phone_number = private.encrypt_value(NEW.phone_number);
  NEW.notification_preferences = private.encrypt_value(NEW.notification_preferences);
  NEW.email = private.encrypt_value(NEW.email);
  RETURN NEW;
END;
$$;
