-- Add notify_email column to monitors table for email alerts
ALTER TABLE public.monitors 
ADD COLUMN notify_email TEXT NULL;