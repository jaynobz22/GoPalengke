import { useEffect } from 'react';
import { AffiliateAuthProvider, useAffiliateAuth } from '@/lib/affiliateAuth';
import { navigate } from '@/lib/router';
import { AffiliateLanding } from '@/components/affiliate/AffiliateLanding';
import { AffiliateAuth } from '@/components/affiliate/AffiliateAuth';
import { AffiliateDashboard } from '@/components/affiliate/AffiliateDashboard';
import { AffiliateTerms } from '@/components/affiliate/AffiliateTerms';
import { Loader2 } from 'lucide-react';

export function AffiliateApp({ subpath }: { subpath: string }) {
  return (
    <AffiliateAuthProvider>
      <AffiliateRouter subpath={subpath} />
    </AffiliateAuthProvider>
  );
}

function AffiliateRouter({ subpath }: { subpath: string }) {
  const { affiliate, loading } = useAffiliateAuth();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [subpath]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  // /affiliate/dashboard — requires auth
  if (subpath === '/dashboard') {
    if (!affiliate) {
      return <AffiliateAuth mode="login" />;
    }
    return <AffiliateDashboard />;
  }

  // /affiliate/register
  if (subpath === '/register') {
    if (affiliate) {
      return <AffiliateDashboard />;
    }
    return <AffiliateAuth mode="register" />;
  }

  // /affiliate/login
  if (subpath === '/login') {
    if (affiliate) {
      return <AffiliateDashboard />;
    }
    return <AffiliateAuth mode="login" />;
  }

  // /affiliate/terms — public legal page
  if (subpath === '/terms') {
    return <AffiliateTerms />;
  }

  // /affiliate (landing)
  return <AffiliateLanding />;
}
