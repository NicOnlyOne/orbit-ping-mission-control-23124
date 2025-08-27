-- Add FCM token field to profiles table for push notifications
ALTER TABLE public.profiles 
ADD COLUMN fcm_token TEXT,
ADD COLUMN notification_preferences JSONB DEFAULT '{"alerts": true, "downtime": true, "recovery": true}'::jsonb;