-- Add last_alert_sent column to monitors table for cooldown tracking
ALTER TABLE monitors ADD COLUMN last_alert_sent TIMESTAMP WITH TIME ZONE;