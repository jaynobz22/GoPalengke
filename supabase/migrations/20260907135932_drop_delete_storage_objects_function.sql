/*
# Drop temporary delete_storage_objects function

This function was created solely to clean up orphaned storage images from
the deleted "Gulayan ni Julio" store. It is no longer needed.
*/

DROP FUNCTION IF EXISTS delete_storage_objects(text, text[]);
