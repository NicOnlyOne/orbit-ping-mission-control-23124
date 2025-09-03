-- Add Slack notifications to existing profiles' notification preferences
UPDATE profiles 
SET notification_preferences = notification_preferences || '{"slack": false}'::jsonb
WHERE notification_preferences IS NOT NULL
  AND NOT (notification_preferences ? 'slack');

-- Update the default value for new profiles to include Slack
ALTER TABLE profiles 
ALTER COLUMN notification_preferences 
SET DEFAULT '{"alerts": true, "downtime": true, "recovery": true, "slack": false, "sms": false}'::jsonb;

-- Create function to send Slack notification for new profiles
CREATE OR REPLACE FUNCTION public.notify_slack_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call the notify-slack edge function for new profile creation
  PERFORM 
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/notify-slack',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'message', 'New user "' || COALESCE(NEW.full_name, 'Unknown User') || '" has joined MissionControl! 🎉' || E'\n' || 'Email: ' || COALESCE(NEW.email, 'Not provided'),
        'title', 'New User Registration',
        'color', 'good'
      )
    );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the insert
    RAISE LOG 'Failed to send Slack notification for new profile: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger for new profile notifications
DROP TRIGGER IF EXISTS on_profile_created_slack_notify ON profiles;
CREATE TRIGGER on_profile_created_slack_notify
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_slack_new_profile();

-- Set up configuration for the trigger function (these need to be set manually in production)
-- ALTER DATABASE postgres SET app.supabase_url = 'https://fvbwalvidzomwmcijxww.supabase.co';
-- ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key';

COMMENT ON FUNCTION public.notify_slack_new_profile() IS 'Sends Slack notification when a new user profile is created. Requires app.supabase_url and app.service_role_key to be set.';
COMMENT ON TRIGGER on_profile_created_slack_notify ON profiles IS 'Automatically sends Slack notification when new users register';