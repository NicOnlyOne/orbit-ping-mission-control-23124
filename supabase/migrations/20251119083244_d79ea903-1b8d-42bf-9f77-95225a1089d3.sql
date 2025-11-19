-- Fix handle_updated_at function to prevent search path manipulation attacks
-- This adds SECURITY DEFINER and fixes the search_path to 'public'
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;