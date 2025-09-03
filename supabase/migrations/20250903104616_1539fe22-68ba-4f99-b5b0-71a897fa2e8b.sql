-- Add phone_number field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN phone_number text;

-- Update notification_preferences to include SMS settings
UPDATE public.profiles 
SET notification_preferences = jsonb_set(
    COALESCE(notification_preferences, '{}'),
    '{sms}',
    'true'
) 
WHERE notification_preferences IS NOT NULL OR notification_preferences IS NULL;