-- Fix inconsistent RLS policies for profiles table
-- Drop the conflicting policies that use 'id' column
DROP POLICY IF EXISTS "Allow users to read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;

-- Keep only the policies that use 'user_id' column for consistency
-- These already exist and are correct:
-- "Users can create their own profile"
-- "Users can update their own profile" 
-- "Users can view their own profile"

-- Fix duplicate device policies by dropping the duplicate one
DROP POLICY IF EXISTS "Allow users to access their own devices" ON public.devices;

-- Keep only these policies for devices:
-- "Users can insert own devices"
-- "Users can view own devices"