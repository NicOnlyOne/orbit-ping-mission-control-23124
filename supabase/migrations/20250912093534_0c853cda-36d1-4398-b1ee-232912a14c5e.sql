-- Add UPDATE and DELETE policies for sms_logs table to prevent security breaches
CREATE POLICY "Users can update their own SMS logs" 
ON public.sms_logs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own SMS logs" 
ON public.sms_logs 
FOR DELETE 
USING (auth.uid() = user_id);