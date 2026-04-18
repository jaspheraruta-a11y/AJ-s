import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../supabase';

// ── Types ──────────────────────────────────────────────────────────────────────
export type TabId = 'overview' | 'orders' | 'products' | 'users' | 'inventory' | 'promos';

interface StaffPermissionsContextValue {
  restrictedTabs: Set<TabId>;
  toggleTabRestriction: (tab: TabId) => void;
  isTabRestricted: (tab: TabId) => boolean;
  permissionsLoading: boolean;
}

// ── Supabase settings key ───────────────────────────────────────────────────────
const SETTINGS_KEY = 'staff_restricted_tabs';

// ── Context ────────────────────────────────────────────────────────────────────
const StaffPermissionsContext = createContext<StaffPermissionsContextValue>({
  restrictedTabs: new Set(),
  toggleTabRestriction: () => { },
  isTabRestricted: () => false,
  permissionsLoading: true,
});

export const StaffPermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [restrictedTabs, setRestrictedTabs] = useState<Set<TabId>>(new Set());
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  // ── Load initial permissions from Supabase ─────────────────────────────────
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', SETTINGS_KEY)
          .maybeSingle();

        if (error) {
          console.error('Failed to load staff permissions:', error);
          return;
        }

        if (data?.value) {
          const tabs = JSON.parse(data.value) as TabId[];
          setRestrictedTabs(new Set(tabs));
        }
      } catch (err) {
        console.error('Error loading staff permissions:', err);
      } finally {
        setPermissionsLoading(false);
      }
    };

    loadPermissions();

    // ── Real-time subscription to receive instant updates ──────────────────
    const channel = supabase
      .channel('staff-permissions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: `key=eq.${SETTINGS_KEY}`,
        },
        (payload: any) => {
          const newValue = payload.new?.value;
          if (newValue !== undefined && newValue !== null) {
            try {
              const tabs = JSON.parse(newValue) as TabId[];
              setRestrictedTabs(new Set(tabs));
            } catch {
              setRestrictedTabs(new Set());
            }
          } else if (payload.eventType === 'DELETE') {
            setRestrictedTabs(new Set());
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Toggle + persist to Supabase ───────────────────────────────────────────
  const toggleTabRestriction = useCallback(async (tab: TabId) => {
    setRestrictedTabs(prev => {
      const next = new Set(prev);
      if (next.has(tab)) {
        next.delete(tab);
      } else {
        next.add(tab);
      }

      // Persist to Supabase (upsert)
      const tabsArray = [...next];
      supabase
        .from('app_settings')
        .upsert(
          { key: SETTINGS_KEY, value: JSON.stringify(tabsArray), updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
        .then(({ error }) => {
          if (error) console.error('Failed to save staff permissions:', error);
        });

      return next;
    });
  }, []);

  const isTabRestricted = useCallback((tab: TabId) => restrictedTabs.has(tab), [restrictedTabs]);

  return (
    <StaffPermissionsContext.Provider value={{ restrictedTabs, toggleTabRestriction, isTabRestricted, permissionsLoading }}>
      {children}
    </StaffPermissionsContext.Provider>
  );
};

export const useStaffPermissions = () => useContext(StaffPermissionsContext);

// ── Status-change cooldown hook ────────────────────────────────────────────────
// Staff users must wait 5 seconds after an admin changes a status before they can change it again.
// The cooldown key is per-order so each order has its own cooldown timer.

const COOLDOWN_MS = 5000;
const COOLDOWN_STORAGE_KEY = 'ajs_status_change_cooldowns';

type CooldownMap = Record<string, number>; // orderId -> timestamp of last change

const loadCooldowns = (): CooldownMap => {
  try {
    const raw = localStorage.getItem(COOLDOWN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const useStatusChangeCooldown = () => {
  const cooldownsRef = useRef<CooldownMap>(loadCooldowns());

  /** Call this when ANY user (admin or staff) successfully changes an order status */
  const recordStatusChange = useCallback((orderId: string) => {
    const now = Date.now();
    cooldownsRef.current = { ...cooldownsRef.current, [orderId]: now };
    try {
      localStorage.setItem(COOLDOWN_STORAGE_KEY, JSON.stringify(cooldownsRef.current));
    } catch { }
  }, []);

  /** Returns remaining cooldown seconds for an order (0 if no cooldown active) */
  const getRemainingCooldown = useCallback((orderId: string): number => {
    // Re-read from storage in case another tab updated it
    try {
      const raw = localStorage.getItem(COOLDOWN_STORAGE_KEY);
      if (raw) cooldownsRef.current = JSON.parse(raw);
    } catch { }
    const lastChange = cooldownsRef.current[orderId];
    if (!lastChange) return 0;
    const elapsed = Date.now() - lastChange;
    const remaining = COOLDOWN_MS - elapsed;
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }, []);

  /** Returns true if staff should be blocked from changing this order's status */
  const isOnCooldown = useCallback((orderId: string): boolean => {
    return getRemainingCooldown(orderId) > 0;
  }, [getRemainingCooldown]);

  return { recordStatusChange, getRemainingCooldown, isOnCooldown };
};
