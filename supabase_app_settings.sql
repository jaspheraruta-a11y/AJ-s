-- ── Create app_settings table for shared global config ──────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Row-level security ───────────────────────────────────────────────────────
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read settings (staff needs to read restrictions)
CREATE POLICY "Allow authenticated read" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

-- Only admins can write/update settings
CREATE POLICY "Allow admin write" ON public.app_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── Seed initial empty restrictions row ─────────────────────────────────────
INSERT INTO public.app_settings (key, value) VALUES ('staff_restricted_tabs', '[]')
  ON CONFLICT (key) DO NOTHING;

-- ── Enable Realtime for this table ───────────────────────────────────────────
-- Run this in the Supabase Dashboard → Table Editor → app_settings → Realtime (enable)
-- OR run: ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
