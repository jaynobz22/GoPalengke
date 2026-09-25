// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, deleteStorageObject } from '../lib/supabase';
import { checkRiderBatch } from '../lib/riderBatch';
import { useAuth } from '../lib/auth';
import { navigate } from '../lib/router';
import { checkPriceAnomaly } from '../lib/security';
import { haversineKm, VEHICLE_TIERS, PALENGKE_COORDS, type VehicleTier } from '../lib/deliveryFee';
import type { Store, Product, Order, OrderItem, OrderStatus, Conversation, SellerFee, AdminConversation } from '../lib/types';
import { PAYMENT_THRESHOLD } from '../lib/types';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../lib/types';
import { getCityMarkets, formatRegionForDisplay } from '../lib/philippineLocations';
import { LocationSelector, type LocationData } from '../components/LocationSelector';
import { compressImage } from '../lib/imageCompress';
import { ImageUploadField } from '../components/ImageUploadField';
import { ChatView, getOrCreateConversation } from '../components/ChatView';
import { Avatar } from '../components/Avatar';
import { InactiveBanner } from '../components/InactiveBanner';
import { SellerBilling } from '../components/SellerBilling';
import { ReviewSection } from '../components/Reviews';
import { OrderStepTracker, type StepInfo } from '../components/OrderStepTracker';
import { AdminVideoCall } from '../components/AdminVideoCall';
import { AdminChat } from '../components/AdminChat';
import { LoginReminderPopup } from '../components/LoginReminderPopup';
import { VideoCreditStore } from '../components/VideoCreditStore';
import { useIncomingAdminCall } from '../lib/useAdminCall';
import { useAdminConversations } from '../lib/useAdminChat';
import {
  Store as StoreIcon, Package, Plus, ArrowLeft, Edit, Trash2, X,
  Star, MapPin, QrCode, Upload, Check, ShoppingBag, Bike, Phone, Clock,
  TrendingUp, DollarSign, Bell, Camera, Loader2, MessageCircle,
  Share2, Copy, ExternalLink, Search, ImageIcon, Wallet, Lock, AlertTriangle,
  LogOut, Eye, EyeOff, Users, Radio, Shield, Sprout, Info, CalendarClock,
} from 'lucide-react';

type Tab = 'dashboard' | 'products' | 'orders' | 'messages' | 'billing';

