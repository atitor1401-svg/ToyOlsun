-- Tighten Row Level Security on the public "images" storage bucket.
--
-- Before: ANY logged-in user could delete ANY file, and anyone (even without
-- an account) could list every file in the bucket. A malicious account could
-- therefore wipe other partners' photos. (Confirmed by a live test on
-- 2026-11-13: account B deleted a file uploaded by account A.)
--
-- After:
--   * DELETE  -> a user can delete only files they uploaded (owner = auth.uid()).
--   * SELECT/list -> a user can list only their own files; nobody can list the
--                    whole bucket. Public *display* of images is unaffected,
--                    because the bucket is public and images are shown through
--                    the public URL, which needs no SELECT policy.
--   * INSERT  -> left unchanged for now (anon + authenticated can upload). See
--                the note at the bottom.
--
-- The 147 files with no owner belong to admin-created services that have no
-- partner account, so no app user ever deletes them from the app; the admin
-- (service_role) keeps full access and can still manage them.
--
-- Roll back: run supabase/sql/storage_image_policies_rollback.sql

-- Anonymous (not logged in) users: no listing at all.
drop policy if exists "give anon users select access to images bucket" on storage.objects;

-- Logged-in users: list only their own files.
drop policy if exists "give authenticated users select access to images bucket" on storage.objects;
create policy "images: list own files"
  on storage.objects for select to authenticated
  using (bucket_id = 'images' and owner = auth.uid());

-- Logged-in users: delete only their own files.
drop policy if exists "give authenticated users delete access to images bucket" on storage.objects;
create policy "images: delete own files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'images' and owner = auth.uid());

-- NOTE (not applied here): the INSERT policy still lets anonymous users upload
-- into the bucket, which a bad actor could abuse to fill storage. If guests
-- never upload photos (e.g. reviews are written only by logged-in customers),
-- the anon INSERT policy can be dropped too:
--   drop policy if exists "give anon users access to images bucket" on storage.objects;
