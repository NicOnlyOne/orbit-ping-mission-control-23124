-- Set nicolas@bluedaysolutions.com as enterprise power user
UPDATE profiles 
SET 
  subscription_plan = 'enterprise',
  subscription_status = 'active',
  subscription_start_date = NOW(),
  subscription_end_date = NOW() + INTERVAL '10 years' -- Long-term access
WHERE email = 'nicolas@bluedaysolutions.com';