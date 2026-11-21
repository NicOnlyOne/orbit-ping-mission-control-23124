DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.plan_waitlist;
CREATE POLICY "Anyone can join waitlist" ON public.plan_waitlist
FOR INSERT TO anon, authenticated
WITH CHECK (
  char_length(email) BETWEEN 3 AND 254
  AND email ~ '^[A-Za-z0-9._%-][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND lower(plan_interest) IN ('pro', 'enterprise', 'pro-25', 'pro-50', 'enterprise-100', 'enterprise-250')
);