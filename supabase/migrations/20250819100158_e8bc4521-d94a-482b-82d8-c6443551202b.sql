-- Add monitoring interval column to monitors table
ALTER TABLE public.monitors 
ADD COLUMN monitoring_interval INTEGER DEFAULT 300; -- Default 5 minutes (300 seconds)

-- Update existing monitors to have default interval
UPDATE public.monitors 
SET monitoring_interval = 300 
WHERE monitoring_interval IS NULL;