/*
# Create function to delete storage objects by bucket and prefix

Creates a SECURITY DEFINER function that deletes objects from storage.objects
by bucket_id and name prefix. This is used to clean up orphaned images from
deleted stores/products.

## Security
- SECURITY DEFINER so it runs with elevated privileges
- Only callable by authenticated users (admin use case)
*/

CREATE OR REPLACE FUNCTION delete_storage_objects(p_bucket text, p_names text[])
RETURNS void AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = p_bucket AND name = ANY(p_names);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_storage_objects(text, text[]) TO authenticated;
