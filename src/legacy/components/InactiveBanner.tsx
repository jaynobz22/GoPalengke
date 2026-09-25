// @ts-nocheck
import { AlertCircle, Wallet } from 'lucide-react';

export function InactiveBanner({ reason }: { reason?: 'billing' | 'admin' }) {
  const isBilling = reason === 'billing';
  return (
    <div className={`mx-5 mt-4 ${isBilling ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'} border rounded-2xl p-3 flex items-center gap-2`}>
      {isBilling ? <Wallet size={18} className="text-red-600 flex-shrink-0" /> : <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />}
      <p className={`text-xs font-medium ${isBilling ? 'text-red-700' : 'text-amber-700'}`}>
        {isBilling
          ? 'Naka-suspend ang account mo dahil umabot na ng ₱500 ang naipong platform fee. Pumunta sa Billing tab para magbayad at ma-activate ulit ang account mo.'
          : 'Your account is temporarily inactive. View mode only — you cannot perform any actions until the admin activates you.'}
      </p>
    </div>
  );
}

export function useCanAct(): boolean {
  // This is meant to be called from within a component that has access to useAuth.
  // We re-export a helper for convenience but the actual check is done in each app.
  return true;
}
