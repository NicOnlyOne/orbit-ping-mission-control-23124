-- Add INSERT, UPDATE, and DELETE policies for monitor_checks table
-- Only allow operations on monitor checks for monitors owned by the authenticated user

CREATE POLICY "Users can insert checks for their monitors" 
ON public.monitor_checks 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM monitors 
  WHERE monitors.id = monitor_checks.monitor_id 
  AND monitors.user_id = auth.uid()
));

CREATE POLICY "Users can update checks for their monitors" 
ON public.monitor_checks 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM monitors 
  WHERE monitors.id = monitor_checks.monitor_id 
  AND monitors.user_id = auth.uid()
));

CREATE POLICY "Users can delete checks for their monitors" 
ON public.monitor_checks 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM monitors 
  WHERE monitors.id = monitor_checks.monitor_id 
  AND monitors.user_id = auth.uid()
));