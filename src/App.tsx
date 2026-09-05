import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { BuyerApp } from './pages/BuyerApp';
import { SellerApp } from './pages/SellerApp';
import { RiderApp } from './pages/RiderApp';

function AppContent() {
  const { session, profile, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

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

  if (!session) {
    if (showAuth) return <AuthPage onBack={() => setShowAuth(false)} />;
    return <LandingPage onGetStarted={() => setShowAuth(true)} />;
  }

  if (!profile) {
    return <AuthPage needsProfile />;
  }

  if (profile.role === 'buyer') return <BuyerApp />;
  if (profile.role === 'seller') return <SellerApp />;
  if (profile.role === 'rider') return <RiderApp />;

  return <LandingPage onGetStarted={() => setShowAuth(true)} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
