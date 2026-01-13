-- Fix admin password hash
-- Password: Change1234!
UPDATE admin_users
SET password_hash = '$2a$10$07Q9a22hUz0QwkuHPNXOYuceQV2rnLdGatMSKRrlOYxwEFJVYsq1e'
WHERE username = 'admin';

SELECT username, password_hash FROM admin_users WHERE username = 'admin';
