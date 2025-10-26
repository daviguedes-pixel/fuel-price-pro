-- Create RLS policies for storage.objects to allow file uploads
CREATE POLICY "Allow public uploads to attachments bucket" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Allow public access to attachments bucket" ON storage.objects
FOR SELECT USING (bucket_id = 'attachments');

CREATE POLICY "Allow public updates to attachments bucket" ON storage.objects
FOR UPDATE USING (bucket_id = 'attachments');

CREATE POLICY "Allow public deletes from attachments bucket" ON storage.objects
FOR DELETE USING (bucket_id = 'attachments');