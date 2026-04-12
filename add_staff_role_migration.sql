-- ============================================================
-- Migration: Add 'staff' role to user_role enum
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Step 1: Add 'staff' to the user_role enum type
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff';

-- ============================================================
-- HOW TO CREATE A STAFF USER:
-- ============================================================
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add User" → fill in email & password
-- 3. Copy the new user's UUID
-- 4. Run this query in SQL Editor (replace <UUID> and <EMAIL>):

-- INSERT INTO public.profiles (id, email, full_name, role)
-- VALUES ('<UUID>', '<EMAIL>', 'Staff Name', 'staff')
-- ON CONFLICT (id) DO UPDATE SET role = 'staff', full_name = 'Staff Name';

-- OR update an existing user's role to staff:
-- UPDATE public.profiles SET role = 'staff' WHERE email = 'staff@example.com';

-- ============================================================
-- Staff will log in via /staff route in the application
-- Admin permissions panel is at /admin → "Rollback Permissions"
-- ============================================================
