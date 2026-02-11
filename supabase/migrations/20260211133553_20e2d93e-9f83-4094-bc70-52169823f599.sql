
-- Deny UPDATE and DELETE on monitor_logs (append-only audit logs)
CREATE POLICY "No updates to monitor logs"
ON public.monitor_logs FOR UPDATE
USING (false);

CREATE POLICY "No deletes from monitor logs"
ON public.monitor_logs FOR DELETE
USING (false);

-- Deny INSERT on monitor_logs from regular users (system-only via service role)
CREATE POLICY "No direct inserts to monitor logs"
ON public.monitor_logs FOR INSERT
WITH CHECK (false);

-- Deny UPDATE and DELETE on sms_logs (append-only audit logs)
CREATE POLICY "No updates to sms logs"
ON public.sms_logs FOR UPDATE
USING (false);

CREATE POLICY "No deletes from sms logs"
ON public.sms_logs FOR DELETE
USING (false);
