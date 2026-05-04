import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';

function inferLoginMethod(session: Session): string {
  const id = session.user.identities?.[0];
  const provider = id?.provider;
  if (provider) return provider;
  return 'unknown';
}

/** Call on auth SIGNED_IN only. Records one row per sign-in for admin/staff (best-effort). */
export async function recordStaffSignIn(event: AuthChangeEvent, session: Session | null): Promise<void> {
  if (event !== 'SIGNED_IN' || !session?.user?.id) return;

  try {
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profileErr || !profile) return;
    if (profile.role !== 'admin' && profile.role !== 'staff') return;

    const method = inferLoginMethod(session);
    const { error } = await supabase.from('staff_login_logs').insert({
      user_id: session.user.id,
      method,
    });
    if (error) console.warn('[recordStaffSignIn] insert skipped:', error.message);
  } catch (e) {
    console.warn('[recordStaffSignIn]', e);
  }
}
