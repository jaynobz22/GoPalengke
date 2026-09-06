-- Set jdabblogger@gmail.com as admin
UPDATE profiles SET role = 'admin', is_approved = true, is_active = true
WHERE email = 'jdabblogger@gmail.com';

-- Create profile for rouyhtgin@gmail.com as admin
INSERT INTO profiles (id, email, full_name, role, is_approved, is_active)
VALUES ('19bfd449-bae6-4e0a-80e1-1cd801c00686', 'rouyhtgin@gmail.com', 'Admin', 'admin', true, true)
ON CONFLICT (id) DO UPDATE SET role = 'admin', is_approved = true, is_active = true;
