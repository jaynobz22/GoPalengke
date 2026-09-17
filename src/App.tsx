import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { supabase } from './lib/supabase';
import { AuthProvider, useAuth } from './lib/auth';
import { navigate, useRoute, useLegalRoute, useTutorialRoute, useAffiliateRoute } from './lib/router';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { BuyerApp } from './pages/BuyerApp';
import { SellerApp } from './pages/SellerApp';
import { RiderApp } from './pages/RiderApp';
import { AdminApp } from './pages/AdminApp';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PublicPages } from './components/PublicPages';
import { LegalPages, type LegalPageType } from './components/LegalPages';
import { TutorialPage } from './components/TutorialPage';
import { AffiliateApp } from './pages/AffiliateApp';

function AppContent() {
  const { session, profile, loading, pendingVerification } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const publicRoute = useRoute();
  const legalRoute = useLegalRoute();
  const tutorialRoute = useTutorialRoute();
  const affiliateRoute = useAffiliateRoute();

  // Capture referral code from URL (?ref=CODE for seller/rider, ?aff_ref=CODE for affiliate invite) and clean the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    const affRef = params.get('aff_ref');
    if (ref) {
      sessionStorage.setItem('gopalengke_ref_code', ref);
    }
    if (affRef) {
      sessionStorage.setItem('gopalengke_aff_ref_code', affRef);
    }
    if (ref || affRef) {
      const url = new URL(window.location.href);
      url.searchParams.delete('ref');
      url.searchParams.delete('aff_ref');
      window.history.replaceState({}, '', url.pathname);
    }
  }, []);

  // Affiliate sub-system — fully isolated, takes priority
  if (affiliateRoute.isAffiliate) {
    return <AffiliateApp subpath={affiliateRoute.subpath} />;
  }

  // Tutorial page — visible even without login
  if (tutorialRoute) {
    return <TutorialPage />;
  }

  // Legal pages — visible even without login
  if (legalRoute) {
    return <LegalPages type={legalRoute as LegalPageType} onBack={() => navigate('/')} />;
  }

  // Public profile/store pages take priority — visible even without login
  if (publicRoute) {
    return <PublicPages />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Naglo-load...</p>
        </div>
      </div>
    );
  }

  if (pendingVerification) {
    return <AuthPage onBack={() => navigate('/')} />;
  }

  if (!session) {
    if (showAuth) return <AuthPage onBack={() => setShowAuth(false)} />;
    return <LandingPage onGetStarted={() => setShowAuth(true)} />;
  }

  if (!profile) {
    return <AuthPage needsProfile onBack={() => navigate('/')} />;
  }

  // Pending approval screen for non-admin, non-seller users (riders still need approval)
  if (!profile.is_approved && profile.role !== 'admin' && profile.role !== 'seller') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-5">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Clock size={32} className="text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Naghihintay ng Approval</h2>
          <p className="text-sm text-gray-500 mb-4">
            Ang iyong account ay naghihintay pa ng pag-apruba mula sa admin.
            Makikipag-ugnayan ka sa admin para ma-activate ang iyong account.
          </p>
          <button
            onClick={async () => { await supabase.auth.signOut(); }}
            className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm"
          >
            Mag-sign out
          </button>
        </div>
      </div>
    );
  }

  if (profile.role === 'buyer') return <BuyerApp />;
  if (profile.role === 'seller') return <SellerApp />;
  if (profile.role === 'rider') return <RiderApp />;
  if (profile.role === 'admin') return <ErrorBoundary><AdminApp /></ErrorBoundary>;

  return <LandingPage onGetStarted={() => setShowAuth(true)} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
