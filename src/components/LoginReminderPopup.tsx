import { useEffect, useState } from 'react';
import { X, AlertTriangle, ShieldCheck, MessageCircle, Video, Home } from 'lucide-react';

interface Props {
  storageKey: string;
  variant: 'seller' | 'buyer';
}

const SELLER_REMINDERS = [
  { icon: <ShieldCheck size={18} className="text-green-600" />, text: 'Class A at sariwa palagi ang produkto na ibibigay mo. Hindi pwede ang bulok, luma, o sira na paninda.' },
  { icon: <AlertTriangle size={18} className="text-red-600" />, text: 'Isang negative review lang ng buyer tungkol sa bulok o sira na food products — alis ka agad sa platform. Walang second chance.' },
];

const BUYER_REMINDERS = [
  { icon: <MessageCircle size={18} className="text-green-600" />, text: 'Bago bumili, i-chat at i-video call muna ang seller para siguraduhing legit at makita mo ang produktong bibilhin mo.' },
  { icon: <Home size={18} className="text-amber-600" />, text: 'Kung COD, siguraduhing may tao sa bahay para magbayad at tatanggap ng order pagdating ng rider.' },
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
  const headerGradient = variant === 'seller' ? 'from-red-600 to-red-700' : 'from-amber-500 to-orange-600';
  const footerBg = variant === 'seller' ? 'bg-red-600' : 'bg-amber-500';
  const tagBg = variant === 'seller' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700';
  const tagText = variant === 'seller' ? 'Walang second chance. Isang beses lang.' : 'Chat at video call muna bago bumili.';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-6 animate-fade-in">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-[340px] shadow-2xl animate-slide-up overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-br ${headerGradient} px-4 py-3.5 text-white relative flex items-center gap-2.5`}>
          <AlertTriangle size={20} className="text-white flex-shrink-0" />
          <h2 className="text-base font-bold flex-1">{title}</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center active:scale-90 transition flex-shrink-0"
          >
            <X size={18} className="text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-3">
          {reminders.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="flex-shrink-0 mt-0.5">{item.icon}</div>
              <p className="text-[13px] text-gray-700 leading-relaxed">{item.text}</p>
            </div>
          ))}
          <div className={`${tagBg} rounded-lg px-3 py-2 text-center`}>
            <p className="text-xs font-semibold">{tagText}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4">
          <button
            onClick={handleClose}
            className={`w-full py-3 ${footerBg} text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition`}
          >
            {variant === 'seller' ? 'Naintindihan ko' : 'Sige, gets ko'}
          </button>
        </div>
      </div>
    </div>
  );
}
