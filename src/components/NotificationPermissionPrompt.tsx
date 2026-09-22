import { useState, useEffect } from 'react';
import { Bell, BellRing, X } from 'lucide-react';
import { isPushSupported, initPushNotifications } from '@/lib/pushNotifications';
import { useAuth } from '@/lib/auth';

const DISMISSAL_KEY = 'gopalengke_push_dismissed';

export function NotificationPermissionPrompt() {
  const { profile } = useAuth();
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'done'>('idle');

  useEffect(() => {
    if (!profile) return;
    if (!isPushSupported()) return;

    // Don't show if already granted or denied
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      return;
    }

    // Don't show if user dismissed before
    const dismissed = localStorage.getItem(DISMISSAL_KEY);
    if (dismissed === 'true') return;

    // Small delay so it doesn't appear instantly on page load
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, [profile]);

  async function handleEnable() {
    if (!profile) return;
    setStatus('requesting');
    const { permission, subscribed } = await initPushNotifications(profile.id, profile.role);
    setStatus('done');
    if (permission === 'granted' && subscribed) {
      setVisible(false);
    } else if (permission === 'denied') {
      setVisible(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSAL_KEY, 'true');
    setVisible(false);
  }

  if (!visible || status === 'done') return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[80] w-[calc(100%-2.5rem)] max-w-sm animate-[slideUp_0.3s_ease-out]">
      <div className="bg-white rounded-2xl shadow-xl border border-brand-100 p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
          <BellRing size={20} className="text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">I-on ang Notifications</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            Makatanggap ng real-time alerts para sa bagong orders, delivery updates, at mahalagang mensahe — kahit sarado ang browser.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleEnable}
              disabled={status === 'requesting'}
              className="flex-1 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {status === 'requesting' ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Nagse-set up...
                </>
              ) : (
                <>
                  <Bell size={14} /> I-on
                </>
              )}
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-2 bg-gray-100 text-gray-500 rounded-xl text-xs font-medium active:scale-[0.98] transition"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
