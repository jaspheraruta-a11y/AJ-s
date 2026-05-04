-- Run this in the Supabase SQL editor (once) to enable staff/admin login history.
-- Requires uuid_generate_v4() (uuid-ossp) or replace with gen_random_uuid().

CREATE TABLE IF NOT EXISTS public.staff_login_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  method text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT staff_login_logs_pkey PRIMARY KEY (id),
  CONSTRAINT staff_login_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS staff_login_logs_created_at_idx ON public.staff_login_logs (created_at DESC);

COMMENT ON TABLE public.staff_login_logs IS 'Successful portal sign-ins for admin/staff (written from the app on SIGNED_IN).';
