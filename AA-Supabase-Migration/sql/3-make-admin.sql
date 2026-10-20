-- ============================================================
-- MAKE AN ADMIN ACCOUNT (run after creating that user in Supabase Auth)
--
-- 1. Dashboard → Authentication → Users → "Add user" → "Create new user"
--    Enter YOUR admin email + a STRONG password, tick "Auto Confirm User".
-- 2. Put that same email below and run this file in the SQL Editor.
-- ============================================================
update public.profiles set role = 'admin' where email = 'PUT-YOUR-ADMIN-EMAIL-HERE';

-- The database allows up to three real admins. Run this file once per
-- Auth user, changing only the email placeholder each time.
select id, name, email, role
from public.profiles
where role = 'admin'
order by created_at;
