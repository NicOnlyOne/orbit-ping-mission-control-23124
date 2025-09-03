-- Add Slack account information to profiles table
ALTER TABLE profiles 
ADD COLUMN slack_username text,
ADD COLUMN slack_channel text;

-- Update existing profiles to include slack notification preference
UPDATE profiles 
SET notification_preferences = notification_preferences || '{"slack": false}'::jsonb
WHERE notification_preferences IS NOT NULL
  AND NOT (notification_preferences ? 'slack');

-- Update the default notification preferences to include Slack
ALTER TABLE profiles 
ALTER COLUMN notification_preferences 
SET DEFAULT '{"alerts": true, "downtime": true, "recovery": true, "sms": false, "slack": false}'::jsonb;

COMMENT ON COLUMN profiles.slack_username IS 'Slack username for notifications (e.g., @john.doe)';
COMMENT ON COLUMN profiles.slack_channel IS 'Slack channel for notifications (e.g., #alerts)';