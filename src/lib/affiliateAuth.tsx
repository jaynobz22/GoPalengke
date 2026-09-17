import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { supabase } from './supabase';

export interface Affiliate {
  id: string;
  email: string;
  full_name: string;
  payout_qr_url: string;
  promo_code: string;
  referral_code: string;
  wallet_balance: number;
  lifetime_earnings: number;
  payout_status: string;
  payout_requested_at: string | null;
  created_at: string;
}

interface AffiliateAuthContextType {
  affiliate: Affiliate | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (data: { email: string; password: string; full_name: string; payout_qr_url: string; promo_code?: string }) => Promise<{ error: string | null }>;
  signOut: () => void;
  refresh: () => Promise<void>;
}

const AffiliateAuthContext = createContext<AffiliateAuthContextType | null>(null);

const STORAGE_KEY = 'gopalengke_affiliate_session';

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

export function AffiliateAuthProvider({ children }: { children: ReactNode }) {
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        loadAffiliate(parsed.id, parsed.password_hash);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    } else {
      setLoading(false);
    }
  }, []);

  async function loadAffiliate(id: string, passwordHash: string) {
    const { data, error } = await supabase
      .from('affiliates')
      .select('*')
      .eq('id', id)
      .eq('password_hash', passwordHash)
      .maybeSingle();
    if (data && !error) {
      setAffiliate(data as Affiliate);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, password_hash: passwordHash }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setLoading(false);
  }

  const signIn = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    const { data, error } = await supabase
      .from('affiliates')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();
    if (error || !data) return { error: 'Hindi nahanap ang account na ito.' };
    if ((data as any).password_hash !== simpleHash(password)) return { error: 'Maling email o password.' };
    setAffiliate(data as Affiliate);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: data.id, password_hash: (data as any).password_hash }));
    return { error: null };
  }, []);

  const signUp = useCallback(async (data: { email: string; password: string; full_name: string; payout_qr_url: string; promo_code?: string }): Promise<{ error: string | null }> => {
    const email = data.email.toLowerCase().trim();
    const { data: existing } = await supabase.from('affiliates').select('id').eq('email', email).maybeSingle();
    if (existing) return { error: 'Ginagamit na ang email na ito.' };

    const { data: inserted, error } = await supabase
      .from('affiliates')
      .insert({
        email,
        full_name: data.full_name.trim(),
        payout_qr_url: data.payout_qr_url,
        promo_code: data.promo_code?.trim() || '',
        password_hash: simpleHash(data.password),
      })
      .select('*')
      .single();
    if (error || !inserted) return { error: error?.message || 'Hindi makapag-register. Subukan ulit.' };
    setAffiliate(inserted as Affiliate);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: inserted.id, password_hash: (inserted as any).password_hash }));
    return { error: null };
  }, []);

  const signOut = useCallback(() => {
    setAffiliate(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const refresh = useCallback(async () => {
    if (!affiliate) return;
    const { data } = await supabase.from('affiliates').select('*').eq('id', affiliate.id).maybeSingle();
    if (data) setAffiliate(data as Affiliate);
  }, [affiliate]);

  return (
    <AffiliateAuthContext.Provider value={{ affiliate, loading, signIn, signUp, signOut, refresh }}>
      {children}
    </AffiliateAuthContext.Provider>
  );
}

export function useAffiliateAuth() {
  const ctx = useContext(AffiliateAuthContext);
  if (!ctx) throw new Error('useAffiliateAuth must be used within AffiliateAuthProvider');
  return ctx;
}
