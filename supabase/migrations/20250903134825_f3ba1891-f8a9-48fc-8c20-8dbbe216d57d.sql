-- Storage policies for avatars bucket to allow authenticated uploads per-user folder
-- Make avatars publicly readable
CREATE POLICY IF NOT EXISTS "Avatars are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

-- Allow authenticated users to upload into a folder named with their user id
CREATE POLICY IF NOT EXISTS "Users can upload own avatar"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own avatar files
CREATE POLICY IF NOT EXISTS "Users can update own avatar"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own avatar files
CREATE POLICY IF NOT EXISTS "Users can delete own avatar"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);