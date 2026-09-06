import { AlertCircle } from 'lucide-react';

export function InactiveBanner() {
  return (
    <div className="mx-5 mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-2">
      <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
      <p className="text-xs text-amber-700 font-medium">
        Ang iyong account ay pansamantalang hindi aktibo. View mode lang — hindi ka makakagawa ng anuman hanggang i-activate ka ng admin.
      </p>
    </div>
  );
}

export function useCanAct(): boolean {
  // This is meant to be called from within a component that has access to useAuth.
  // We re-export a helper for convenience but the actual check is done in each app.
  return true;
}
