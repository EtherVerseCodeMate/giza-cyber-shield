-- Fix admin password hash (bcrypt of "Change1234!" cost 10)
-- Generated with: node -e "const b=require('bcryptjs'); b.hash('Change1234!',10).then(h=>console.log(h));"
UPDATE admin_users 
SET password_hash = '$2a$10$kqC5O9beT9P2VpTeD642oeUBCKT.QrloC37OBRus.R5gL6Yg1MzP6'
WHERE username = 'admin';
