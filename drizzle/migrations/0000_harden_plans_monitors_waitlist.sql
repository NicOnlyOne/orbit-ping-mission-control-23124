CREATE OR REPLACE FUNCTION public.protect_subscription_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan
     AND auth.role() IS DISTINCT FROM 'service_role'
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not allowed to change subscription plan';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS protect_subscription_plan ON public.profiles;
CREATE TRIGGER protect_subscription_plan BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_subscription_plan();

CREATE OR REPLACE FUNCTION public.enforce_monitor_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE plan text; max_m int; cnt int;
BEGIN
  IF auth.role() = 'service_role' OR COALESCE(NEW.enabled, true) = false THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.enabled, true) = true THEN RETURN NEW; END IF;
  SELECT subscription_plan INTO plan FROM public.profiles WHERE id = NEW.user_id;
  max_m := CASE plan WHEN 'pro-25' THEN 25 WHEN 'pro-50' THEN 50
    WHEN 'enterprise-100' THEN 100 WHEN 'enterprise-250' THEN 250 ELSE 5 END;
  SELECT count(*) INTO cnt FROM public.monitors
    WHERE user_id = NEW.user_id AND COALESCE(enabled, true) = true AND id <> NEW.id;
  IF cnt >= max_m THEN
    RAISE EXCEPTION 'Monitor limit reached for your plan';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS enforce_monitor_limit ON public.monitors;
CREATE TRIGGER enforce_monitor_limit BEFORE INSERT OR UPDATE ON public.monitors
FOR EACH ROW EXECUTE FUNCTION public.enforce_monitor_limit();

DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.plan_waitlist;
CREATE POLICY "Anyone can join waitlist" ON public.plan_waitlist
FOR INSERT TO anon, authenticated
WITH CHECK (
  char_length(email) BETWEEN 3 AND 254
  AND email ~ '^[A-Za-z0-9._%-][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND plan_interest IN ('pro', 'enterprise', 'pro-25', 'pro-50', 'enterprise-100', 'enterprise-250')
);