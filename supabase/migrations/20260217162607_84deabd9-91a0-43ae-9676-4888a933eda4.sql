-- Add slack_webhook_url column to profiles for per-user Slack incoming webhooks
ALTER TABLE public.profiles ADD COLUMN slack_webhook_url text;

-- Update get_my_profile to include slack_webhook_url
CREATE OR REPLACE FUNCTION public.get_my_profile()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'slack_webhook_url', p.slack_webhook_url,
    'full_name', p.full_name
  ) INTO result
  FROM public.profiles p
  WHERE p.id = auth.uid();

  RETURN result;
END;
$function$;