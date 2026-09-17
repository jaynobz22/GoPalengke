import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { supabase } from './supabase';

export interface Affiliate {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  payout_qr_url: string;
  promo_code: string;
  referral_code: string;
  wallet_balance: number;
  lifetime_earnings: number;
  tier1_earnings: number;
  tier2_earnings: number;
  sponsor_id: string | null;
  payout_status: string;
  payout_requested_at: string | null;
  linked_user_id: string | null;
  created_at: string;
}

interface AffiliateAuthContextType {
  affiliate: Affiliate | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (data: { email: string; password: string; full_name: string; phone: string; payout_qr_url: string; promo_code?: string }) => Promise<{ error: string | null }>;
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

  const signUp = useCallback(async (data: { email: string; password: string; full_name: string; phone: string; payout_qr_url: string; promo_code?: string }): Promise<{ error: string | null }> => {
    const email = data.email.toLowerCase().trim();
    const phone = data.phone.trim();
    const { data: existing } = await supabase.from('affiliates').select('id').eq('email', email).maybeSingle();
    if (existing) return { error: 'Ginagamit na ang email na ito.' };

    // Check if this email matches an existing GoPalengke user (seller/rider/buyer)
    let linkedUserId: string | null = null;
    const { data: linkedProfile } = await supabase
      .from('profiles')
      .select('id, phone')
      .eq('email', email)
      .maybeSingle();
    if (linkedProfile) {
      linkedUserId = (linkedProfile as any).id;
    }

    // Look up sponsor affiliate from ?aff_ref= code (2-tier system)
    let sponsorId: string | null = null;
    const affRefCode = sessionStorage.getItem('gopalengke_aff_ref_code');
    if (affRefCode) {
      const { data: sponsor } = await supabase
        .from('affiliates')
        .select('id')
        .eq('referral_code', affRefCode)
        .maybeSingle();
      if (sponsor) sponsorId = (sponsor as any).id;
      sessionStorage.removeItem('gopalengke_aff_ref_code');
    }

    // If no explicit affiliate invite link, check if this user was already
    // referred by an affiliate as a seller/rider — that affiliate becomes their sponsor.
    if (!sponsorId && linkedUserId) {
      const { data: existingReferral } = await supabase
        .from('affiliate_referrals')
        .select('affiliate_id')
        .eq('referred_user_id', linkedUserId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (existingReferral) sponsorId = (existingReferral as any).affiliate_id;
    }

    // If still no sponsor, default to admin affiliate account (5F7249C1)
    if (!sponsorId) {
      const { data: adminAffiliate } = await supabase
        .from('affiliates')
        .select('id')
        .eq('referral_code', '5F7249C1')
        .maybeSingle();
      if (adminAffiliate) sponsorId = (adminAffiliate as any).id;
    }

    const { data: inserted, error } = await supabase
      .from('affiliates')
      .insert({
        email,
        full_name: data.full_name.trim(),
        phone,
        payout_qr_url: data.payout_qr_url,
        promo_code: data.promo_code?.trim() || '',
        password_hash: simpleHash(data.password),
        linked_user_id: linkedUserId,
        sponsor_id: sponsorId,
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
