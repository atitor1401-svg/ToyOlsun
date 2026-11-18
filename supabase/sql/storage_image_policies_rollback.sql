-- Restore the original (insecure) image bucket policies. Use only if the
-- tightened policies in storage_image_policies.sql break something.

drop policy if exists "images: list own files" on storage.objects;
drop policy if exists "images: delete own files" on storage.objects;

create policy "give anon users select access to images bucket"
  on storage.objects for select to anon
  using (bucket_id = 'images');

create policy "give authenticated users select access to images bucket"
  on storage.objects for select to authenticated
  using (bucket_id = 'images');

create policy "give authenticated users delete access to images bucket"
  on storage.objects for delete to authenticated
  using (bucket_id = 'images');
