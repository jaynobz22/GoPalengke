// @ts-nocheck
import { useState } from 'react';
import { MapPin, X, Navigation, Settings } from 'lucide-react';

type Role = 'buyer' | 'seller' | 'rider';

const ROLE_NOTE: Record<Role, string> = {
  buyer:
    'Kailangan ng lokasyon mo para matukoy ang pinakamalapit na palengke at makalkula ang tamang delivery fee papunta sa bahay mo.',
  seller:
    'Kailangan ng lokasyon mo para ma-pin ang eksaktong puwesto ng tindahan mo, at para tama ang distansya papunta sa mga buyer.',
  rider:
    'Kailangan ng lokasyon mo para sa live navigation papunta sa tindahan at sa bahay ng buyer, at para tama ang bayad sa biyahe.',
};

interface Props {
  open: boolean;
  role?: Role;
  /** Tinatawag kapag pinindot ang "I-allow at Subukan Muli". Dapat mag-request ulit ng GPS. */
  onRetry: () => void;
  onClose: () => void;
}

export function GpsPermissionModal({ open, role = 'buyer', onRetry, onClose }: Props) {
  const [showHelp, setShowHelp] = useState(false);
  const [retrying, setRetrying] = useState(false);

  if (!open) return null;

  function handleRetry() {
    setRetrying(true);
    try {
      // Direktang hilingin ulit ang permission mula sa browser/phone.
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => {
            setRetrying(false);
            onRetry();
            onClose();
          },
          () => {
            setRetrying(false);
            setShowHelp(true);
            onRetry();
          },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
        );
      } else {
        setRetrying(false);
        setShowHelp(true);
      }
    } catch {
      setRetrying(false);
      setShowHelp(true);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-5 animate-fade-in">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-[360px] shadow-2xl animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-brand-600 to-green-700 px-4 py-3.5 text-white flex items-center gap-2.5">
          <span className="relative flex-shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-white/40 animate-ping" />
            <MapPin size={20} className="relative text-white" />
          </span>
          <h2 className="text-base font-bold flex-1">Kailangan ang Lokasyon (GPS)</h2>
          <button
            onClick={onClose}
            aria-label="Isara"
            className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center active:scale-90 transition flex-shrink-0"
          >
            <X size={18} className="text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-3 max-h-[55vh] overflow-y-auto overscroll-contain">
          <p className="text-[13px] text-gray-700 leading-relaxed">
            Hindi makuha ng GoPalengke ang lokasyon ng iyong phone. Pakipayagan ang{' '}
            <span className="font-semibold">location access</span> para lang sa pagkalkula ng distansya.
          </p>

          <div className="bg-brand-50 rounded-xl px-3 py-2.5 flex items-start gap-2.5">
            <Navigation size={16} className="text-brand-600 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-brand-800 leading-relaxed">{ROLE_NOTE[role]}</p>
          </div>

          <p className="text-[12px] text-gray-500 leading-relaxed">
            Ang lokasyon mo ay ginagamit lamang para sa distance calculation. Hindi namin ito ibinabahagi sa iba.
          </p>

          {showHelp && (
            <div className="bg-amber-50 rounded-xl px-3 py-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <Settings size={15} className="text-amber-700 flex-shrink-0" />
                <p className="text-[13px] font-semibold text-amber-800">Kung naka-block na dati:</p>
              </div>
              <ul className="text-[12px] text-amber-800 leading-relaxed list-disc pl-5 space-y-1">
                <li>Sa phone/laptop browser: pindutin ang lock icon sa tabi ng address bar.</li>
                <li>Piliin ang Permissions o Site settings, hanapin ang Location.</li>
                <li>Palitan ito ng Allow, tapos i-reload ang page.</li>
                <li>Siguraduhin ding naka-ON ang Location Services ng phone mo.</li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 space-y-2">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="w-full py-3 rounded-xl bg-brand-600 text-white text-sm font-bold active:scale-[0.98] transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {retrying ? (
              <>
                <span className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                Hinahanap ang lokasyon...
              </>
            ) : (
              <>
                <MapPin size={16} />
                I-allow at Subukan Muli
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold active:scale-[0.98] transition"
          >
            Mamaya na
          </button>
        </div>
      </div>
    </div>
  );
}