export function SellerApp() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [chatPartnerName, setChatPartnerName] = useState('');
  const [chatPartnerRole, setChatPartnerRole] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sellerFee, setSellerFee] = useState<SellerFee | null>(null);
  const [showFreezeWarning, setShowFreezeWarning] = useState(false);
  const [isFeeFrozen, setIsFeeFrozen] = useState(false);
  const { incomingCall, adminName, clearCall } = useIncomingAdminCall();
  const [activeAdminCall, setActiveAdminCall] = useState<{ roomId: string; callId: string; otherName: string } | null>(null);
  const { conversations: adminConvs, unreadCount: adminUnread } = useAdminConversations();
  const [activeAdminChat, setActiveAdminChat] = useState<{ conversationId: string; otherName: string } | null>(null);

  const loadStore = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('stores').select('*').eq('seller_id', profile.id).maybeSingle();
    setStore(data as Store | null);
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadStore(); }, [loadStore]);

  // Update store coordinates from seller's live phone GPS so delivery fees use
  // the seller's actual current location instead of a static palengke/city center.
  // Waits until the login reminder popup is dismissed before requesting
  // geolocation so the browser permission dialog doesn't overlap with it.
  useEffect(() => {
    if (!store) return;
    if (!navigator.geolocation) return;
    let cancelled = false;

    function requestGps() {
      if (cancelled) return;
      sessionStorage.setItem('gopalengke_gps_fired_at', Date.now().toString());
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const curLat = store.latitude;
          const curLng = store.longitude;
          const moved = curLat == null || curLng == null ||
            Math.abs(curLat - lat) > 0.001 || Math.abs(curLng - lng) > 0.001;
          if (moved) {
            supabase.from('stores').update({ latitude: lat, longitude: lng }).eq('id', store.id);
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }

    const reminderKey = 'seller_login_reminder';
    if (sessionStorage.getItem(reminderKey) === 'dismissed') {
      requestGps();
    } else {
      const interval = setInterval(() => {
        if (cancelled) return;
        if (sessionStorage.getItem(reminderKey) === 'dismissed') {
          clearInterval(interval);
          requestGps();
        }
      }, 500);
      return () => { cancelled = true; clearInterval(interval); };
    }

    return () => { cancelled = true; };
  }, [store?.id]);

  // Realtime: reload store when it changes (e.g. admin verifies the store)
  useEffect(() => {
    if (!profile) return;
    const sub = supabase.channel('seller-store-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stores', filter: `seller_id=eq.${profile.id}` }, () => loadStore())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [profile, loadStore]);

  // Check and apply freezes, then load seller fee data
  useEffect(() => {
    if (!profile) return;
    async function checkFreeze() {
      await supabase.rpc('freeze_overdue_sellers');
      const { data } = await supabase.from('seller_fees').select('*').eq('seller_id', profile.id).maybeSingle();
      const fee = data as SellerFee | null;
      setSellerFee(fee);
      if (fee?.frozen_at) {
        setIsFeeFrozen(true);
      } else {
        setIsFeeFrozen(false);
        if (fee?.grace_deadline && (fee.total_payable || 0) >= PAYMENT_THRESHOLD) {
          setShowFreezeWarning(true);
        }
      }
    }
    checkFreeze();
  }, [profile]);

  // Track unread messages for badge
  useEffect(() => {
    if (!profile) return;
    const userId = profile.id;
    async function countUnread() {
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .eq('seller_id', userId);
      if (!convs || convs.length === 0) { setUnreadCount(0); return; }
      const convIds = convs.map(c => c.id);
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .neq('sender_id', userId)
        .is('read_at', null);
      setUnreadCount(count || 0);
    }
    countUnread();
    const sub = supabase.channel('seller-unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => countUnread())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [profile]);

  const totalUnread = unreadCount + adminUnread;

  async function openChat(order: Order, buyerName: string) {
    if (!profile) return;
    const conv = await getOrCreateConversation(order.id, order.buyer_id, 'buyer_seller', profile.id, null);
    if (conv) {
      setActiveConversationId(conv.id);
      setChatPartnerName(buyerName);
      setChatPartnerRole('Buyer');
      setShowChat(true);
    }
  }

  function openChatFromMessages(convId: string, name: string, role: string) {
    setActiveConversationId(convId);
    setChatPartnerName(name);
    setChatPartnerRole(role);
    setShowChat(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!store) {
    return <CreateStoreView onCreated={loadStore} />;
  }

  const canAct = profile?.is_active ?? true;

  // Frozen due to unpaid fees — full screen block
  if (isFeeFrozen) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-5 max-w-md mx-auto">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <Lock size={40} className="text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">Naka-freeze ang Account</h2>
        <p className="text-sm text-gray-500 text-center mb-1">
          Na-freeze ang iyong account dahil hindi nabayaran ang payable na ₱{(Number(sellerFee?.total_payable) || 0).toFixed(2)}.
        </p>
        <p className="text-sm text-gray-500 text-center mb-6">
          Magbayad muna sa admin para ma-reactivate ang iyong account at makapag-negosyo ulit.
        </p>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 w-full mb-4">
          <p className="text-xs text-gray-400 mb-1">Total Payable</p>
          <p className="text-2xl font-bold text-red-600">₱{(Number(sellerFee?.total_payable) || 0).toFixed(2)}</p>
        </div>
        <a
          href="mailto:jdabblogger@gmail.com"
          className="w-full py-3.5 bg-brand-600 text-white rounded-xl font-semibold text-sm text-center active:scale-95 transition flex items-center justify-center gap-2"
        >
          <MessageCircle size={18} />
          Contact Admin
        </a>
        <button
          onClick={async () => { await supabase.auth.signOut(); }}
          className="mt-3 px-6 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm"
        >
          Mag-sign out
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full max-w-7xl mx-auto relative">
      {!canAct && !isFeeFrozen && <InactiveBanner />}
      {!store.is_verified && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center gap-2">
          <Shield size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700 font-medium">
            Para sa Pag-verify pa ng Admin — hindi pa nakikita ng buyers ang iyong tindahan. Maghintay ng video call o chat mula sa admin para ma-verify.
          </p>
        </div>
      )}
      <div className="flex-1 pb-24 overflow-y-auto">
        {tab === 'dashboard' && <SellerDashboard store={store} onEditStore={() => setShowStoreForm(true)} onOpenMessages={() => setTab('messages')} onOpenOrders={() => setTab('orders')} onViewStore={() => navigate(`/s/${store.slug}`)} onSignOut={signOut} unreadMessages={unreadCount} canAct={canAct} />}
        {tab === 'products' && (
          <SellerProducts store={store} onAdd={() => { setEditingProduct(null); setShowProductForm(true); }} onEdit={(p) => { setEditingProduct(p); setShowProductForm(true); }} />
        )}
        {tab === 'orders' && (
          selectedOrder ? (
            <SellerOrderDetail order={selectedOrder} store={store} onBack={() => setSelectedOrder(null)} onOpenChat={openChat} />
          ) : (
            <SellerOrders store={store} onOrderClick={setSelectedOrder} />
          )
        )}
        {tab === 'messages' && (
          <SellerMessagesView onOpenChat={openChatFromMessages} adminConversations={adminConvs} onOpenAdminChat={(convId, name) => {
            setActiveAdminChat({ conversationId: convId, otherName: name });
          }} />
        )}
        {tab === 'billing' && (
          <div className="space-y-4">
            <SellerBilling />
            <div className="px-5">
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <VideoCreditStore />
              </div>
            </div>
          </div>
        )}

        {showChat && activeConversationId && (
          <div className="fixed inset-0 z-[60] bg-gray-50 w-full max-w-4xl mx-auto">
            <ChatView
              conversationId={activeConversationId}
              otherName={chatPartnerName}
              otherRole={chatPartnerRole}
              onBack={() => { setShowChat(false); setActiveConversationId(null); }}
            />
          </div>
        )}
      </div>

      {showProductForm && (
        <ProductFormModal
          store={store}
          product={editingProduct}
          onClose={() => setShowProductForm(false)}
          onSaved={() => { setShowProductForm(false); setTab('products'); }}
        />
      )}

      {showStoreForm && (
        <StoreFormModal store={store} onClose={() => setShowStoreForm(false)} onSaved={() => { setShowStoreForm(false); loadStore(); }} />
      )}

      {activeAdminChat && profile && (
        <AdminChat
          conversationId={activeAdminChat.conversationId}
          currentUserId={profile.id}
          otherName={activeAdminChat.otherName}
          isAdmin={false}
          onBack={() => setActiveAdminChat(null)}
        />
      )}

      {/* Incoming admin video call */}
      {incomingCall && !activeAdminCall && (
        <AdminVideoCall
          roomId={incomingCall.room_id}
          isCaller={false}
          otherName={adminName}
          callId={incomingCall.id}
          onEnd={() => { clearCall(); }}
        />
      )}
      {activeAdminCall && (
        <AdminVideoCall
          roomId={activeAdminCall.roomId}
          isCaller={false}
          otherName={activeAdminCall.otherName}
          callId={activeAdminCall.callId}
          onEnd={() => { setActiveAdminCall(null); clearCall(); }}
        />
      )}

      <SellerBottomNav tab={tab} setTab={setTab} storeId={store.id} unreadMessages={totalUnread} />

      {showFreezeWarning && sellerFee?.grace_deadline && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center px-5">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} className="text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 text-center mb-2">Babayaran na!</h2>
            <p className="text-sm text-gray-500 text-center mb-4">
              Ang total payable mo ay ₱{(Number(sellerFee.total_payable) || 0).toFixed(2)}. Kailangan mong magbayad sa loob ng 3 araw kung hindi, ma-freeze ang iyong account.
            </p>
            <div className="bg-red-50 rounded-xl p-3 mb-4 text-center">
              <p className="text-xs text-red-500 font-medium">Deadline</p>
              <p className="text-sm font-bold text-red-700">
                {new Date(sellerFee.grace_deadline).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <button
              onClick={() => { setTab('billing'); setShowFreezeWarning(false); }}
              className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm active:scale-95 transition mb-2"
            >
              Magbayad Ngayon
            </button>
            <button
              onClick={() => setShowFreezeWarning(false)}
              className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm"
            >
              Mamaya na
            </button>
          </div>
        </div>
      )}

      <LoginReminderPopup storageKey="seller_login_reminder" variant="seller" />
    </div>
  );
}

// ============= CREATE STORE =============
function CreateStoreView({ onCreated }: { onCreated: () => void }) {
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<LocationData>({
    barangay: profile?.barangay || '',
    district: profile?.district || '',
    city: profile?.city || '',
    region: profile?.region || 'NCR',
  });
  const [bannerUrl, setBannerUrl] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('gcash');
  const [palengkeName, setPalengkeName] = useState('');
  const [palengkeCustom, setPalengkeCustom] = useState('');
  const [sellerType, setSellerType] = useState<'palengke' | 'farm' | ''>('');
  const [farmType, setFarmType] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cityMarkets = getCityMarkets(profile?.city || location.city);
  const finalPalengkeName = palengkeName === '__custom__' ? palengkeCustom.trim() : palengkeName;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setCreating(true);
    if (avatarUrl && avatarUrl !== profile.avatar_url) {
      await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', profile.id);
    }
    const palengkeCoords = finalPalengkeName ? PALENGKE_COORDS[finalPalengkeName] : null;
    const { error } = await supabase.from('stores').insert({
      seller_id: profile.id,
      name, description,
      ...(profile.city && profile.barangay
        ? { barangay: profile.barangay, district: profile.district || '', city: profile.city, region: profile.region || location.region }
        : { barangay: location.barangay, district: location.district, city: location.city, region: location.region }),
      latitude: palengkeCoords?.lat ?? null,
      longitude: palengkeCoords?.lng ?? null,
      banner_url: bannerUrl || null,
      qr_code_url: qrCodeUrl || null,
      payment_method: paymentMethod,
      palengke_name: sellerType === 'palengke' ? (finalPalengkeName || null) : null,
      seller_type: sellerType || null,
      farm_type: sellerType === 'farm' ? (farmType || null) : null,
    });
    setCreating(false);
    if (error) { setError(error.message); return; }
    onCreated();
  }

  return (
    <div className="min-h-screen bg-gray-50 px-5 pt-12 pb-8 overflow-y-auto">
      <div className="flex items-center gap-2 mb-6">
        <StoreIcon size={24} className="text-brand-600" />
        <h1 className="text-xl font-bold text-gray-800">Gumawa ng Tindahan</h1>
      </div>
      <p className="text-gray-500 mb-6 text-sm">I-set up ang iyong tindahan para makapagbenta na sa GoPalengke!</p>
      <form onSubmit={create} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">Pangalan ng Tindahan</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Aling Nena Fish Stall" required
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-500 outline-none transition" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Sariwang isda mula sa Navotas..." rows={2}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-500 outline-none transition resize-none" />
        </div>
        {profile?.city && profile?.barangay ? (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-sm font-medium text-gray-600">Location ng tindahan</p>
            <p className="text-sm text-gray-800 mt-1">
              {[profile.barangay, profile.city, profile.district, profile.region].filter(Boolean).join(', ')}
            </p>
            <p className="text-xs text-gray-400 mt-1">Galing sa address na inilagay mo noong nag-register.</p>
          </div>
        ) : (
          <div>
            <LocationSelector
              value={location}
              onChange={setLocation}
              label="Location ng tindahan"
              compact
            />
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">Saan ka nagbebenta?</label>
          <p className="text-xs text-gray-400 mb-2">May pwesto ka ba sa palengke, o nagbebenta mula sa bahay na may farm/fishpond?</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button type="button" onClick={() => { setSellerType('palengke'); setFarmType(''); }}
              className={`p-3 rounded-xl border-2 text-left transition ${sellerType === 'palengke' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white'}`}>
              <StoreIcon size={18} className={sellerType === 'palengke' ? 'text-brand-600' : 'text-gray-400'} />
              <p className="text-sm font-semibold text-gray-800 mt-1">May Pwesto sa Palengke</p>
              <p className="text-xs text-gray-500">May stall sa physical wet market</p>
            </button>
            <button type="button" onClick={() => { setSellerType('farm'); setPalengkeName(''); setPalengkeCustom(''); }}
              className={`p-3 rounded-xl border-2 text-left transition ${sellerType === 'farm' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white'}`}>
              <Sprout size={18} className={sellerType === 'farm' ? 'text-brand-600' : 'text-gray-400'} />
              <p className="text-sm font-semibold text-gray-800 mt-1">Farm / Bahay</p>
              <p className="text-xs text-gray-500">Nagbebenta mula sa sariling farm</p>
            </button>
          </div>
        </div>

        {sellerType === 'palengke' && (
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Pangalan ng Palengke</label>
            <p className="text-xs text-gray-400 mb-1.5">Piliin ang palengke kung saan mo pwesto.</p>
            <select value={palengkeName} onChange={e => setPalengkeName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-500 outline-none transition text-sm">
              <option value="">Pumili ng palengke...</option>
              {cityMarkets.map(m => <option key={m} value={m}>{m}</option>)}
              <option value="__custom__">Iba pa...</option>
            </select>
            {palengkeName === '__custom__' && (
              <input type="text" value={palengkeCustom} onChange={e => setPalengkeCustom(e.target.value)} placeholder="Ilagay ang pangalan ng palengke" autoFocus
                className="w-full px-4 py-3 mt-2 rounded-xl border border-gray-200 bg-white focus:border-brand-500 outline-none transition text-sm" />
            )}
          </div>
        )}

        {sellerType === 'farm' && (
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Anong klaseng farm ang meron?</label>
            <p className="text-xs text-gray-400 mb-1.5">Piliin kung anong source ng paninda mo mula sa bahay.</p>
            <select value={farmType} onChange={e => setFarmType(e.target.value)} required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-500 outline-none transition text-sm">
              <option value="">Pumili...</option>
              <option value="vegetable_farm">Gulay / Pananim (Vegetable Farm)</option>
              <option value="fishpond">Fishpond / Fishery</option>
              <option value="poultry">Poultry (Alagang Manok / Itlog)</option>
              <option value="livestock">Livestock (Baboy, Baka, Kambing)</option>
              <option value="mixed">Halo-halo (Mixed Farm)</option>
            </select>
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">Profile Picture ng May-ari</label>
          <p className="text-xs text-gray-400 mb-2">Mag-upload ng larawan para makilala ka ng buyers at riders. Para sa transparency ng transaction.</p>
          <ImageUploadField
            label="Profile Picture"
            value={avatarUrl}
            onChange={async (url) => {
              setAvatarUrl(url);
              if (profile) {
                setAvatarUploading(true);
                await supabase.from('profiles').update({ avatar_url: url || null }).eq('id', profile.id);
                setAvatarUploading(false);
              }
            }}
            bucket="profile-images"
            folder={`avatars/${profile?.id}`}
            aspectClass="h-32"
            icon={<Camera size={16} />}
            cropAspect={1}
          />
          {avatarUploading && <p className="text-xs text-brand-500 mt-1">Nag-a-upload...</p>}
        </div>
        <ImageUploadField
          label="Store Banner"
          value={bannerUrl}
          onChange={setBannerUrl}
          folder="banners"
          aspectClass="h-40"
          icon={<StoreIcon size={16} />}
          cropAspect={16 / 9}
        />
        <ImageUploadField
          label="QR Code (para sa GCash payment)"
          value={qrCodeUrl}
          onChange={setQrCodeUrl}
          folder="qr-codes"
          aspectClass="h-48"
          icon={<QrCode size={16} />}
          hint="I-screenshot ang QR code mo sa GCash app, tapos i-upload dito. Makikita ito ng buyers pag nag-checkout sila."
          cropAspect={1}
        />
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">Payment Method</label>
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-500 outline-none transition">
            <option value="gcash">GCash</option>
            <option value="maya">Maya</option>
            <option value="ebank">E-Bank Transfer</option>
          </select>
        </div>
        {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
        <button type="submit" disabled={creating}
          className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-brand-600/20 active:scale-[0.98] transition disabled:opacity-50">
          {creating ? 'Ginagawa...' : 'Gumawa ng Tindahan'}
        </button>
      </form>
    </div>
  );
}

// ============= DASHBOARD =============
function SellerDashboard({ store, onEditStore, onOpenMessages, onOpenOrders, onViewStore, onSignOut, unreadMessages, canAct }: { store: Store; onEditStore: () => void; onOpenMessages: () => void; onOpenOrders: () => void; onViewStore: () => void; onSignOut: () => void; unreadMessages: number; canAct: boolean }) {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ totalOrders: 0, pendingOrders: 0, totalRevenue: 0, productCount: 0, paidOrders: 0 });
  const [recentOrders, setRecentOrders] = useState<(Order & { buyer: { full_name: string } })[]>([]);
  const [isOpen, setIsOpen] = useState(store.is_open);
  const [toggling, setToggling] = useState(false);

  async function toggleStoreOpen() {
    setToggling(true);
    const newValue = !isOpen;
    await supabase.from('stores').update({ is_open: newValue }).eq('id', store.id);
    setIsOpen(newValue);
    setToggling(false);
  }

  useEffect(() => {
    async function load() {
      const [{ data: orders }, { data: products }, { count }] = await Promise.all([
        supabase.from('orders').select('*, buyer:profiles!orders_buyer_id_fkey(full_name)').eq('store_id', store.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('products').select('*').eq('store_id', store.id),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', store.id),
      ]);

      const allOrders = (orders || []) as any;
      const pending = allOrders.filter((o: any) => o.status === 'pending').length;
      const revenue = allOrders.filter((o: any) => o.status !== 'cancelled').reduce((s: number, o: any) => s + Number(o.total), 0);

      // Count orders with payment_status = 'paid' that are not yet delivered/cancelled
      const { count: paidCount } = await supabase.from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store.id)
        .eq('payment_status', 'paid')
        .in('status', ['accepted', 'preparing', 'ready_for_pickup', 'picked_up']);

      setStats({
        totalOrders: count || 0,
        pendingOrders: pending,
        totalRevenue: revenue,
        productCount: products?.length || 0,
        paidOrders: paidCount || 0,
      });
      setRecentOrders(allOrders);
    }
    load();
    const sub = supabase.channel('seller-dashboard-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${store.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [store.id]);

  return (
    <div>
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-5 pt-12 pb-6 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <StoreIcon size={20} />
            <span className="text-lg font-bold">{store.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onOpenMessages} className="relative w-10 h-10 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition">
              <Bell size={20} className="text-white" />
              {unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold" style={{ fontSize: 10 }}>
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </button>
            <button onClick={onSignOut} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition">
              <LogOut size={20} className="text-white" />
            </button>
          </div>
        </div>
        {store.palengke_name && (
          <p className="text-brand-100 text-xs flex items-center gap-1 mb-1">
            <MapPin size={12} />
            {store.palengke_name}
          </p>
        )}
        <p className="text-brand-100 text-sm">Kumusta, {profile?.full_name?.split(' ')[0]}! Narito ang status ng tindahan mo.</p>
        <div className="flex items-center gap-2 mt-3">
          <button onClick={onEditStore} className="text-xs bg-white/20 px-3 py-1.5 rounded-full flex items-center gap-1">
            <Edit size={14} /> I-edit ang tindahan
          </button>
          <button onClick={onViewStore} className="text-xs bg-white/20 px-3 py-1.5 rounded-full flex items-center gap-1">
            <ExternalLink size={14} /> Tingnan ang tindahan
          </button>
          <button
            onClick={toggleStoreOpen}
            disabled={toggling}
            className={`text-xs px-4 py-1.5 rounded-full font-semibold flex items-center gap-1.5 active:scale-95 transition disabled:opacity-50 ${
              isOpen ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {toggling ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isOpen ? (
              <StoreIcon size={14} />
            ) : (
              <Lock size={14} />
            )}
            {isOpen ? 'Store Open' : 'Store Closed'}
          </button>
        </div>
      </div>

      {/* Payment Received Alert Banner */}
      {stats.paidOrders > 0 && (
        <div className="px-5 pt-4">
          <button
            onClick={onOpenOrders}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-4 text-white text-left active:scale-[0.98] transition shadow-lg shadow-green-500/30 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <DollarSign size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-base">May {stats.paidOrders} order na nabayaran na!</p>
                <p className="text-sm text-white/90">I-tap para tingnan ang mga paid orders</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <ArrowLeft size={18} className="text-white rotate-180" />
              </div>
            </div>
          </button>
        </div>
      )}

      {/* New Order Alert Banner */}
      {stats.pendingOrders > 0 && (
        <div className="px-5 pt-4">
          <button
            onClick={onOpenOrders}
            className="w-full bg-gradient-to-r from-red-500 to-red-600 rounded-2xl p-4 text-white text-left active:scale-[0.98] transition shadow-lg shadow-red-500/30 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Bell size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-base">May {stats.pendingOrders} bagong order{stats.pendingOrders > 1 ? 's' : ''}!</p>
                <p className="text-sm text-white/90">I-tap para tingnan agad</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <ArrowLeft size={18} className="text-white rotate-180" />
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="px-5 py-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag size={18} className="text-brand-600" />
            <span className="text-xs text-gray-400">Total Orders</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.totalOrders}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={18} className="text-amber-500" />
            <span className="text-xs text-gray-400">Pending</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.pendingOrders}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={18} className="text-green-600" />
            <span className="text-xs text-gray-400">Kita</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">₱{stats.totalRevenue.toFixed(0)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Package size={18} className="text-blue-500" />
            <span className="text-xs text-gray-400">Products</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.productCount}</p>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="px-5 pb-4">
        <h3 className="font-bold text-gray-800 mb-3">Mga Bagong Orders</h3>
        {recentOrders.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Bell size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Wala pang orders. Hintayin mo!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentOrders.map(order => (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-gray-800">{order.buyer?.full_name || 'Buyer'}</p>
                  <p className="text-xs text-gray-400">₱{Number(order.total).toFixed(0)} · {new Date(order.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border ${ORDER_STATUS_COLORS[order.status]}`}>
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shareable Links */}
      {store.slug && (
        <div className="px-5 pb-4">
          <ShareableLinkSection
            label="Store Link"
            url={`${window.location.origin}/s/${store.slug}`}
            onOpen={() => navigate(`/s/${store.slug}`)}
          />
        </div>
      )}
      {profile?.slug && (
        <div className="px-5 pb-4">
          <ShareableLinkSection
            label="Profile Link"
            url={`${window.location.origin}/u/${profile.slug}`}
            onOpen={() => navigate(`/u/${profile.slug}`)}
          />
        </div>
      )}

      {/* Reviews */}
      {profile && (
        <div className="px-5 pb-4">
          <h3 className="font-bold text-gray-800 mb-3">Mga Review</h3>
          <ReviewSection userId={profile.id} />
        </div>
      )}
    </div>
  );
}

// ============= PRODUCTS =============
function SellerProducts({ store, onAdd, onEdit }: { store: Store; onAdd: () => void; onEdit: (p: Product) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('products').select('*').eq('store_id', store.id).order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  }, [store.id]);

  useEffect(() => { load(); }, [load]);

  async function toggleAvailable(p: Product) {
    await supabase.from('products').update({ is_available: !p.is_available }).eq('id', p.id);
    load();
  }

  async function deleteProduct(p: Product) {
    if (p.image_url) {
      await deleteStorageObject('product-images', p.image_url);
    }
    await supabase.from('products').delete().eq('id', p.id);
    load();
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Mga Paninda</h2>
        <button onClick={onAdd} className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center active:scale-90 transition">
          <Plus size={22} className="text-white" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package size={48} className="mx-auto mb-3 opacity-50" />
          <p className="mb-4">Wala pang paninda. Magdagdag na!</p>
          <button onClick={onAdd} className="px-6 py-3 bg-brand-600 text-white rounded-xl font-semibold active:scale-95 transition">
            Magdagdag ng Paninda
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {products.map(p => (
            <div key={p.id} className={`bg-white rounded-2xl border p-3 flex items-center gap-3 transition ${p.is_available ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
              <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                {p.image_url && <img src={p.image_url} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-800 line-clamp-1">{p.name}</p>
                <p className="text-brand-600 font-bold text-sm">₱{p.price}<span className="text-xs text-gray-400 font-normal">/{p.unit}</span></p>
                <p className="text-xs text-gray-400">Stock: {p.stock}</p>
              </div>
              <div className="flex flex-col gap-1.5 items-end">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${p.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {p.is_available ? 'Visible' : 'Hidden'}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => toggleAvailable(p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 active:scale-95 transition ${p.is_available ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-600'}`}>
                    {p.is_available ? <><EyeOff size={14} /> Itago</> : <><Eye size={14} /> Ipakita</>}
                  </button>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => onEdit(p)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center active:scale-90 transition">
                    <Edit size={16} className="text-gray-600" />
                  </button>
                  <button onClick={() => deleteProduct(p)} className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center active:scale-90 transition">
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============= PRODUCT FORM =============
function ProductFormModal({ store, product, onClose, onSaved }: { store: Store; product: Product | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product?.price?.toString() || '');
  const [unit, setUnit] = useState(product?.unit || 'kilo');
  const [stock, setStock] = useState(product?.stock?.toString() || '0');
  const [imageUrl, setImageUrl] = useState(product?.image_url || '');
  const [categories, setCategories] = useState<{ id: string; name_fil: string }[]>([]);
  const [categoryId, setCategoryId] = useState(product?.category_id || '');
  const [deliveryMethod, setDeliveryMethod] = useState<string | null>(product?.delivery_method || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageSearch, setImageSearch] = useState('');
  const [searchResults, setSearchResults] = useState<{ name: string; image_url: string; unit: string; category_id: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.from('categories').select('id, name_fil').order('sort_order').then(({ data }) => setCategories(data || []));
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      // Use CropModal via ImageUploadField-like flow: compress and upload directly
      (async () => {
        setSaving(true);
        setError(null);
        try {
          const compressed = await compressImage(file);
          const ext = compressed.name.split('.').pop() || 'webp';
          const fileName = `${store.id}/${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, compressed);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
          setImageUrl(publicUrl);
        } catch (err: any) {
          setError(err.message || 'Hindi ma-upload ang larawan.');
        } finally {
          setSaving(false);
          if (fileRef.current) fileRef.current.value = '';
        }
      })();
    };
    reader.onerror = () => setError('Hindi mabasa ang larawan.');
    reader.readAsDataURL(file);
  }

  async function searchExistingImages(query: string) {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from('products')
      .select('name, image_url, unit, category_id')
      .not('image_url', 'is', null)
      .ilike('name', `%${query.trim()}%`)
      .limit(20);
    // Deduplicate by image_url — keep first occurrence
    const seen = new Set<string>();
    const unique: typeof searchResults = [];
    for (const p of (data || []) as any[]) {
      if (p.image_url && !seen.has(p.image_url)) {
        seen.add(p.image_url);
        unique.push(p);
      }
    }
    setSearchResults(unique);
    setSearching(false);
  }

  function handleSearchChange(value: string) {
    setImageSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchExistingImages(value), 300);
  }

  function selectExistingImage(item: { name: string; image_url: string; unit: string; category_id: string | null }) {
    setImageUrl(item.image_url);
    if (!name) setName(item.name);
    if (!unit) setUnit(item.unit);
    if (!categoryId && item.category_id) setCategoryId(item.category_id);
    setShowImagePicker(false);
    setImageSearch('');
    setSearchResults([]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      store_id: store.id,
      category_id: categoryId || null,
      name, description: description || null,
      price: parseFloat(price),
      unit,
      stock: parseInt(stock) || 0,
      image_url: imageUrl || null,
      is_available: product ? product.is_available : true,
      delivery_method: deliveryMethod || null,
    };

    if (product) {
      if (product.image_url && imageUrl && product.image_url !== imageUrl) {
        await deleteStorageObject('product-images', product.image_url);
      }
      if (product.image_url && !imageUrl) {
        await deleteStorageObject('product-images', product.image_url);
      }
      const { error } = await supabase.from('products').update(payload).eq('id', product.id);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('products').insert(payload);
      if (error) { setError(error.message); setSaving(false); return; }
    }

    // Price anomaly check: if price is suspiciously low, flag for moderation
    if (categoryId && parseFloat(price) > 0) {
      const anomaly = await checkPriceAnomaly(categoryId, parseFloat(price), store.seller_id, name, product?.id);
      if (anomaly.flagged) {
        await supabase.from('products')
          .update({ moderation_status: 'PENDING_MODERATION', is_available: false })
          .eq('store_id', store.id)
          .eq('name', name);
        setError(`Babala sa Presyo: Ang presyo mo ay ${anomaly.priceDropPercent}% mas mababa kaysa sa average presyo sa kategoryang ito (₱${anomaly.avgPrice?.toFixed(2)}). Ang iyong listing ay ipinasa sa admin para sa pag-review, at ang iyong account ay limitado sa 48 oras hanggang sa ma-verify.`);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-end max-w-md mx-auto animate-fade-in">
      <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">{product ? 'I-edit ang Paninda' : 'Magdagdag ng Paninda'}</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={20} className="text-gray-600" />
          </button>
        </div>
        <form onSubmit={save} className="px-5 py-4 space-y-4 pb-28">
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Pangalan ng Paninda</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Galunggong" required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 outline-none transition" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Kategorya</label>
            <select value={categoryId} onChange={e => {
              setCategoryId(e.target.value);
              const selected = categories.find(c => c.id === e.target.value);
              if (selected?.slug === 'livestock') {
                setDeliveryMethod('pickup');
              } else {
                setDeliveryMethod(null);
              }
            }}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 outline-none transition">
              <option value="">Pumili...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name_fil}</option>)}
            </select>
          </div>

          {categories.find(c => c.id === categoryId)?.slug === 'livestock' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700">
                  <p className="font-semibold">Buhay na Hayop — Pick Up / Meet Up Lang</p>
                  <p className="mt-0.5">Hindi pwede ang rider para sa buhay na hayop. Pipiliin ng buyer kung pick up sa tindahan o meet up sa napagkasunduang lugar.</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Delivery Method</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('pickup')}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition ${deliveryMethod === 'pickup' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}
                  >
                    Pick Up
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('meetup')}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition ${deliveryMethod === 'meetup' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}
                  >
                    Meet Up
                  </button>
                </div>
              </div>
              {store.livestock_permit_url ? (
                <div className="flex items-center gap-1.5 text-xs text-green-600">
                  <Shield size={14} />
                  <span>Naka-upload na ang permit para sa transport ng buhay na hayop</span>
                </div>
              ) : (
                <div className="flex items-start gap-1.5 text-xs text-amber-600">
                  <Info size={14} className="flex-shrink-0 mt-0.5" />
                  <span>Walang permit na nai-upload. Kung malayo ang biyahe ng buhay na hayop, kailangan ng permit mula sa awtoridad. I-upload sa Store Settings.</span>
                </div>
              )}
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Sariwang galunggong..." rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 outline-none transition resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Presyo (₱)</label>
              <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="180" required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 outline-none transition" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Unit</label>
              <select value={unit} onChange={e => setUnit(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 outline-none transition">
                <option value="kilo">kilo</option>
                <option value="grams">grams</option>
                <option value="piece">piece</option>
                <option value="pack">pack</option>
                <option value="tray">tray</option>
                <option value="bundle">bundle</option>
                <option value="bote">bote</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Stock</label>
            <input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="50" required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 outline-none transition" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Larawan ng Paninda</label>

            {imageUrl ? (
              <div className="relative">
                <img src={imageUrl} alt="Preview" loading="lazy" decoding="async" className="w-full h-40 rounded-xl object-cover" />
                <div className="absolute bottom-2 right-2 flex gap-1.5">
                  <button type="button" onClick={() => setShowImagePicker(true)}
                    className="bg-black/60 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
                    <Search size={14} /> Maghanap
                  </button>
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="bg-black/60 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
                    <Camera size={14} /> Palitan
                  </button>
                  <button type="button" onClick={() => setImageUrl('')}
                    className="bg-black/60 text-white px-2 py-1.5 rounded-lg text-xs flex items-center gap-1">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button type="button" onClick={() => setShowImagePicker(true)}
                  className="w-full h-20 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 flex flex-col items-center justify-center gap-1 text-brand-600 active:scale-[0.98] transition">
                  <Search size={24} />
                  <span className="text-sm font-medium">Maghanap ng existing larawan</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={saving}
                  className="w-full h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-400 active:scale-[0.98] transition disabled:opacity-50">
                  {saving ? (
                    <><Loader2 size={24} className="animate-spin" /><span className="text-sm">Naka-compress at nag-uupload...</span></>
                  ) : (
                    <><Camera size={24} /><span className="text-sm">Mag-upload ng sariling larawan</span></>
                  )}
                </button>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">Pumili mula sa mga na-upload na ng ibang seller, o mag-upload ng sarili mo. Isang larawan lang bawat produkto.</p>
          </div>

          {showImagePicker && (
            <div className="fixed inset-0 bg-black/40 z-[65] flex items-end max-w-md mx-auto animate-fade-in" onClick={() => setShowImagePicker(false)}>
              <div className="bg-white w-full rounded-t-3xl max-h-[70vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between border-b border-gray-100">
                  <h3 className="font-bold text-gray-800">Pumili ng Larawan</h3>
                  <button onClick={() => setShowImagePicker(false)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                    <X size={20} className="text-gray-600" />
                  </button>
                </div>
                <div className="px-5 py-4">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={imageSearch}
                      onChange={e => handleSearchChange(e.target.value)}
                      placeholder="Hanapin: Bangus, Galunggong, Repolyo..."
                      autoFocus
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 outline-none transition text-sm"
                    />
                  </div>
                  {searching ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={28} className="animate-spin text-gray-400" />
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <ImageIcon size={40} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{imageSearch.length >= 2 ? 'Walang nahanap. Subukan ibang pangalan.' : 'Mag-type ng pangalan ng produkto para maghanap.'}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {searchResults.map((item, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => selectExistingImage(item)}
                          className="relative aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-brand-500 active:scale-95 transition"
                        >
                          <img src={item.image_url} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 py-0.5 truncate">{item.name}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
          <button type="submit" disabled={saving}
            className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg active:scale-[0.98] transition disabled:opacity-50">
            {saving ? 'Nagsasave...' : product ? 'I-save ang Pagbabago' : 'Magdagdag ng Paninda'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============= STORE FORM =============
function StoreFormModal({ store, onClose, onSaved }: { store: Store; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(store.name);
  const [description, setDescription] = useState(store.description || '');
  const [location, setLocation] = useState<LocationData>({
    barangay: store.barangay,
    district: store.district || '',
    city: store.city,
    region: store.region,
  });
  const [bannerUrl, setBannerUrl] = useState(store.banner_url || '');
  const [qrCodeUrl, setQrCodeUrl] = useState(store.qr_code_url || '');
  const [livestockPermitUrl, setLivestockPermitUrl] = useState(store.livestock_permit_url || '');
  const [palengkeName, setPalengkeName] = useState(store.palengke_name || '');
  const [palengkeCustom, setPalengkeCustom] = useState('');
  const [sellerType, setSellerType] = useState<'palengke' | 'farm' | ''>(
    store.seller_type === 'farm' ? 'farm' : store.seller_type === 'palengke' ? 'palengke' :
    (store.palengke_name ? 'palengke' : '')
  );
  const [farmType, setFarmType] = useState(store.farm_type || '');
  const [isOpen, setIsOpen] = useState(store.is_open);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cityMarkets = getCityMarkets(location.city);
  const finalPalengkeName = palengkeName === '__custom__' ? palengkeCustom.trim() : palengkeName;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const palengkeCoords = finalPalengkeName ? PALENGKE_COORDS[finalPalengkeName] : null;
    const { error } = await supabase.from('stores').update({
      name, description, barangay: location.barangay, district: location.district, city: location.city, region: location.region,
      latitude: palengkeCoords?.lat ?? null,
      longitude: palengkeCoords?.lng ?? null,
      banner_url: bannerUrl || null,
      qr_code_url: qrCodeUrl || null, is_open: isOpen,
      palengke_name: sellerType === 'palengke' ? (finalPalengkeName || null) : null,
      seller_type: sellerType || null,
      farm_type: sellerType === 'farm' ? (farmType || null) : null,
      livestock_permit_url: livestockPermitUrl || null,
    }).eq('id', store.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-end max-w-md mx-auto animate-fade-in">
      <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">I-edit ang Tindahan</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={20} className="text-gray-600" />
          </button>
        </div>
        <form onSubmit={save} className="px-5 py-4 space-y-4 pb-28">
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Pangalan</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 outline-none transition" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 outline-none transition resize-none" />
          </div>
          <LocationSelector
            value={location}
            onChange={setLocation}
            label="Location ng tindahan"
            compact
          />
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Saan ka nagbebenta?</label>
            <p className="text-xs text-gray-400 mb-2">May pwesto ka ba sa palengke, o nagbebenta mula sa bahay na may farm/fishpond?</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button type="button" onClick={() => { setSellerType('palengke'); setFarmType(''); }}
                className={`p-3 rounded-xl border-2 text-left transition ${sellerType === 'palengke' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white'}`}>
                <StoreIcon size={18} className={sellerType === 'palengke' ? 'text-brand-600' : 'text-gray-400'} />
                <p className="text-sm font-semibold text-gray-800 mt-1">May Pwesto sa Palengke</p>
                <p className="text-xs text-gray-500">May stall sa physical wet market</p>
              </button>
              <button type="button" onClick={() => { setSellerType('farm'); setPalengkeName(''); setPalengkeCustom(''); }}
                className={`p-3 rounded-xl border-2 text-left transition ${sellerType === 'farm' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white'}`}>
                <Sprout size={18} className={sellerType === 'farm' ? 'text-brand-600' : 'text-gray-400'} />
                <p className="text-sm font-semibold text-gray-800 mt-1">Farm / Bahay</p>
                <p className="text-xs text-gray-500">Nagbebenta mula sa sariling farm</p>
              </button>
            </div>
          </div>

          {sellerType === 'palengke' && (
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Pangalan ng Palengke</label>
              <p className="text-xs text-gray-400 mb-1.5">Piliin ang palengke kung saan mo pwesto.</p>
              <select value={palengkeName} onChange={e => setPalengkeName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-500 outline-none transition text-sm">
                <option value="">Pumili ng palengke...</option>
                {cityMarkets.map(m => <option key={m} value={m}>{m}</option>)}
                {store.palengke_name && !cityMarkets.includes(store.palengke_name) && (
                  <option value={store.palengke_name}>{store.palengke_name}</option>
                )}
                <option value="__custom__">Iba pa...</option>
              </select>
              {palengkeName === '__custom__' && (
                <input type="text" value={palengkeCustom} onChange={e => setPalengkeCustom(e.target.value)} placeholder="Ilagay ang pangalan ng palengke" autoFocus
                  className="w-full px-4 py-3 mt-2 rounded-xl border border-gray-200 bg-white focus:border-brand-500 outline-none transition text-sm" />
              )}
            </div>
          )}

          {sellerType === 'farm' && (
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Anong klaseng farm ang meron?</label>
              <p className="text-xs text-gray-400 mb-1.5">Piliin kung anong source ng paninda mo mula sa bahay.</p>
              <select value={farmType} onChange={e => setFarmType(e.target.value)} required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-500 outline-none transition text-sm">
                <option value="">Pumili...</option>
                <option value="vegetable_farm">Gulay / Pananim (Vegetable Farm)</option>
                <option value="fishpond">Fishpond / Fishery</option>
                <option value="poultry">Poultry (Alagang Manok / Itlog)</option>
                <option value="livestock">Livestock (Baboy, Baka, Kambing)</option>
                <option value="mixed">Halo-halo (Mixed Farm)</option>
              </select>
            </div>
          )}
          <ImageUploadField
            label="Store Banner"
            value={bannerUrl}
            onChange={setBannerUrl}
            folder="banners"
            aspectClass="h-40"
            icon={<StoreIcon size={16} />}
            cropAspect={16 / 9}
          />
          <ImageUploadField
            label="QR Code (para sa GCash payment)"
            value={qrCodeUrl}
            onChange={setQrCodeUrl}
            folder="qr-codes"
            aspectClass="h-48"
            icon={<QrCode size={16} />}
            hint="I-screenshot ang QR code mo sa GCash app, tapos i-upload dito."
            cropAspect={1}
          />
          <ImageUploadField
            label="Livestock Transport Permit (opsyonal)"
            value={livestockPermitUrl}
            onChange={setLivestockPermitUrl}
            folder="permits"
            aspectClass="h-40"
            icon={<Shield size={16} />}
            hint="Kung nagbebenta ka ng buhay na hayop at malayo ang biyahe, kailangan ng permit mula sa awtoridad (DA/BAI). I-upload dito."
            cropAspect={4 / 3}
          />
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isOpen} onChange={e => setIsOpen(e.target.checked)} className="w-5 h-5 rounded accent-brand-600" />
              <span className="text-sm font-medium text-gray-700">Store Open</span>
            </label>
          </div>
          {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
          <button type="submit" disabled={saving}
            className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg active:scale-[0.98] transition disabled:opacity-50">
            {saving ? 'Nagsasave...' : 'I-save ang Tindahan'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============= SELLER ORDERS =============
function SellerOrders({ store, onOrderClick }: { store: Store; onOrderClick: (o: Order) => void }) {
  const [orders, setOrders] = useState<(Order & { buyer: { full_name: string; phone: string | null } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');

  const load = useCallback(async () => {
    let q = supabase.from('orders').select('*, buyer:profiles!orders_buyer_id_fkey(full_name, phone)').eq('store_id', store.id).is('hidden_by_seller_at', null).order('created_at', { ascending: false });
    if (filter === 'pending') q = q.eq('status', 'pending');
    if (filter === 'active') q = q.in('status', ['accepted', 'preparing', 'ready_for_pickup', 'picked_up']);
    if (filter === 'completed') q = q.in('status', ['delivered', 'cancelled']);
    const { data } = await q;
    setOrders((data || []) as any);
    setLoading(false);
  }, [store.id, filter]);

  useEffect(() => { load(); }, [load]);

  // Subscribe to new orders
  useEffect(() => {
    const sub = supabase.channel('seller-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${store.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [store.id, load]);

  const filters = [
    { id: 'all' as const, label: 'Lahat' },
    { id: 'pending' as const, label: 'Pending' },
    { id: 'active' as const, label: 'Active' },
    { id: 'completed' as const, label: 'Tapos na' },
  ];

  return (
    <div className="px-5 py-4">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Mga Orders</h2>
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        {filters.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium flex-shrink-0 ${filter === f.id ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ShoppingBag size={48} className="mx-auto mb-3 opacity-50" />
          <p>Wala pang orders dito.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(order => {
            const canDelete = order.status === 'delivered' || order.status === 'cancelled';
            return (
            <div key={order.id}
              className={`w-full rounded-2xl border p-4 ${
                order.status === 'pending'
                  ? 'bg-red-50 border-red-300 shadow-sm'
                  : 'bg-white border-gray-100'
              }`}>
              <button onClick={() => onOrderClick(order)}
                className="w-full text-left active:scale-[0.98] transition">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm text-gray-800">{order.buyer?.full_name || 'Buyer'}</p>
                    <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {order.status === 'pending' && (
                      <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">BAGO</span>
                    )}
                    {order.scheduled_delivery_at && (
                      <span className="text-[10px] font-bold text-white bg-blue-500 px-2 py-0.5 rounded-full">SCHEDULED</span>
                    )}
                    {order.payment_status === 'paid' && (
                      <span className="text-[10px] font-bold text-white bg-green-500 px-2 py-0.5 rounded-full">PAID</span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full border ${ORDER_STATUS_COLORS[order.status]}`}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">₱{(Number(order.total) + Number(order.delivery_fee)).toFixed(0)}</span>
                  <div className="flex items-center gap-2">
                    {order.rider_id && (
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Bike size={10} /> May Rider
                      </span>
                    )}
                    {!order.rider_id && order.status === 'ready_for_pickup' && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        Naghihintay Rider
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{order.payment_method === 'qr_code' ? 'QR' : 'COD'}</span>
                  </div>
                </div>
              </button>
              {canDelete && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm('Itago ang order na ito sa listahan mo? Hindi ito mabubura sa ibang tao.')) return;
                    await supabase.from('orders').update({ hidden_by_seller_at: new Date().toISOString() }).eq('id', order.id);
                    load();
                  }}
                  className="mt-2 w-full py-2 text-xs font-medium text-red-500 bg-red-50 rounded-lg active:scale-[0.98] transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={13} /> Itago
                </button>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============= SELLER ORDER DETAIL =============
function SellerOrderDetail({ order, store, onBack, onOpenChat }: { order: Order; store: Store; onBack: () => void; onOpenChat: (order: Order, buyerName: string) => void }) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [buyer, setBuyer] = useState<{ full_name: string; phone: string | null; avatar_url: string | null } | null>(null);
  const [rider, setRider] = useState<{ full_name: string; phone: string | null; avatar_url: string | null } | null>(null);
  const [currentOrder, setCurrentOrder] = useState(order);
  const [updating, setUpdating] = useState(false);
  const [showRiderPicker, setShowRiderPicker] = useState(false);
  const [availableRiders, setAvailableRiders] = useState<{ id: string; full_name: string; phone: string | null; avatar_url: string | null }[]>([]);
  const [loadingRiders, setLoadingRiders] = useState(false);
  const [assigningRider, setAssigningRider] = useState<string | null>(null);
  const [fleetTier, setFleetTier] = useState<VehicleTier>((order.vehicle_type as VehicleTier) || 'motorcycle');
  const [riderAssigned, setRiderAssigned] = useState(false);
  const [nearbyRiders, setNearbyRiders] = useState<{
    rider_id: string;
    rider_name: string;
    rider_phone: string | null;
    rider_avatar: string | null;
    active_order_id: string;
    active_store_name: string;
    delivery_barangay: string | null;
    delivery_city: string | null;
    delivery_lat: number | null;
    delivery_lng: number | null;
    distance_km: number | null;
  }[]>([]);

  useEffect(() => {
    supabase.from('order_items').select('*').eq('order_id', order.id).then(({ data }) => setItems(data || []));
    supabase.from('profiles').select('full_name, phone, avatar_url').eq('id', order.buyer_id).maybeSingle().then(({ data }) => setBuyer(data as any));
    if (order.rider_id) {
      supabase.from('profiles').select('full_name, phone, avatar_url, rider_qr_code_url').eq('id', order.rider_id).maybeSingle().then(({ data }) => setRider(data as any));
    }

    const sub = supabase.channel(`seller-order-${order.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` }, (payload: any) => {
        const newOrder = payload.new as Order;
        setCurrentOrder(newOrder);
        if (newOrder.rider_id && !rider) {
          supabase.from('profiles').select('full_name, phone, avatar_url, rider_qr_code_url').eq('id', newOrder.rider_id).maybeSingle().then(({ data }) => setRider(data as any));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [order.id]);

  // Auto-load nearby riders when order is ready for pickup (for the hint banner)
  useEffect(() => {
    if (currentOrder.status === 'ready_for_pickup' && !currentOrder.rider_id && !currentOrder.delivery_method) {
      loadAvailableRiders();
    }
  }, [currentOrder.status, currentOrder.rider_id]);

  async function loadAvailableRiders() {
    setLoadingRiders(true);

    const [ridersRes, activeOrdersRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, phone, avatar_url').eq('role', 'rider').eq('is_available', true).order('full_name', { ascending: true }),
      // Riders na papunta pa lang / nasa palengke (hindi pa nakaalis) — pwedeng isabay
      supabase.from('orders').select('id, rider_id, store:stores(name), delivery_barangay, delivery_city, delivery_lat, delivery_lng').in('status', ['accepted', 'preparing', 'ready_for_pickup']).not('rider_id', 'is', null).neq('buyer_id', currentOrder.buyer_id),
    ]);

    setAvailableRiders((ridersRes.data || []) as any);

    // Find riders already delivering to the same or nearby destination
    const activeOrders = (activeOrdersRes.data || []) as any[];
    const targetBarangay = currentOrder.delivery_barangay?.toLowerCase().trim() || '';
    const targetCity = currentOrder.delivery_city?.toLowerCase().trim() || '';
    const targetLat = currentOrder.delivery_lat;
    const targetLng = currentOrder.delivery_lng;

    const nearby: typeof nearbyRiders = [];
    const seenRiders = new Set<string>();

    for (const ao of activeOrders) {
      if (!ao.rider_id || seenRiders.has(ao.rider_id)) continue;
      if (ao.rider_id === currentOrder.rider_id) continue;

      const aoBarangay = (ao.delivery_barangay || '').toLowerCase().trim();
      const aoCity = (ao.delivery_city || '').toLowerCase().trim();

      // Match: same barangay, or same city, or within 2km if coords available
      let isNearby = false;
      let distanceKm: number | null = null;

      if (targetBarangay && aoBarangay && aoBarangay === targetBarangay) {
        isNearby = true;
      } else if (targetCity && aoCity && aoCity === targetCity) {
        isNearby = true;
        if (targetLat != null && targetLng != null && ao.delivery_lat != null && ao.delivery_lng != null) {
          distanceKm = haversineKm(
            { lat: targetLat, lng: targetLng },
            { lat: ao.delivery_lat, lng: ao.delivery_lng },
          );
        }
      } else if (targetLat != null && targetLng != null && ao.delivery_lat != null && ao.delivery_lng != null) {
        distanceKm = haversineKm(
          { lat: targetLat, lng: targetLng },
          { lat: ao.delivery_lat, lng: ao.delivery_lng },
        );
        if (distanceKm <= 1) isNearby = true;
      }

      if (isNearby) {
        seenRiders.add(ao.rider_id);
        // Strict rules: tindahan ≤1 km, drop-off ≤1 km, kabuuang karga ≤20 kg
        const batch = await checkRiderBatch(ao.rider_id, currentOrder);
        if (!batch.ok) continue;
        nearby.push({
          rider_id: ao.rider_id,
          rider_name: '',
          rider_phone: null,
          rider_avatar: null,
          active_order_id: ao.id,
          active_store_name: ao.store?.name || '',
          delivery_barangay: ao.delivery_barangay,
          delivery_city: ao.delivery_city,
          delivery_lat: ao.delivery_lat,
          delivery_lng: ao.delivery_lng,
          distance_km: distanceKm,
        });
      }
    }

    // Fetch rider profiles for nearby riders
    if (nearby.length > 0) {
      const riderIds = nearby.map(n => n.rider_id);
      const { data: riderProfiles } = await supabase.from('profiles').select('id, full_name, phone, avatar_url').in('id', riderIds);
      const profileMap = new Map((riderProfiles || []).map((p: any) => [p.id, p]));
      for (const n of nearby) {
        const p = profileMap.get(n.rider_id);
        if (p) {
          n.rider_name = p.full_name;
          n.rider_phone = p.phone;
          n.rider_avatar = p.avatar_url;
        }
      }
    }

    setNearbyRiders(nearby);
    setLoadingRiders(false);
  }

  async function assignRider(riderId: string) {
    setAssigningRider(riderId);
    const batch = await checkRiderBatch(riderId, currentOrder);
    if (!batch.ok) {
      setAssigningRider(null);
      alert(batch.reason);
      return;
    }
    if (currentOrder.delivery_group_id) {
      await supabase.from('orders').update({ rider_id: riderId, vehicle_type: fleetTier }).eq('delivery_group_id', currentOrder.delivery_group_id);
    } else {
      await supabase.from('orders').update({ rider_id: riderId, vehicle_type: fleetTier }).eq('id', currentOrder.id);
    }
    setCurrentOrder(prev => ({ ...prev, rider_id: riderId }));
    setRiderAssigned(true);
    setAssigningRider(null);
    setShowRiderPicker(false);
    supabase.from('profiles').select('full_name, phone, avatar_url, rider_qr_code_url').eq('id', riderId).maybeSingle().then(({ data }) => setRider(data as any));
  }

  async function updateStatus(status: OrderStatus) {
    setUpdating(true);
    await supabase.from('orders').update({ status }).eq('id', currentOrder.id);
    setCurrentOrder(prev => ({ ...prev, status }));
    setUpdating(false);
  }

  async function acceptCodPayment() {
    setUpdating(true);
    await supabase.from('orders').update({
      cod_payment_accepted_at: new Date().toISOString(),
      payment_status: 'paid',
    }).eq('id', currentOrder.id);
    setCurrentOrder(prev => ({ ...prev, cod_payment_accepted_at: new Date().toISOString(), payment_status: 'paid' }));
    setUpdating(false);
  }

  const isCancelled = currentOrder.status === 'cancelled';
  const isDelivered = currentOrder.status === 'delivered';
  const isCod = currentOrder.payment_method === 'cod';
  const isCodPaymentPending = isCod && isDelivered && !!currentOrder.cod_payment_reference && !currentOrder.cod_payment_accepted_at;

  // Build seller-side step list — COD skips "Nabayaran na" (payment at delivery)
  const sellerSteps: StepInfo[] = isCod ? [
    { key: 'new_order', label: 'Bagong Order', description: 'May bagong order! I-confirm muna para sure na available ang mga paninda.', status: 'completed' },
    { key: 'confirmed', label: 'Na-confirm na', description: 'Na-confirm mo na ang order. Cash on Delivery — maghahanda ang buyer ng cash para sa rider. Ihanda na ang order.', status: 'completed' },
    { key: 'preparing', label: 'Inihahanda ang order', description: 'Inihahanda mo na ang order. I-mark bilang ready for pickup kapag tapos na, para makapili ng rider.', status: 'completed' },
    { key: 'ready', label: 'Ready for pickup', description: 'Handa na ang order! Pumili ng rider o i-broadcast sa lahat ng available na riders.', status: 'completed' },
    { key: 'on_the_way', label: 'Nakuha na ng rider', description: 'Nakuha na ng rider ang parcel at on the way na sa buyer. Hintayin na ma-deliver.', status: 'completed' },
    { key: 'delivered', label: 'Na-deliver na!', description: 'Na-deliver na ang order. Kolektahin ang bayad sa rider pagbalik niya. Tapos na ang transaction.', status: 'completed' },
  ] : [
    { key: 'new_order', label: 'Bagong Order', description: 'May bagong order! I-confirm muna para sure na available ang mga paninda.', status: 'completed' },
    { key: 'confirmed', label: 'Na-confirm na', description: 'Na-confirm mo na ang order. Naghihintay na magbayad ang buyer.', status: 'completed' },
    { key: 'paid', label: 'Nabayaran na!', description: 'Nabayaran na ng buyer! Ihanda na ang order at i-mark bilang preparing.', status: 'completed' },
    { key: 'preparing', label: 'Inihahanda ang order', description: 'Inihahanda mo na ang order. I-mark bilang ready for pickup kapag tapos na, para makapili ng rider.', status: 'completed' },
    { key: 'ready', label: 'Ready for pickup', description: 'Handa na ang order! Pumili ng rider o i-broadcast sa lahat ng available na riders.', status: 'completed' },
    { key: 'on_the_way', label: 'Nakuha na ng rider', description: 'Nakuha na ng rider ang parcel at on the way na sa buyer. Hintayin na ma-deliver.', status: 'completed' },
    { key: 'delivered', label: 'Na-deliver na!', description: 'Na-deliver na ang order. Tapos na ang transaction.', status: 'completed' },
  ];

  let currentStepIndex = 0;
  if (isCod) {
    if (currentOrder.status === 'pending') currentStepIndex = 0;
    else if (currentOrder.status === 'accepted') currentStepIndex = 1;
    else if (currentOrder.status === 'preparing') currentStepIndex = 2;
    else if (currentOrder.status === 'ready_for_pickup') currentStepIndex = 3;
    else if (currentOrder.status === 'picked_up') currentStepIndex = 4;
    else if (currentOrder.status === 'delivered') currentStepIndex = 5;
  } else {
    if (currentOrder.status === 'pending') currentStepIndex = 0;
    else if (currentOrder.status === 'accepted') {
      if (currentOrder.payment_status !== 'paid') currentStepIndex = 1;
      else currentStepIndex = 2;
    }
    else if (currentOrder.status === 'preparing') currentStepIndex = 3;
    else if (currentOrder.status === 'ready_for_pickup') currentStepIndex = 4;
    else if (currentOrder.status === 'picked_up') currentStepIndex = 5;
    else if (currentOrder.status === 'delivered') currentStepIndex = 6;
  }

  sellerSteps.forEach((s, i) => {
    s.status = i < currentStepIndex ? 'completed' : i === currentStepIndex ? 'active' : 'pending';
  });

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-800">Order Details</h2>
      </div>

      {/* Status badge */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm px-3 py-1 rounded-full border ${ORDER_STATUS_COLORS[currentOrder.status]}`}>
            {ORDER_STATUS_LABELS[currentOrder.status]}
          </span>
          <span className="text-sm text-gray-400">#{order.id.slice(0, 8)}</span>
        </div>
        <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString('en-PH')}</p>
      </div>

      {/* Scheduled delivery banner */}
      {currentOrder.scheduled_delivery_at && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-3">
          <div className="flex items-start gap-2">
            <CalendarClock size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-semibold">Advance Order — Scheduled Delivery</p>
              <p className="text-xs mt-1">
                Gusto ng buyer na ma-deliver sa {new Date(currentOrder.scheduled_delivery_at).toLocaleString('en-PH', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. May time ka para maghanda ng order.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Livestock delivery info */}
      {(currentOrder.delivery_method === 'pickup' || currentOrder.delivery_method === 'meetup') && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700">
              <p className="font-semibold">
                {currentOrder.delivery_method === 'pickup' ? 'Pick Up sa Tindahan' : 'Meet Up sa Napagkasunduang Lugar'}
              </p>
              <p className="text-xs mt-1">
                {currentOrder.delivery_method === 'pickup'
                  ? 'Sasunduin ng buyer ang order sa tindahan mo. Walang rider para sa buhay na hayop.'
                  : 'Magkakasundo kayo ng buyer sa lugar ng pagpapalit. Walang rider para sa buhay na hayop.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Step Tracker */}
      {!isCancelled && (
        <div className="mb-3">
          <OrderStepTracker steps={sellerSteps} currentStepIndex={currentStepIndex} />
        </div>
      )}
      {isCancelled && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-3 text-center">
          <p className="text-sm font-semibold text-red-700">Nakansela ang order na ito.</p>
        </div>
      )}

      {/* Active step: New order — confirm button */}
      {!isCancelled && currentOrder.status === 'pending' && (
        <button onClick={() => updateStatus('accepted')} disabled={updating}
          className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-brand-600/20 active:scale-[0.98] transition disabled:opacity-50 mb-3">
          {updating ? 'Nag-uupdate...' : 'I-confirm ang Order'}
        </button>
      )}

      {/* Active step: Waiting for payment — show QR reminder */}
      {!isCancelled && currentOrder.status === 'accepted' && currentOrder.payment_method === 'qr_code' && currentOrder.payment_status !== 'paid' && store.qr_code_url && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3 text-center">
          <h3 className="font-semibold text-gray-800 mb-2">QR Code mo para sa Payment</h3>
          <img src={store.qr_code_url} alt="QR Code" loading="lazy" decoding="async" className="w-40 h-40 rounded-xl object-contain mx-auto" />
          <p className="text-sm text-gray-400 mt-2">I-scan ng buyer para magbayad. Naghihintay pa ng payment confirmation.</p>
        </div>
      )}

      {/* Active step: Paid — verification instructions + start preparing */}
      {!isCancelled && currentOrder.payment_method === 'qr_code' && currentOrder.payment_status === 'paid' && currentOrder.status === 'accepted' && (
        <div className="bg-green-50 border border-green-300 rounded-2xl p-4 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <Check size={18} className="text-white" />
            </div>
            <p className="font-semibold text-sm text-green-800">Nabayaran na ng Buyer!</p>
          </div>
          {currentOrder.payment_reference && (
            <div className="mb-3 p-3 bg-white rounded-xl border border-green-200">
              <p className="text-xs text-gray-400 mb-0.5">Payment Reference Number mula sa Buyer:</p>
              <p className="text-sm font-mono font-bold text-gray-800 break-all">{currentOrder.payment_reference}</p>
            </div>
          )}
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 mb-3">
            <p className="text-xs font-medium text-blue-900 mb-1.5">Paano i-verify ang payment:</p>
            <ol className="text-xs text-blue-700 space-y-1 leading-relaxed list-decimal pl-4">
              <li>Buksan ang GCash o Maya app mo.</li>
              <li>Pumunta sa "Activity" o "Transaction History".</li>
              <li>Hanapin ang transaction na may reference number na <strong>{currentOrder.payment_reference || 'na ibinigay ng buyer'}</strong>.</li>
              <li>Tiyakin na ang halaga ay <strong>₱{(Number(currentOrder.total) + Number(currentOrder.delivery_fee)).toFixed(2)}</strong>.</li>
              <li>Kung tumugma, pwede mo nang ipagpatuloy ang order.</li>
            </ol>
          </div>
          <button onClick={() => updateStatus('preparing')} disabled={updating}
            className="w-full py-3 bg-brand-600 text-white rounded-2xl font-semibold active:scale-[0.98] transition disabled:opacity-50">
            {updating ? 'Nag-uupdate...' : 'Simulang Ihanda ang Order'}
          </button>
        </div>
      )}

      {/* COD — accepted, no payment needed yet, proceed to preparing */}
      {!isCancelled && currentOrder.payment_method === 'cod' && currentOrder.status === 'accepted' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3">
          <p className="text-sm text-amber-700 mb-3">Cash on Delivery — maghahanda ang buyer ng <strong>₱{(Number(currentOrder.total) + Number(currentOrder.delivery_fee)).toFixed(2)}</strong> para sa rider. Ihandang muna ang order.</p>
          <button onClick={() => updateStatus('preparing')} disabled={updating}
            className="w-full py-3 bg-brand-600 text-white rounded-2xl font-semibold active:scale-[0.98] transition disabled:opacity-50">
            {updating ? 'Nag-uupdate...' : 'Simulang Ihanda ang Order'}
          </button>
        </div>
      )}

      {/* Active step: Preparing — ready for pickup button */}
      {!isCancelled && currentOrder.status === 'preparing' && (
        <button onClick={() => updateStatus('ready_for_pickup')} disabled={updating}
          className="w-full py-3 bg-brand-600 text-white rounded-2xl font-semibold active:scale-[0.98] transition disabled:opacity-50 mb-3">
          {updating ? 'Nag-uupdate...' : 'Ready for Pickup na'}
        </button>
      )}

      {/* Active step: Ready for pickup — rider selection (skip for livestock) */}
      {!isCancelled && !currentOrder.rider_id && currentOrder.status === 'ready_for_pickup' && !currentOrder.delivery_method && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={18} className="text-amber-500" />
            <p className="text-sm text-amber-700 font-medium">Naghihintay pa ng rider</p>
          </div>
          <p className="text-xs text-amber-600 mb-3">Pumili ka ng rider na kilala mo, o i-broadcast sa lahat ng available na riders.</p>
          {nearbyRiders.length > 0 && (
            <div className="mb-3 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
              <Bike size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                <strong>{nearbyRiders.length} rider{nearbyRiders.length > 1 ? 's' : ''}</strong> ang nasa parehong lugar na ng buyer mo — pwede isabay ang order! I-tap ang "Pumili ng Rider" sa baba.
              </p>
            </div>
          )}
          <button
            onClick={() => { setShowRiderPicker(true); loadAvailableRiders(); }}
            className="w-full py-3 bg-white text-brand-700 border border-brand-200 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <Users size={18} /> Pumili ng Rider
          </button>
          <div className="flex items-center gap-2 text-xs text-amber-600 py-2">
            <div className="flex-1 h-px bg-amber-200" />
            <span>o</span>
            <div className="flex-1 h-px bg-amber-200" />
          </div>
          <p className="text-xs text-amber-600 text-center">
            <Radio size={12} className="inline mr-1" />
            I-broadcast na sa lahat ng riders — makikita na nila ang order na ito sa app nila.
          </p>
        </div>
      )}

      {/* Active step: Ready for pickup — livestock (no rider, direct to delivered) */}
      {!isCancelled && currentOrder.status === 'ready_for_pickup' && (currentOrder.delivery_method === 'pickup' || currentOrder.delivery_method === 'meetup') && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3">
          <div className="flex items-start gap-2 mb-3">
            <Check size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700">
              <p className="font-semibold">Handa na para {currentOrder.delivery_method === 'pickup' ? 'Pick Up' : 'Meet Up'}!</p>
              <p className="text-xs mt-1">
                {currentOrder.delivery_method === 'pickup'
                  ? 'Hinihintay na ang buyer na sunduin ang order sa tindahan mo.'
                  : 'Makipag-ugnayan sa buyer para sa lugar at oras ng meet up.'}
              </p>
            </div>
          </div>
          <button onClick={() => updateStatus('delivered')} disabled={updating}
            className="w-full py-3 bg-green-600 text-white rounded-2xl font-semibold active:scale-[0.98] transition disabled:opacity-50">
            {updating ? 'Nag-uupdate...' : 'Na-deliver na / Nai-sundo na'}
          </button>
        </div>
      )}

      {/* Rider assigned but waiting for rider to accept */}
      {!isCancelled && rider && currentOrder.rider_id && currentOrder.status === 'ready_for_pickup' && (
        <div className="bg-white rounded-2xl border border-blue-200 p-4 mb-3">
          <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <Bike size={16} className="text-blue-500" /> Rider
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar src={rider.avatar_url} name={rider.full_name} size={36} />
              <div>
                <p className="text-sm font-medium text-gray-800">{rider.full_name}</p>
                {rider.phone && <p className="text-xs text-gray-400">{rider.phone}</p>}
              </div>
            </div>
            <a href={`tel:${rider.phone}`} className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
              <Phone size={16} className="text-blue-600" />
            </a>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1">
              <Clock size={12} /> Naghihintay na tanggapin ng rider
            </span>
          </div>
          {riderAssigned && (
            <p className="text-xs text-green-600 mt-2 font-medium">Na-assign na ang rider! Maghihintay na lang na tanggapin niya ang delivery.</p>
          )}
          {currentOrder.payment_method !== 'cod' && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2">
              <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 leading-relaxed">
                Nasa iyo na ang delivery fee (₱{Number(currentOrder.delivery_fee).toFixed(2)}) mula sa binayaran ng buyer. Ibigay ito sa rider gamit ang QR code niya bago umalis.
              </p>
            </div>
          )}
          {currentOrder.payment_method !== 'cod' && rider.rider_qr_code_url && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1.5">
                <QrCode size={14} className="text-brand-600" /> QR Code ng Rider para sa Delivery Fee
              </p>
              <div className="bg-gray-50 rounded-xl p-3 flex justify-center">
                <img src={rider.rider_qr_code_url} alt="QR Code ng Rider" loading="lazy" decoding="async" className="w-36 h-36 rounded-xl object-contain" />
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">I-scan para mabayaran ang delivery fee (₱{Number(currentOrder.delivery_fee).toFixed(2)}) ng rider bago umalis.</p>
            </div>
          )}
        </div>
      )}

      {/* Rider picked up — on the way */}
      {!isCancelled && rider && currentOrder.rider_id && currentOrder.status === 'picked_up' && (
        <div className="bg-white rounded-2xl border border-blue-200 p-4 mb-3">
          <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <Bike size={16} className="text-blue-500" /> Rider
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar src={rider.avatar_url} name={rider.full_name} size={36} />
              <div>
                <p className="text-sm font-medium text-gray-800">{rider.full_name}</p>
                {rider.phone && <p className="text-xs text-gray-400">{rider.phone}</p>}
              </div>
            </div>
            <a href={`tel:${rider.phone}`} className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
              <Phone size={16} className="text-blue-600" />
            </a>
          </div>
          <div className="mt-2">
            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">Nasa daan na ang rider papunta sa buyer</span>
          </div>
          {currentOrder.payment_method !== 'cod' && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2">
              <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 leading-relaxed">
                Nasa iyo na ang delivery fee (₱{Number(currentOrder.delivery_fee).toFixed(2)}) mula sa binayaran ng buyer. Ibigay ito sa rider gamit ang QR code niya.
              </p>
            </div>
          )}
          {currentOrder.payment_method !== 'cod' && rider.rider_qr_code_url && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1.5">
                <QrCode size={14} className="text-brand-600" /> QR Code ng Rider para sa Delivery Fee
              </p>
              <div className="bg-gray-50 rounded-xl p-3 flex justify-center">
                <img src={rider.rider_qr_code_url} alt="QR Code ng Rider" loading="lazy" decoding="async" className="w-36 h-36 rounded-xl object-contain" />
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">I-scan para mabayaran ang delivery fee (₱{Number(currentOrder.delivery_fee).toFixed(2)}) ng rider.</p>
            </div>
          )}
        </div>
      )}

      {/* COD delivered — collect from rider */}
      {isDelivered && isCod && !currentOrder.cod_payment_reference && (
        <div className="bg-green-50 border border-green-300 rounded-2xl p-4 mb-3 flex items-center gap-2">
          <Check size={18} className="text-green-600" />
          <p className="text-sm text-green-700 font-medium">Na-deliver na! Kolektahin ang ₱{(Number(currentOrder.total) + Number(currentOrder.delivery_fee)).toFixed(2)} sa rider pagbalik niya.</p>
        </div>
      )}

      {/* COD payment pending — seller needs to accept */}
      {isCodPaymentPending && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={20} className="text-amber-600" />
            <p className="font-semibold text-sm text-amber-800">COD Payment mula sa Rider</p>
          </div>
          <p className="text-xs text-amber-700 mb-2">Nai-submit na ng rider ang reference number para sa COD payment. I-verify at i-accept ang payment para matapos ang transaction at lumabas ang review sa buyer.</p>
          <div className="p-3 bg-white rounded-xl border border-amber-200 mb-3">
            <p className="text-xs text-gray-400 mb-0.5">Reference Number mula sa Rider:</p>
            <p className="text-sm font-mono font-bold text-gray-800 break-all">{currentOrder.cod_payment_reference}</p>
          </div>
          <button onClick={acceptCodPayment} disabled={updating}
            className="w-full py-3 bg-green-600 text-white rounded-2xl font-semibold active:scale-[0.98] transition disabled:opacity-50">
            {updating ? 'Nag-uupdate...' : 'Tanggapin ang Payment'}
          </button>
        </div>
      )}

      {/* COD payment accepted */}
      {isDelivered && isCod && currentOrder.cod_payment_accepted_at && (
        <div className="bg-green-50 border border-green-300 rounded-2xl p-4 mb-3 flex items-center gap-2">
          <Check size={18} className="text-green-600" />
          <p className="text-sm text-green-700 font-medium">Na-tanggap na ang COD payment. Tapos na ang transaction!</p>
        </div>
      )}

      {/* Rider Picker Modal */}
      {showRiderPicker && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setShowRiderPicker(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[80vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Users size={20} className="text-brand-600" /> Pumili ng Rider
              </h3>
              <button onClick={() => setShowRiderPicker(false)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            {loadingRiders ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="text-brand-500 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3">
                  <label className="text-xs font-semibold text-blue-800 block mb-2">Vehicle tier para sa order</label>
                  <select
                    value={fleetTier}
                    onChange={e => {
                      const nextTier = e.target.value as VehicleTier;
                      setFleetTier(nextTier);
                      supabase.from('orders').update({ vehicle_type: nextTier }).eq('id', currentOrder.id);
                      setCurrentOrder(prev => ({ ...prev, vehicle_type: nextTier }));
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-blue-200 bg-white text-sm text-gray-700 outline-none"
                  >
                    {VEHICLE_TIERS.map(vt => (
                      <option key={vt.id} value={vt.id}>{vt.label} — max {vt.maxLoadKg}kg</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-blue-700 mt-2">Ang napiling tier ang gagamitin para i-filter ang compatible riders.</p>
                </div>
                {/* Nearby riders — already delivering to same/nearby destination */}
                {nearbyRiders.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <Bike size={16} className="text-blue-500" />
                      <p className="text-xs font-semibold text-blue-700">Nasa parehong lugar na — pwede isabay</p>
                    </div>
                    <p className="text-[11px] text-gray-400 mb-2 px-1">Mga rider na nagde-deliver na sa malapit sa destinasyon ng buyer mo. Pwede mo silang i-assign para isabay ang order.</p>
                    <div className="space-y-2">
                      {nearbyRiders.map(n => (
                        <button
                          key={n.rider_id}
                          onClick={() => assignRider(n.rider_id)}
                          disabled={assigningRider !== null}
                          className="w-full flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-2xl active:scale-[0.98] transition disabled:opacity-50 text-left"
                        >
                          <Avatar src={n.rider_avatar} name={n.rider_name} size={40} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 text-sm">{n.rider_name}</p>
                            <p className="text-xs text-blue-600 truncate">
                              {n.distance_km != null
                                ? `${n.distance_km.toFixed(1)} km layo · `
                                : ''}
                              {n.delivery_barangay || n.delivery_city || 'Same area'}
                            </p>
                            {n.active_store_name && (
                              <p className="text-[11px] text-gray-400 truncate">Galing: {n.active_store_name}</p>
                            )}
                          </div>
                          {assigningRider === n.rider_id ? (
                            <Loader2 size={18} className="text-brand-500 animate-spin" />
                          ) : (
                            <span className="text-xs text-blue-600 font-semibold whitespace-nowrap">Isabay →</span>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                      <div className="flex-1 h-px bg-gray-100" />
                      <span>Iba pang available na riders</span>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>
                  </div>
                )}

                {/* All available riders */}
                {availableRiders.length === 0 && nearbyRiders.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Bike size={40} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Wala pang available na riders sa ngayon.</p>
                    <p className="text-xs mt-1">Subukan ulit mamaya o i-broadcast na lang ang order.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableRiders.map(r => (
                      <button
                        key={r.id}
                        onClick={() => assignRider(r.id)}
                        disabled={assigningRider !== null}
                        className="w-full flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-2xl active:scale-[0.98] transition disabled:opacity-50 text-left"
                      >
                        <Avatar src={r.avatar_url} name={r.full_name} size={40} />
                        <div className="flex-1">
                          <p className="font-medium text-gray-800 text-sm">{r.full_name}</p>
                          {r.phone && <p className="text-xs text-gray-400">{r.phone}</p>}
                        </div>
                        {assigningRider === r.id ? (
                          <Loader2 size={18} className="text-brand-500 animate-spin" />
                        ) : (
                          <span className="text-xs text-brand-600 font-medium">I-assign →</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Buyer Info */}
      {buyer && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
          <h3 className="font-semibold text-gray-800 mb-2">Buyer</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar src={buyer.avatar_url} name={buyer.full_name} size={36} />
              <span className="text-sm text-gray-600">{buyer.full_name}</span>
            </div>
            <a href={`tel:${buyer.phone}`} className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
              <Phone size={16} className="text-blue-600" />
            </a>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            <MapPin size={14} className="inline mr-1" />
            {currentOrder.delivery_address}
          </div>
          {currentOrder.buyer_note && (
            <div className="mt-2 bg-amber-50 rounded-lg p-2 text-sm text-amber-700">
              <strong>Note:</strong> {currentOrder.buyer_note}
            </div>
          )}
          {!isCancelled && (
            <button
              onClick={() => onOpenChat(currentOrder, buyer?.full_name || 'Buyer')}
              className="w-full mt-3 py-2.5 bg-brand-50 text-brand-700 rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition border border-brand-100"
            >
              <MessageCircle size={16} /> Chat with Buyer
            </button>
          )}
        </div>
      )}

      {/* Items */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
        <h3 className="font-semibold text-gray-800 mb-3">Mga Paninda</h3>
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-3 py-2">
            <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
              {item.product_image && <img src={item.product_image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{item.product_name}</p>
              <p className="text-xs text-gray-400">{item.unit === 'kilo' ? `${Number(item.quantity)} kg` : item.quantity} × ₱{item.price}</p>
            </div>
            <p className="font-semibold text-sm text-gray-700">₱{(Number(item.price) * Number(item.quantity)).toFixed(0)}</p>
          </div>
        ))}
        <div className="pt-2 border-t border-gray-100 mt-2 space-y-1">
          <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>₱{Number(currentOrder.total).toFixed(2)}</span></div>
          <div className="flex justify-between text-sm text-gray-500"><span>Delivery fee</span><span>₱{Number(currentOrder.delivery_fee).toFixed(2)}</span></div>
          <div className="flex justify-between font-bold text-gray-800"><span>Total</span><span>₱{(Number(currentOrder.total) + Number(currentOrder.delivery_fee)).toFixed(2)}</span></div>
        </div>
      </div>

      {/* Cancel button */}
      {!isDelivered && !isCancelled && (
        <button onClick={() => updateStatus('cancelled')} disabled={updating}
          className="w-full py-3 bg-white text-red-500 border border-red-200 rounded-2xl font-semibold active:scale-[0.98] transition disabled:opacity-50">
          Kanselahin ang Order
        </button>
      )}
    </div>
  );
}

// ============= SELLER SETTINGS =============
// ============= SHAREABLE LINK SECTION =============
function ShareableLinkSection({ label, url, onOpen }: { label: string; url: string; onOpen: () => void }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-2">
      <div className="flex items-center gap-2 mb-2">
        <Share2 size={18} className="text-brand-600" />
        <span className="font-medium text-sm text-gray-700">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-500 truncate border border-gray-100">{url}</div>
        <button onClick={copy} className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center active:scale-95 transition flex-shrink-0">
          {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-brand-600" />}
        </button>
        <button onClick={onOpen} className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center active:scale-95 transition flex-shrink-0">
          <ExternalLink size={16} className="text-brand-600" />
        </button>
      </div>
    </div>
  );
}

// ============= SELLER MESSAGES VIEW =============
function SellerMessagesView({ onOpenChat, adminConversations, onOpenAdminChat }: { onOpenChat: (convId: string, name: string, role: string) => void; adminConversations: AdminConversation[]; onOpenAdminChat: (convId: string, name: string) => void }) {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<(Conversation & { other_name: string; other_role: string; last_message: string | null; last_message_time: string | null; unread: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminLastMsgs, setAdminLastMsgs] = useState<Record<string, { body: string; created_at: string; unread: boolean }>>({});

  useEffect(() => {
    if (!profile) return;
    const userId = profile.id;
    async function load() {
      const { data: convs } = await supabase
        .from('conversations')
        .select('*')
        .eq('seller_id', userId)
        .order('updated_at', { ascending: false });
      if (!convs) { setLoading(false); return; }

      const enriched = await Promise.all((convs as Conversation[]).map(async (conv) => {
        let otherName = 'Unknown';
        let otherRole = '';
        if (conv.type === 'buyer_seller') {
          const { data: buyer } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', conv.buyer_id)
            .maybeSingle();
          otherName = buyer?.full_name || 'Buyer';
          otherRole = 'Buyer';
        } else {
          const { data: rider } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', conv.rider_id || '')
            .maybeSingle();
          otherName = rider?.full_name || 'Rider';
          otherRole = 'Rider';
        }
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('body, created_at, sender_id, read_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', userId)
          .is('read_at', null);
        return {
          ...conv,
          other_name: otherName,
          other_role: otherRole,
          last_message: lastMsg?.body || null,
          last_message_time: lastMsg?.created_at || null,
          unread: count || 0,
        };
      }));
      setConversations(enriched);
      setLoading(false);
    }
    load();
    const sub = supabase.channel('seller-messages-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [profile]);

  // Load last message + unread for admin conversations
  useEffect(() => {
    if (!profile || adminConversations.length === 0) { setAdminLastMsgs({}); return; }
    const userId = profile.id;
    async function loadAdminMsgs() {
      const msgMap: Record<string, { body: string; created_at: string; unread: boolean }> = {};
      await Promise.all(adminConversations.map(async (c) => {
        const { data: msgs } = await supabase
          .from('admin_messages')
          .select('body, created_at, sender_id, read_at')
          .eq('conversation_id', c.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (msgs) {
          msgMap[c.id] = {
            body: (msgs as any).body,
            created_at: (msgs as any).created_at,
            unread: (msgs as any).sender_id !== userId && !(msgs as any).read_at,
          };
        }
      }));
      setAdminLastMsgs(msgMap);
    }
    loadAdminMsgs();
    const sub = supabase.channel('seller-admin-msgs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_messages' }, () => loadAdminMsgs())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [profile, adminConversations]);

  return (
    <div className="px-5 py-4">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Mga Mensahe</h2>

      {/* Admin Support Conversations */}
      {adminConversations.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-1"><Shield size={12} /> Admin Support</p>
          <div className="space-y-2">
            {adminConversations.map(c => {
              const last = adminLastMsgs[c.id];
              return (
                <button
                  key={c.id}
                  onClick={() => onOpenAdminChat(c.id, 'Admin')}
                  className="w-full bg-blue-50 rounded-2xl border border-blue-200 p-4 text-left active:scale-[0.98] transition flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <Shield size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm text-gray-800 truncate">Admin</p>
                      {last && (
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{new Date(last.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{last?.body || 'Magsimula ng usapan'}</p>
                  </div>
                  {last?.unread && (
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Order Conversations */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : conversations.length === 0 && adminConversations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MessageCircle size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">Wala pang messages. Makikipag-chat ka kapag may nag-order na buyer!</p>
        </div>
      ) : conversations.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">Wala pang order messages.</p>
      ) : (
        <div className="space-y-2">
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => onOpenChat(conv.id, conv.other_name, conv.other_role)}
              className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left active:scale-[0.98] transition flex items-center gap-3"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${conv.other_role === 'Rider' ? 'bg-blue-100' : 'bg-brand-100'}`}>
                {conv.other_role === 'Rider' ? <Bike size={20} className="text-blue-600" /> : <StoreIcon size={20} className="text-brand-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm text-gray-800 truncate">{conv.other_name}</p>
                  {conv.last_message_time && (
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{new Date(conv.last_message_time).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate mt-0.5">{conv.last_message || 'Wala pang messages'}</p>
              </div>
              {conv.unread > 0 && (
                <span className="bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold flex-shrink-0" style={{ fontSize: 10 }}>
                  {conv.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============= SELLER BOTTOM NAV =============
function SellerBottomNav({ tab, setTab, storeId, unreadMessages }: { tab: Tab; setTab: (t: Tab) => void; storeId: string; unreadMessages: number }) {
  const [newOrders, setNewOrders] = useState(0);
  const [paidOrders, setPaidOrders] = useState(0);

  useEffect(() => {
    async function loadCounts() {
      const [{ count: pendingCount }, { count: paidCount }] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', storeId).eq('status', 'pending'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', storeId).eq('payment_status', 'paid').in('status', ['accepted', 'preparing', 'ready_for_pickup', 'picked_up']),
      ]);
      setNewOrders(pendingCount || 0);
      setPaidOrders(paidCount || 0);
    }
    loadCounts();

    const sub = supabase.channel('seller-nav')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` }, () => loadCounts())
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [storeId]);

  const orderBadge = newOrders + paidOrders;
  const orderAlert = newOrders > 0 || paidOrders > 0;

  const items: { id: Tab; icon: typeof TrendingUp; label: string; badge?: number; alert?: boolean }[] = [
    { id: 'dashboard', icon: TrendingUp, label: 'Dashboard' },
    { id: 'products', icon: Package, label: 'Paninda' },
    { id: 'orders', icon: ShoppingBag, label: 'Orders', badge: orderBadge, alert: orderAlert },
    { id: 'messages', icon: MessageCircle, label: 'Messages', badge: unreadMessages },
    { id: 'billing', icon: Wallet, label: 'Billing' },
  ];

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-7xl bg-white border-t border-gray-100 px-1 py-1.5 safe-bottom z-50 overflow-x-auto scrollbar-hide md:px-6">
      <div className="flex items-center justify-around min-w-full">
        {items.map(item => {
          const Icon = item.icon;
          const active = tab === item.id;
          const isAlert = item.alert && item.badge && item.badge > 0;
          return (
            <button key={item.id} onClick={() => setTab(item.id)} className="flex flex-col items-center gap-0.5 py-1.5 px-1.5 relative flex-shrink-0">
              <div className="relative">
                <Icon
                  size={22}
                  className={
                    isAlert
                      ? 'text-red-500 animate-pulse'
                      : active
                        ? 'text-brand-600'
                        : 'text-gray-400'
                  }
                />
                {item.badge && item.badge > 0 ? (
                  <span
                    className={`absolute -top-1.5 -right-1.5 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] ${
                      isAlert ? 'bg-red-500 animate-bounce' : 'bg-orange-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <span
                className={`text-[10px] ${
                  isAlert
                    ? 'text-red-500 font-bold'
                    : active
                      ? 'text-brand-600 font-medium'
                      : 'text-gray-400'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
