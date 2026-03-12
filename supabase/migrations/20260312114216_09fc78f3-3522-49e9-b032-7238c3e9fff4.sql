CREATE TABLE public.plan_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  plan_interest text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public signup)
CREATE POLICY "Anyone can join waitlist" ON public.plan_waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- No reads/updates/deletes from clients
CREATE POLICY "No public reads" ON public.plan_waitlist
  FOR SELECT USING (false);

CREATE POLICY "No public updates" ON public.plan_waitlist
  FOR UPDATE USING (false);

CREATE POLICY "No public deletes" ON public.plan_waitlist
  FOR DELETE USING (false);

-- Admins can read waitlist
CREATE POLICY "Admins can read waitlist" ON public.plan_waitlist
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));