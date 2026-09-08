import { useEffect, useState } from 'react';
import { X, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ReminderItem {
  icon: React.ReactNode;
  text: string;
}

interface Props {
  storageKey: string;
  variant: 'seller' | 'buyer';
}

const SELLER_REMINDERS: ReminderItem[] = [
  {
    icon: <ShieldCheck size={20} className="text-green-600" />,
    text: 'Siguraduhin palagi na Class A at sariwa ang produkto na ibibigay mo sa mga mamimili. Hindi pwede ang bulok, luma, o sira na paninda.',
  },
  {
    icon: <AlertTriangle size={20} className="text-red-600" />,
    text: 'Isang negative review lang ng buyer tungkol sa bulok o sira na food products — alis ka agad sa platform. Walang second chance, walang pakiusap.',
  },
  {
    icon: <ShieldCheck size={20} className="text-green-600" />,
    text: 'Ikaw ang pipili kung Class A ka. Kung hindi mo kayang ibigay ang maayos na produkto, huwag na lang magbenta dito.',
  },
];

const BUYER_REMINDERS: ReminderItem[] = [
  {
    icon: <ShieldCheck size={20} className="text-green-600" />,
    text: 'Bago ka bumili, i-chat at i-video call muna ang seller para siguraduhin na legit ang tindahan at makita mo ang mismong produktong bibilhin mo.',
  },
  {
    icon: <AlertTriangle size={20} className="text-amber-600" />,
    text: 'Kung COD (Cash on Delivery) ang payment mo, siguraduhin na may tao sa bahay para magbayad at tatanggap ng order pagdating ng rider.',
  },
  {
    icon: <ShieldCheck size={20} className="text-green-600" />,
    text: 'Huwag mag-atubili mag-order kung hindi mo nakausap o nakita ang seller. Ang kaligtasan ng pera mo ang nakataya dito.',
  },
];

export function LoginReminderPopup({ storageKey, variant }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem(storageKey);
    if (!dismissed) {
      const timer = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  function handleClose() {
    setVisible(false);
    sessionStorage.setItem(storageKey, 'dismissed');
  }

  if (!visible) return null;

  const reminders = variant === 'seller' ? SELLER_REMINDERS : BUYER_REMINDERS;
  const title = variant === 'seller' ? 'Paalala sa Seller' : 'Paalala sa Buyer';
  const subtitle =
    variant === 'seller'
      ? 'Basahin muna bago magbenta'
      : 'Basahin muna bago bumili';
  const accentColor = variant === 'seller' ? 'text-red-600' : 'text-amber-600';
  const iconBg = variant === 'seller' ? 'bg-red-100' : 'bg-amber-100';
  const headerGradient =
    variant === 'seller'
      ? 'from-red-600 to-red-700'
      : 'from-amber-500 to-orange-600';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-5 animate-fade-in">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-sm shadow-2xl animate-slide-up overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-br ${headerGradient} px-5 pt-6 pb-5 text-white relative`}>
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition"
          >
            <X size={18} className="text-white" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={26} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="text-xs text-white/80">{subtitle}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          {reminders.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                {item.icon}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed pt-1.5">{item.text}</p>
            </div>
          ))}

          {variant === 'seller' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <p className="text-xs font-semibold text-red-700">
                Walang second chance. Isang beses lang ang pagkakamali.
              </p>
            </div>
          )}
          {variant === 'buyer' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
              <p className="text-xs font-semibold text-amber-700">
                Chat at video call muna bago bumili. Sigurado, walang pagsisihan.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={handleClose}
            className={`w-full py-3.5 bg-gradient-to-r ${headerGradient} text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition shadow-lg`}
          >
            {variant === 'seller' ? 'Naintindihan ko' : 'Sige, gets ko'}
          </button>
        </div>
      </div>
    </div>
  );
}
