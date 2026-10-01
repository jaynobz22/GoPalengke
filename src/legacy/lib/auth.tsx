// @ts-nocheck
import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Profile, UserRole, VehicleType } from "./types";
import { isAccountBanned, isAccountSuspended, getAccountStatusLabel, checkDeviceFingerprint } from "./security";
import { sendWelcomeEmail as sendWelcomeEmailFn } from "../../lib/welcome-email.functions";

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  pendingVerification: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
    location: { barangay: string; district: string; city: string; region: string; phone: string },
  ) => Promise<{ error: string | null; userId?: string }>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsVerification?: boolean; userId?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  sendEmailOtp: (email: string) => Promise<{ error: string | null }>;
  verifyEmailOtp: (email: string, token: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingVerification, setPendingVerification] = useState(false);
  const pendingVerificationRef = useRef(false);

  function setPendingVerif(value: boolean) {
    pendingVerificationRef.current = value;
    setPendingVerification(value);
  }

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    const prof = data as Profile | null;
    if (prof) {
      if (isAccountBanned(prof.account_status) || isAccountSuspended(prof.account_status)) {
        alert(`Your account has been ${getAccountStatusLabel(prof.account_status)}. Please contact support.`);
        await supabase.auth.signOut();
        setProfile(null);
        setSession(null);
        return;
      }
    }
    setProfile(prof);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (pendingVerificationRef.current) {
        setSession(null);
        setProfile(null);
        return;
      }
      setSession(newSession);
      if (newSession?.user) {
        fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signUp(
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
    location: { barangay: string; district: string; city: string; region: string; phone: string },
    vehicleType?: VehicleType,
  ): Promise<{ error: string | null; userId?: string }> {
    setPendingVerif(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setPendingVerif(false);
      return { error: error.message };
    }
    if (!data.user) {
      setPendingVerif(false);
      return { error: "Hindi makapag-sign up. Subukan ulit." };
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      email,
      full_name: fullName,
      role,
      phone: location.phone || null,
      barangay: location.barangay || null,
      district: location.district || null,
      city: location.city || null,
      region: location.region || null,
      email_verified: false,
      phone_verified: true,
      is_approved: role === "buyer",
      vehicle_type: role === "rider" ? vehicleType || "motorcycle" : null,
    });

    if (profileError) {
      setPendingVerif(false);
      return { error: profileError.message };
    }

    await supabase.auth.signOut();
    return { error: null, userId: data.user.id };
  }

  async function signIn(
    email: string,
    password: string,
  ): Promise<{ error: string | null; needsVerification?: boolean; userId?: string }> {
    pendingVerificationRef.current = true;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      pendingVerificationRef.current = false;
      return { error: error.message };
    }
    if (!data.user) {
      pendingVerificationRef.current = false;
      return { error: "Hindi makapag-sign in. Subukan ulit." };
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("email_verified, phone_verified, role, is_test_account")
      .eq("id", data.user.id)
      .maybeSingle();

    const p = prof as {
      email_verified: boolean;
      phone_verified: boolean;
      role: string;
      is_test_account: boolean;
    } | null;
    if (p && !p.email_verified) {
      await supabase.auth.signOut();
      setPendingVerif(true);
      return { error: null, needsVerification: true, userId: data.user.id };
    }

    pendingVerificationRef.current = false;
    setSession(data.session);
    await fetchProfile(data.user.id);

    // Security: check device fingerprint for botnet detection
    // Skip for admin accounts and test accounts (used for testing the app)
    const skipDeviceCheck = p && (p.role === "admin" || p.is_test_account);
    if (!skipDeviceCheck) {
      try {
        const deviceCheck = await checkDeviceFingerprint(data.user.id);
        if (deviceCheck.banned) {
          alert("This device has been blacklisted for suspicious activity. Please contact support.");
          await supabase.auth.signOut();
          setProfile(null);
          setSession(null);
          return { error: "Device blacklisted." };
        }
        if (deviceCheck.flagged) {
          alert("Multiple accounts detected on this device. Account banned for security.");
          await supabase.auth.signOut();
          setProfile(null);
          setSession(null);
          return { error: "Account banned due to botnet detection." };
        }
      } catch {
        /* best-effort */
      }
    }

    return { error: null };
  }

  // Welcome email — ipinapadala pagkatapos ma-verify ang 8-digit code.
  // May role-specific checklist, paalala sa admin approval, GPS location access, at tutorial link.
  async function sendWelcomeEmail(accessToken: string) {
    try {
      await sendWelcomeEmailFn({ data: { accessToken } });
    } catch (e) {
      console.error("Welcome email error:", e);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }

  async function refreshProfile() {
    if (session?.user) await fetchProfile(session.user.id);
  }

  // Watch for account_status changes in real-time (force logout on suspension/ban)
  useEffect(() => {
    if (!profile?.id) return;
    const sub = supabase
      .channel(`account-status-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${profile.id}` },
        (payload: any) => {
          const newStatus = payload.new?.account_status;
          if (isAccountBanned(newStatus) || isAccountSuspended(newStatus)) {
            alert(`Your account has been ${getAccountStatusLabel(newStatus)}. You will be logged out.`);
            (async () => {
              await supabase.auth.signOut();
              setProfile(null);
              setSession(null);
            })();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [profile?.id]);

  // 1. Function para mag-send o mag-resend ng 8-digit OTP code sa email ng user
  async function sendEmailOtp(email: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    if (error) return { error: error.message };
    return { error: null };
  }

  // 2. Ang verifyOtp function para mag-verify ng 8-digit code na tinype ng user
  async function verifyEmailOtp(email: string, token: string): Promise<{ error: string | null }> {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "magiclink",
    });

    if (error) {
      return { error: error.message };
    }

    // Kapag tama ang code, i-update ang custom 'profiles' table para maging true ang email_verified
    if (data?.user) {
      await supabase.from("profiles").update({ email_verified: true }).eq("id", data.user.id);

      pendingVerificationRef.current = false;
      setPendingVerification(false);
      setSession(data.session);
      await fetchProfile(data.user.id);

      // Agad na magpadala ng welcome email pagkatapos ma-verify ang code.
      if (data.session?.access_token) {
        sendWelcomeEmail(data.session.access_token);
      }
    }

    return { error: null };
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        pendingVerification,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        sendEmailOtp,
        verifyEmailOtp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
