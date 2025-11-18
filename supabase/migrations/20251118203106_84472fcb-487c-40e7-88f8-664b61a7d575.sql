-- Add DELETE policy to profiles table to prevent unauthorized profile deletion
CREATE POLICY "Users can delete their own profile"
  ON public.profiles 
  FOR DELETE 
  USING (auth.uid() = id);