-- ============================================
-- NERALLA NEXUS — STORAGE SETUP
-- Migration 006: Avatars, Documents, and Memories Buckets
-- ============================================

-- 1. Create Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 5242880, '{image/jpeg,image/png,image/gif,image/webp,image/svg+xml}'),
  ('documents', 'documents', true, 52428800, NULL), -- 50MB limit for documents
  ('memories', 'memories', true, 104857600, NULL) -- 100MB limit for photos/videos
ON CONFLICT (id) DO NOTHING;

-- 2. Ensure RLS is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Define Policies for Avatars
CREATE POLICY "Public Read Access for Avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated Insert/Upload for Avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated Update/Modify for Avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated Delete for Avatars"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- 4. Define Policies for Documents
CREATE POLICY "Public Read Access for Documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents');

CREATE POLICY "Authenticated Insert/Upload for Documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated Update/Modify for Documents"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated Delete for Documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- 5. Define Policies for Memories
CREATE POLICY "Public Read Access for Memories"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'memories');

CREATE POLICY "Authenticated Insert/Upload for Memories"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'memories' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated Update/Modify for Memories"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'memories' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated Delete for Memories"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'memories' AND auth.role() = 'authenticated');
