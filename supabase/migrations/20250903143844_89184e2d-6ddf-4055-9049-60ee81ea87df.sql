-- Add subscription plan tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro', 'enterprise'));

-- Add subscription status and timestamps
ALTER TABLE public.profiles
ADD COLUMN subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'expired')),
ADD COLUMN subscription_start_date TIMESTAMPTZ,
ADD COLUMN subscription_end_date TIMESTAMPTZ;

-- Create a function to check user's plan
CREATE OR REPLACE FUNCTION public.get_user_plan(user_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_plan TEXT;
BEGIN
    SELECT subscription_plan INTO user_plan
    FROM profiles
    WHERE user_id = user_id_param;
    
    RETURN COALESCE(user_plan, 'free');
END;
$$;

-- Create a function to check if user can enable more monitors
CREATE OR REPLACE FUNCTION public.can_enable_monitor(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_plan TEXT;
    enabled_count INTEGER;
BEGIN
    -- Get user's plan
    SELECT subscription_plan INTO user_plan
    FROM profiles
    WHERE user_id = user_id_param;
    
    user_plan := COALESCE(user_plan, 'free');
    
    -- For pro and enterprise plans, no limit
    IF user_plan IN ('pro', 'enterprise') THEN
        RETURN TRUE;
    END IF;
    
    -- For free plan, check if they have less than 1 enabled monitor
    SELECT COUNT(*) INTO enabled_count
    FROM monitors
    WHERE user_id = user_id_param AND enabled = true;
    
    RETURN enabled_count < 1;
END;
$$;