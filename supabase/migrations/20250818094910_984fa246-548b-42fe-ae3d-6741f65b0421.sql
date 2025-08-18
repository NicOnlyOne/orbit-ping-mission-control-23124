-- Create monitors table for storing URL endpoints to monitor
CREATE TABLE public.monitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'checking' CHECK (status IN ('online', 'offline', 'checking', 'warning')),
  last_checked TIMESTAMP WITH TIME ZONE,
  response_time INTEGER, -- in milliseconds
  uptime_percentage DECIMAL(5,2) DEFAULT 100.00,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.monitors ENABLE ROW LEVEL SECURITY;

-- Create policies for monitor access
CREATE POLICY "Users can view their own monitors" 
ON public.monitors 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own monitors" 
ON public.monitors 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monitors" 
ON public.monitors 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own monitors" 
ON public.monitors 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_monitors_updated_at
BEFORE UPDATE ON public.monitors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create monitor_checks table to store historical data
CREATE TABLE public.monitor_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  monitor_id UUID NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('online', 'offline', 'warning')),
  response_time INTEGER,
  error_message TEXT,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on monitor_checks
ALTER TABLE public.monitor_checks ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to view checks for their monitors
CREATE POLICY "Users can view checks for their monitors" 
ON public.monitor_checks 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.monitors 
    WHERE monitors.id = monitor_checks.monitor_id 
    AND monitors.user_id = auth.uid()
  )
);

-- Create index for better performance
CREATE INDEX idx_monitors_user_id ON public.monitors(user_id);
CREATE INDEX idx_monitor_checks_monitor_id ON public.monitor_checks(monitor_id);
CREATE INDEX idx_monitor_checks_checked_at ON public.monitor_checks(checked_at);