// @ts-nocheck
import { shareToMessenger } from '../lib/messengerShare';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { navigate } from '../lib/router';
import { checkOrderFlood, checkIpMismatch } from '../lib/security';
import type { Product, Store, Category, CartItem, Order, OrderItem, OrderStatus, Conversation, AdminConversation } from '../lib/types';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../lib/types';
import { LocationSelector, type LocationData } from '../components/LocationSelector';
import { InactiveBanner } from '../components/InactiveBanner';
import {
  computeDeliveryFee, estimateDistanceKm,
  haversineKm, getStoreCoords, getDeliveryCoords,
  computeDeliveryFeeFromCoords, fetchRoadDistance,
  BASE_DELIVERY_FEE, PER_KM_RATE, computeFleetDeliveryFee, getRequiredTier, getZoneRates, computeDistanceCharge, computeWeightSurcharge, FREE_WEIGHT_KG, isNcrRegion, type ZoneRates, type VehicleTier,
  type Coords, type RouteResult,
} from '../lib/deliveryFee';
import { fetchBarangaysByCity, fetchCitiesByRegion, fetchCitiesByProvince, fetchProvincesByRegion, formatRegionForDisplay as sharedFormatRegion } from '../lib/philippineLocations';

const OLD_REGION_MAP: Record<string, string> = {
  'NCR': '1300000000', 'CAR': '1400000000',
  'Region I': '0100000000', 'Region II': '0200000000', 'Region III': '0300000000',
  'Region IV-A': '0400000000', 'Region IV-B': '1700000000', 'Region V': '0500000000',
  'Region VI': '0600000000', 'Region VII': '0700000000', 'Region VIII': '0800000000',
  'Region IX': '0900000000', 'Region X': '1000000000', 'Region XI': '1100000000',
  'Region XII': '1200000000', 'Region XIII': '1600000000', 'BARMM': '1900000000',
};

function formatRegionForDisplay(region: string | null | undefined): string {
  return sharedFormatRegion(region);
}
import { BuyerLiveTrackingMap } from '../components/BuyerLiveTrackingMap';
import { LiveETATimer } from '../components/LiveETATimer';
import { DeliveryMap } from '../components/DeliveryMap';
import { COMMISSION_RATE } from '../lib/types';
import { ChatView, getOrCreateConversation } from '../components/ChatView';
import { Avatar } from '../components/Avatar';
import { ImageUploadField } from '../components/ImageUploadField';
import { ReviewForm, ReviewSection } from '../components/Reviews';
import { OrderStepTracker, type StepInfo } from '../components/OrderStepTracker';
import { VideoCreditStore } from '../components/VideoCreditStore';
import { AdminVideoCall } from '../components/AdminVideoCall';
import { AdminChat } from '../components/AdminChat';
import { LoginReminderPopup } from '../components/LoginReminderPopup';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useIncomingAdminCall } from '../lib/useAdminCall';
import { useAdminConversations } from '../lib/useAdminChat';
import {
  Search, ShoppingCart, Home, Package, User, UserRound, Plus, Minus, Trash2, X,
  MapPin, Star, Fish, ArrowLeft, Check, ChevronRight, ChevronDown, Bike, Store as StoreIcon,
  QrCode, Clock, Phone, Navigation, Filter, ShoppingBag, MessageCircle, Send,
  Share2, Copy, ExternalLink, Download, ImageOff, Bell, Timer, CheckCircle, LogOut,
  Shield, Info, ShieldAlert, Lock, AlertTriangle, Facebook, Loader2, CalendarClock,
} from 'lucide-react';

type Tab = 'home' | 'orders' | 'cart' | 'messages' | 'profile';
type View = 'browse' | 'product' | 'store' | 'checkout' | 'order_detail' | 'chat' | 'payment_summary';

function createCheckoutGroupId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function BuyerApp() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('home');
  const [view, setView] = useState<View>('browse');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [highlightProductId, setHighlightProductId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cartRefresh, setCartRefresh] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [paymentGroupOrders, setPaymentGroupOrders] = useState<Order[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [chatPartnerName, setChatPartnerName] = useState('');
  const [chatPartnerRole, setChatPartnerRole] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [orderUpdates, setOrderUpdates] = useState(0);
  const { incomingCall, adminName, clearCall } = useIncomingAdminCall();
  const [activeAdminCall, setActiveAdminCall] = useState<{ roomId: string; callId: string; otherName: string } | null>(null);
  const { conversations: adminConvs, unreadCount: adminUnread } = useAdminConversations();
  const [activeAdminChat, setActiveAdminChat] = useState<{ conversationId: string; otherName: string } | null>(null);

  function navigateToProduct(product: Product, store: Store) {
    setSelectedStore(store);
    setHighlightProductId(product.id);
    setView('store');
  }

  function navigateToProductDetail(product: Product) {
    setSelectedProduct(product);
    setHighlightProductId(null);
    setView('product');
  }

  function navigateToStore(store: Store) {
    setSelectedStore(store);
    setHighlightProductId(null);
    setView('store');
  }

  function navigateToOrder(order: Order) {
    setSelectedOrder(order);
    setView('order_detail');
  }

  function backToBrowse() {
    setView('browse');
    setSelectedProduct(null);
    setSelectedStore(null);
    setSelectedOrder(null);
    setHighlightProductId(null);
  }

  function refreshCart() {
    setCartRefresh(c => c + 1);
    setCartCount(c => c + 1);
  }

  async function openChat(
    orderId: string,
    buyerId: string,
    type: 'buyer_seller' | 'buyer_rider',
    partnerName: string,
    partnerRole: string,
    sellerId?: string | null,
    riderId?: string | null,
  ) {
    const conv = await getOrCreateConversation(orderId, buyerId, type, sellerId, riderId);
    if (conv) {
      setActiveConversationId(conv.id);
      setChatPartnerName(partnerName);
      setChatPartnerRole(partnerRole);
      setView('chat');
    }
  }

  function backFromChat() {
    setView('browse');
    setActiveConversationId(null);
  }

  // Load initial cart count and keep in sync via realtime
  useEffect(() => {
    if (!profile) return;
    async function loadCartCount() {
      const { data } = await supabase.from('cart_items').select('id').eq('buyer_id', profile.id);
      setCartCount(data?.length || 0);
    }
    loadCartCount();
    const sub = supabase.channel('cart-count-nav')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cart_items', filter: `buyer_id=eq.${profile.id}` }, () => loadCartCount())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [profile]);

  // Track unread messages for badge
  useEffect(() => {
    if (!profile) return;
    const userId = profile.id;
    async function countUnread() {
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .eq('buyer_id', userId);
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
    const sub = supabase.channel('buyer-unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => countUnread())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [profile]);

  const totalUnread = unreadCount + adminUnread;

  // Track order status updates from seller (accepted, preparing, ready, picked_up)
  useEffect(() => {
    if (!profile) return;
    async function countUpdates() {
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('buyer_id', profile.id)
        .in('status', ['accepted', 'preparing', 'ready_for_pickup', 'picked_up']);
      setOrderUpdates(count || 0);
    }
    countUpdates();
    const sub = supabase.channel('buyer-order-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `buyer_id=eq.${profile.id}` }, () => countUpdates())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [profile]);

  const canAct = profile?.is_active ?? true;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full max-w-7xl mx-auto relative">
      {!canAct && <InactiveBanner />}
      {/* Content */}
      <div className="flex-1 pb-24 overflow-y-auto">
        {tab === 'home' && view === 'browse' && (
          <BrowseView onProductClick={navigateToProduct} onStoreClick={navigateToStore} orderUpdates={orderUpdates} onOpenOrders={() => { setTab('orders'); setView('browse'); }} onSignOut={signOut} onGoToProfile={() => setTab('profile')} />
        )}
        {tab === 'home' && view === 'product' && selectedProduct && (
          <ProductView product={selectedProduct} store={selectedStore!} onBack={() => { setView('store'); setSelectedProduct(null); }} onAddToCart={refreshCart} onGoToStore={(s, pid) => { setSelectedStore(s); setHighlightProductId(pid); setSelectedProduct(null); setView('store'); }} />
        )}
        {tab === 'home' && view === 'store' && selectedStore && (
          <StoreView store={selectedStore} highlightProductId={highlightProductId} onProductClick={(p) => navigateToProductDetail(p)} onBack={backToBrowse} />
        )}
        {tab === 'home' && view === 'checkout' && (
          <ErrorBoundary fallback={
            <div className="px-5 pt-20 text-center">
              <AlertTriangle size={48} className="mx-auto text-amber-500 mb-3" />
              <h2 className="text-lg font-bold text-gray-800 mb-2">Hindi mabuksan ang Checkout</h2>
              <p className="text-sm text-gray-500 mb-5">May item sa cart na kulang o hindi na available. Bumalik sa cart at alisin ito bago subukan ulit.</p>
              <button onClick={() => { setTab('cart'); setView('browse'); }} className="px-5 py-3 bg-brand-600 text-white rounded-xl font-semibold">
                Bumalik sa Cart
              </button>
            </div>
          }>
            <CheckoutView onBack={backToBrowse} onOrderPlaced={(orders) => {
              if (orders.length > 1) {
                setPaymentGroupOrders(orders);
                setView('payment_summary');
              } else {
                setTab('orders');
                setView('browse');
              }
            }} canAct={canAct} />
          </ErrorBoundary>
        )}
        {tab === 'home' && view === 'payment_summary' && (
          <PaymentSummaryView orders={paymentGroupOrders} onDone={() => { setTab('orders'); setView('browse'); }} onBack={backToBrowse} />
        )}
        {tab === 'home' && view === 'order_detail' && selectedOrder && (
          <OrderDetailView order={selectedOrder} onBack={backToBrowse} onOpenChat={openChat} />
        )}

        {tab === 'orders' && (
          <OrdersView onOrderClick={navigateToOrder} />
        )}
        {tab === 'orders' && view === 'order_detail' && selectedOrder && (
          <OrderDetailView order={selectedOrder} onBack={() => { setView('browse'); setSelectedOrder(null); }} onOpenChat={openChat} />
        )}

        {tab === 'cart' && (
          <CartView onCheckout={() => { setTab('home'); setView('checkout'); }} refreshKey={cartRefresh} />
        )}

        {tab === 'messages' && view === 'browse' && (
          <MessagesView onOpenChat={(convId, name, role) => {
            setActiveConversationId(convId);
            setChatPartnerName(name);
            setChatPartnerRole(role);
            setView('chat');
          }} adminConversations={adminConvs} onOpenAdminChat={(convId, name) => {
            setActiveAdminChat({ conversationId: convId, otherName: name });
          }} />
        )}
        {tab === 'messages' && view === 'chat' && activeConversationId && (
          <ChatView conversationId={activeConversationId} otherName={chatPartnerName} otherRole={chatPartnerRole} onBack={backFromChat} />
        )}

        {tab === 'profile' && (
          <ProfileView onSignOut={signOut} />
        )}

        {view === 'chat' && tab !== 'messages' && activeConversationId && (
          <ChatView conversationId={activeConversationId} otherName={chatPartnerName} otherRole={chatPartnerRole} onBack={backFromChat} />
        )}
      </div>

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

      {activeAdminChat && profile && (
        <AdminChat
          conversationId={activeAdminChat.conversationId}
          currentUserId={profile.id}
          otherName={activeAdminChat.otherName}
          isAdmin={false}
          onBack={() => setActiveAdminChat(null)}
        />
      )}

      {/* Bottom Nav */}
      <BottomNav tab={tab} setTab={(t) => { setTab(t); setView('browse'); }} unreadMessages={totalUnread} orderUpdates={orderUpdates} cartCount={cartCount} />

      <LoginReminderPopup storageKey="buyer_login_reminder" variant="buyer" />
    </div>
  );
}

// ============= BROWSE VIEW =============
function BrowseView({ onProductClick, onStoreClick, orderUpdates, onOpenOrders, onSignOut, onGoToProfile }: { onProductClick: (p: Product, s: Store) => void; onStoreClick: (s: Store) => void; orderUpdates: number; onOpenOrders: () => void; onSignOut: () => void; onGoToProfile: () => void }) {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<(Product & { store: Store })[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState({ city: '', region: '', barangay: '', palengke: '' });
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showBarangayDropdown, setShowBarangayDropdown] = useState(false);
  const [showPalengkeDropdown, setShowPalengkeDropdown] = useState(false);

  // Fetch barangay options based on buyer's city/region (async from PSGC API)
  const [barangayOptions, setBarangayOptions] = useState<string[]>([]);
  useEffect(() => {
    const city = locationFilter.city || profile?.city || '';
    const rawRegion = locationFilter.region || profile?.region || '';
    if (!city || !rawRegion) { setBarangayOptions([]); return; }
    // Normalize old region codes to PSGC format
    const region = /^\d{10}$/.test(rawRegion) ? rawRegion : (OLD_REGION_MAP[rawRegion] || rawRegion);
    if (!region) { setBarangayOptions([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const isNCR = region.startsWith('13');
        let cityCode: string | null = null;
        if (isNCR) {
          const cities = await fetchCitiesByRegion(region);
          cityCode = cities.find(c => c.name.toLowerCase() === city.toLowerCase())?.code || null;
        } else {
          const provinces = await fetchProvincesByRegion(region);
          for (const prov of provinces) {
            const cities = await fetchCitiesByProvince(prov.code);
            cityCode = cities.find(c => c.name.toLowerCase() === city.toLowerCase())?.code || null;
            if (cityCode) break;
          }
        }
        if (!cityCode) { if (!cancelled) setBarangayOptions([]); return; }
        const brgys = await fetchBarangaysByCity(cityCode);
        if (!cancelled) setBarangayOptions(brgys);
      } catch { if (!cancelled) setBarangayOptions([]); }
    })();
    return () => { cancelled = true; };
  }, [locationFilter.city, locationFilter.region, profile?.city, profile?.region]);

  // Compute palengke options from loaded stores in the same city
  const palengkeOptions: string[] = (() => {
    const city = (locationFilter.city || profile?.city || '').toLowerCase();
    const names = stores
      .filter(s => s.city.toLowerCase() === city && s.palengke_name)
      .map(s => s.palengke_name!)
      .filter((v, i, arr) => arr.indexOf(v) === i);
    return names;
  })();

  // Auto-set location filter from buyer's profile on first load
  useEffect(() => {
    if (profile?.city && !locationFilter.city && !locationFilter.region) {
      setLocationFilter({ city: profile.city, region: profile.region || '', barangay: '', palengke: '' });
    }
  }, [profile]);

  useEffect(() => {
    async function load() {
      const [{ data: cats }, { data: prods }, { data: strs }] = await Promise.all([
        supabase.from('categories').select('id, name, name_fil, slug, icon, image_url, sort_order').order('sort_order'),
        supabase.from('products').select('id, name, description, price, unit, image_url, stock, is_available, category_id, store_id, delivery_method, created_at, store:stores(id, name, barangay, district, city, region, palengke_name, is_open, is_verified, rating, logo_url, banner_url, seller_id)').eq('is_available', true).order('created_at', { ascending: false }).limit(30),
        supabase.from('stores').select('id, name, description, barangay, district, city, region, palengke_name, logo_url, banner_url, is_open, rating, qr_code_url, payment_method, seller_id, seller:profiles(full_name, avatar_url)').eq('is_open', true).eq('is_verified', true).order('rating', { ascending: false }).limit(20),
      ]);
      setCategories(cats || []);
      setProducts((prods || []) as any);
      setStores((strs || []) as any);
      setLoading(false);
    }
    load();
  }, []);

  // Realtime: reload when stores or products change (e.g. admin deactivates a seller)
  useEffect(() => {
    const sub = supabase.channel('browse-stores-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => {
        supabase.from('stores').select('id, name, description, barangay, district, city, region, palengke_name, logo_url, banner_url, is_open, rating, qr_code_url, payment_method, seller_id, seller:profiles(full_name, avatar_url)').eq('is_open', true).eq('is_verified', true).order('rating', { ascending: false }).limit(20)
          .then(({ data }) => setStores((data || []) as any));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        supabase.from('products').select('id, name, description, price, unit, image_url, stock, is_available, category_id, store_id, delivery_method, created_at, store:stores(id, name, barangay, district, city, region, palengke_name, is_open, is_verified, rating, logo_url, banner_url, seller_id)').eq('is_available', true).order('created_at', { ascending: false }).limit(30)
          .then(({ data }) => setProducts((data || []) as any));
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const filteredProducts = products.filter(p => {
    if (!p.store?.is_verified) return false;
    if (!p.store?.is_open) return false;
    if (activeCategory && p.category_id !== activeCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.store.name.toLowerCase().includes(search.toLowerCase()) && !(p.store.palengke_name || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (locationFilter.city && p.store.city.toLowerCase() !== locationFilter.city.toLowerCase()) return false;
    if (locationFilter.region && p.store.region.toLowerCase() !== locationFilter.region.toLowerCase()) return false;
    if (locationFilter.barangay) {
      const brgy = locationFilter.barangay.toLowerCase();
      const storeBrgy = p.store.barangay?.toLowerCase() || '';
      const storePalengke = (p.store.palengke_name || '').toLowerCase();
      if (storeBrgy !== brgy && !storePalengke.includes(brgy)) return false;
    }
    if (locationFilter.palengke && !(p.store.palengke_name || '').toLowerCase().includes(locationFilter.palengke.toLowerCase())) return false;
    return true;
  });

  // Sort: same city first, then same region, then others
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const aCity = a.store.city.toLowerCase() === (locationFilter.city || '').toLowerCase() ? 0 : 1;
    const bCity = b.store.city.toLowerCase() === (locationFilter.city || '').toLowerCase() ? 0 : 1;
    if (aCity !== bCity) return aCity - bCity;
    const aRegion = a.store.region.toLowerCase() === (locationFilter.region || '').toLowerCase() ? 0 : 1;
    const bRegion = b.store.region.toLowerCase() === (locationFilter.region || '').toLowerCase() ? 0 : 1;
    return aRegion - bRegion;
  });

  // Near you = same city
  const nearYouProducts = sortedProducts.filter(p => p.store.city.toLowerCase() === (locationFilter.city || '').toLowerCase());
  const otherProducts = sortedProducts.filter(p => p.store.city.toLowerCase() !== (locationFilter.city || '').toLowerCase());

  const filteredStores = stores.filter(s => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !(s.palengke_name || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (locationFilter.city && s.city.toLowerCase() !== locationFilter.city.toLowerCase()) return false;
    if (locationFilter.region && s.region.toLowerCase() !== locationFilter.region.toLowerCase()) return false;
    if (locationFilter.barangay) {
      const brgy = locationFilter.barangay.toLowerCase();
      const storeBrgy = s.barangay?.toLowerCase() || '';
      const storePalengke = (s.palengke_name || '').toLowerCase();
      if (storeBrgy !== brgy && !storePalengke.includes(brgy)) return false;
    }
    if (locationFilter.palengke && !(s.palengke_name || '').toLowerCase().includes(locationFilter.palengke.toLowerCase())) return false;
    return true;
  });

  // Sort stores: same city first
  const sortedStores = [...filteredStores].sort((a, b) => {
    const aCity = a.city.toLowerCase() === (locationFilter.city || '').toLowerCase() ? 0 : 1;
    const bCity = b.city.toLowerCase() === (locationFilter.city || '').toLowerCase() ? 0 : 1;
    if (aCity !== bCity) return aCity - bCity;
    const aRegion = a.region.toLowerCase() === (locationFilter.region || '').toLowerCase() ? 0 : 1;
    const bRegion = b.region.toLowerCase() === (locationFilter.region || '').toLowerCase() ? 0 : 1;
    return aRegion - bRegion;
  });

  const needsProfilePic = !profile?.avatar_url;
  const needsHousePhoto = !profile?.house_photo_url;
  const showProfileBanner = needsProfilePic || needsHousePhoto;

  return (
    <div>
      {/* Profile completion banner */}
      {showProfileBanner && (
        <button onClick={onGoToProfile} className="w-full bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center gap-3 text-left active:bg-amber-100 transition">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            {needsHousePhoto ? <Home size={20} className="text-amber-600" /> : <User size={20} className="text-amber-600" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-800">Kumpletuhin muna ang profile mo</p>
            <p className="text-xs text-amber-700 leading-snug">
              {needsProfilePic && needsHousePhoto
                ? 'Mag-upload ng profile picture at larawan ng bahay mo sa Profile tab.'
                : needsProfilePic
                ? 'Mag-upload ng profile picture mo sa Profile tab.'
                : 'Mag-upload ng larawan ng bahay mo sa Profile tab. Kailangan ito bago makapag-order.'}
            </p>
          </div>
          <ChevronRight size={18} className="text-amber-400 flex-shrink-0 ml-auto" />
        </button>
      )}
      {/* Header */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-5 pt-12 pb-6 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img src="/images/Copilot_20260907_183703.jpg" alt="GoPalengke" className="w-8 h-8 rounded-lg object-cover" />
            <span className="text-xl font-bold">GoPalengke</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onGoToProfile}
              aria-label="Buksan ang buyer profile"
              className="h-12 w-12 overflow-hidden rounded-full border-2 border-white bg-white shadow-md active:scale-95 transition"
            >
              <Avatar src={profile?.avatar_url} name={profile?.full_name} size={44} />
            </button>
            <button onClick={onSignOut} aria-label="Mag-logout" className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center active:scale-90 transition">
              <LogOut size={18} className="text-white" />
            </button>
          </div>
        </div>
        <p className="text-brand-100 text-sm mb-4">
          Hello, {profile?.full_name?.split(' ')[0]}! Ano ang plano mong lutuin ngayon?
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Maghanap ng isda, karne, gulay..."
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white text-gray-800 placeholder-gray-400 outline-none text-sm shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-brand-100">
          <MapPin size={14} />
          <button onClick={() => setShowLocationModal(true)} className="text-left hover:underline">
            {locationFilter.city || profile?.barangay || 'Set location'}, {formatRegionForDisplay(locationFilter.region || profile?.region)}
          </button>
        </div>
      </div>

      {/* Order Update Notification Banner */}
      {orderUpdates > 0 && (
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
                <p className="font-bold text-base">May {orderUpdates} update sa order{orderUpdates > 1 ? 's' : ''} mo!</p>
                <p className="text-sm text-white/90">I-tap para tingnan ang update mula seller</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <ChevronRight size={18} className="text-white" />
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Location Filter */}
      <div className="px-5 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <Filter size={16} className="text-gray-400 flex-shrink-0" />
          <button
            onClick={() => setLocationFilter({ city: profile?.city || '', region: profile?.region || '', barangay: '', palengke: '' })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 ${!locationFilter.barangay && !locationFilter.palengke ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}`}
          >
            Near Me
          </button>
          <button
            onClick={() => setLocationFilter({ city: '', region: '', barangay: '', palengke: '' })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 ${!locationFilter.city && !locationFilter.region && !locationFilter.barangay && !locationFilter.palengke ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}`}
          >
            Lahat
          </button>
          {/* Barangay dropdown trigger */}
          <button
            onClick={() => setShowBarangayDropdown(true)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 flex-shrink-0 ${locationFilter.barangay ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}`}
          >
            {locationFilter.barangay || 'Barangay'}
            <ChevronDown size={12} />
          </button>
          {/* Palengke dropdown trigger */}
          <button
            onClick={() => setShowPalengkeDropdown(true)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 flex-shrink-0 ${locationFilter.palengke ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}`}
          >
            {locationFilter.palengke || 'Palengke'}
            <ChevronDown size={12} />
          </button>
          <button
            onClick={() => setShowLocationModal(true)}
            className="px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 bg-gray-100 text-gray-600"
          >
            Palitan Location
          </button>
        </div>
      </div>

      {/* Trust Headline */}
      <div className="px-5 pt-2 pb-3">
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-2xl px-4 py-3 shadow-sm">
          <p className="text-white font-bold text-base leading-snug text-center">
            All vendors are verified via video call kaya sure na legit at safe ka!
          </p>
        </div>
      </div>

      {/* Categories — scrolling marquee */}
      <div className="py-3 overflow-hidden">
        <div className="flex gap-3 animate-marquee-slow w-max">
          {[...categories, ...categories].map((cat, idx) => {
            const realIdx = idx % categories.length;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={`${cat.id}-${idx}`}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                className={`flex flex-col items-center gap-1.5 flex-shrink-0 w-20 ${isActive ? 'opacity-100' : 'opacity-70'}`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl ${isActive ? 'bg-brand-500 shadow-md shadow-brand-500/30' : 'bg-white border border-gray-200'}`}>
                  <CategoryIcon slug={cat.slug} active={isActive} />
                </div>
                <span className={`text-xs font-medium text-center leading-tight ${isActive ? 'text-brand-700' : 'text-gray-600'}`}>{cat.name_fil}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stores */}
      {sortedStores.length > 0 && (
        <div className="px-5 mb-4">
          <h3 className="font-bold text-gray-800 mb-3">Mga Tindahan sa Palengke</h3>
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {sortedStores.slice(0, 10).map(store => (
              <button
                key={store.id}
                onClick={() => onStoreClick(store)}
                className="flex-shrink-0 w-44 sm:w-52 lg:w-60 text-left bg-white rounded-2xl border border-gray-100 active:scale-[0.98] transition overflow-hidden"
              >
                <div className="aspect-[16/9] bg-gray-100 relative overflow-hidden">
                  {store.banner_url && <img src={store.banner_url} alt={store.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                  {store.city.toLowerCase() === (locationFilter.city || '').toLowerCase() && (
                    <span className="absolute top-1 right-1 bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full">Near You</span>
                  )}
                </div>
                <div className="px-2.5 pb-2.5">
                  <div className="relative z-10 flex items-center gap-2 -mt-5 mb-1">
                    <div className="w-10 h-10 rounded-full bg-white border-2 border-white shadow-md overflow-hidden flex-shrink-0">
                      {(store as any).seller?.avatar_url ? (
                        <img src={(store as any).seller.avatar_url} alt={(store as any).seller.full_name || store.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm font-bold text-brand-400">
                          {(store as any).seller?.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="font-semibold text-sm text-gray-800 line-clamp-1">{store.name}</p>
                  {(store as any).seller?.full_name && (
                    <p className="text-xs text-gray-400 line-clamp-1">{(store as any).seller.full_name}</p>
                  )}
                  {store.palengke_name && (
                    <p className="text-xs text-brand-600 flex items-center gap-0.5 mt-0.5 min-w-0">
                      <MapPin size={10} className="shrink-0" />
                      <span className="truncate">{store.palengke_name}</span>
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-1 min-w-0">
                    <Star size={12} className="shrink-0 fill-amber-400 text-amber-400" />
                    <span className="text-xs text-gray-500">{store.rating}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <MapPin size={12} className="text-gray-400" />
                    <span className="text-xs text-gray-500 truncate">{store.city}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      <div className="px-5 pb-4">
        <h3 className="font-bold text-gray-800 mb-3">
          {activeCategory ? `${categories.find(c => c.id === activeCategory)?.name_fil}` : 'Sariwang Paninda'}
        </h3>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {[1,2,3,4].map(i => <div key={i} className="h-56 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ShoppingBag size={48} className="mx-auto mb-3 opacity-50" />
            <p>Walang nahanap na paninda. Subukan ibang filter!</p>
          </div>
        ) : (
          <>
            {nearYouProducts.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-2 mt-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <p className="text-sm font-semibold text-green-600">Malapit sa iyo ({nearYouProducts.length})</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4 md:grid-cols-3 lg:grid-cols-4">
                  {nearYouProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => onProductClick(p, p.store)}
                      className="bg-white rounded-2xl overflow-hidden border border-green-200 text-left active:scale-[0.98] transition"
                    >
                      <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                        {p.image_url && <img src={p.image_url} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                        {p.stock <= 5 && p.stock > 0 && (
                          <span className="absolute top-2 left-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">Lang {p.stock} na</span>
                        )}
                        {p.stock === 0 && (
                          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">Ubos na</span>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="font-semibold text-sm text-gray-800 line-clamp-1">{p.name}</p>
                        <p className="text-xs text-gray-400 line-clamp-1 mb-1">{p.store.name}</p>
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="font-bold text-brand-600">₱{p.price}</p>
                            <p className="text-xs text-gray-400">per {p.unit}</p>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center">
                            <Plus size={16} className="text-white" />
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
            {otherProducts.length > 0 && (
              <>
                {nearYouProducts.length > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-gray-300" />
                    <p className="text-sm font-semibold text-gray-500">Iba pang lugar ({otherProducts.length})</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {otherProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => onProductClick(p, p.store)}
                      className="bg-white rounded-2xl overflow-hidden border border-gray-100 text-left active:scale-[0.98] transition"
                    >
                      <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                        {p.image_url && <img src={p.image_url} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                        {p.stock <= 5 && p.stock > 0 && (
                          <span className="absolute top-2 left-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">Lang {p.stock} na</span>
                        )}
                        {p.stock === 0 && (
                          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">Ubos na</span>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="font-semibold text-sm text-gray-800 line-clamp-1">{p.name}</p>
                        <p className="text-xs text-gray-400 line-clamp-1 mb-1">{p.store.name}</p>
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="font-bold text-brand-600">₱{p.price}</p>
                            <p className="text-xs text-gray-400">per {p.unit}</p>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center">
                            <Plus size={16} className="text-white" />
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Barangay Picker Modal */}
      {showBarangayDropdown && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end max-w-md mx-auto animate-fade-in" onClick={() => setShowBarangayDropdown(false)}>
          <div className="bg-white w-full rounded-t-3xl max-h-[70vh] overflow-y-auto animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Piliin ang Barangay</h2>
              <button onClick={() => setShowBarangayDropdown(false)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={20} className="text-gray-600" />
              </button>
            </div>
            <div className="px-5 py-3 pb-8 space-y-1">
              <button
                onClick={() => { setLocationFilter(f => ({ ...f, barangay: '' })); setShowBarangayDropdown(false); }}
                className={`w-full text-left px-4 py-3.5 rounded-xl flex items-center gap-3 ${!locationFilter.barangay ? 'bg-brand-50 text-brand-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Filter size={18} className="text-gray-500" />
                </div>
                <span className="text-sm">Lahat ng Barangay</span>
                {!locationFilter.barangay && <Check size={18} className="text-brand-600 ml-auto" />}
              </button>
              {barangayOptions.map(brgy => (
                <button
                  key={brgy}
                  onClick={() => { setLocationFilter(f => ({ ...f, barangay: brgy })); setShowBarangayDropdown(false); }}
                  className={`w-full text-left px-4 py-3.5 rounded-xl flex items-center gap-3 ${locationFilter.barangay === brgy ? 'bg-brand-50 text-brand-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}
                >
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <MapPin size={18} className="text-brand-600" />
                  </div>
                  <span className="text-sm flex-1">{brgy}</span>
                  {locationFilter.barangay === brgy && <Check size={18} className="text-brand-600 flex-shrink-0" />}
                </button>
              ))}
              {barangayOptions.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">I-set muna ang location mo para makita ang mga barangay.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Palengke Picker Modal */}
      {showPalengkeDropdown && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end max-w-md mx-auto animate-fade-in" onClick={() => setShowPalengkeDropdown(false)}>
          <div className="bg-white w-full rounded-t-3xl max-h-[70vh] overflow-y-auto animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Piliin ang Palengke</h2>
              <button onClick={() => setShowPalengkeDropdown(false)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={20} className="text-gray-600" />
              </button>
            </div>
            <div className="px-5 py-3 pb-8 space-y-1">
              <button
                onClick={() => { setLocationFilter(f => ({ ...f, palengke: '' })); setShowPalengkeDropdown(false); }}
                className={`w-full text-left px-4 py-3.5 rounded-xl flex items-center gap-3 ${!locationFilter.palengke ? 'bg-brand-50 text-brand-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Filter size={18} className="text-gray-500" />
                </div>
                <span className="text-sm">Lahat ng Palengke</span>
                {!locationFilter.palengke && <Check size={18} className="text-brand-600 ml-auto" />}
              </button>
              {palengkeOptions.map(name => (
                <button
                  key={name}
                  onClick={() => { setLocationFilter(f => ({ ...f, palengke: name })); setShowPalengkeDropdown(false); }}
                  className={`w-full text-left px-4 py-3.5 rounded-xl flex items-center gap-3 ${locationFilter.palengke === name ? 'bg-brand-50 text-brand-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}
                >
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <MapPin size={18} className="text-brand-600" />
                  </div>
                  <span className="text-sm flex-1">{name}</span>
                  {locationFilter.palengke === name && <Check size={18} className="text-brand-600 flex-shrink-0" />}
                </button>
              ))}
              {palengkeOptions.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">Walang available na palengke sa location na ito.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end max-w-md mx-auto animate-fade-in">
          <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Palitan ang Location</h2>
              <button onClick={() => setShowLocationModal(false)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={20} className="text-gray-600" />
              </button>
            </div>
            <div className="px-5 py-4 pb-8">
              <LocationSelector
                value={{ barangay: locationFilter.barangay, district: '', city: locationFilter.city, region: locationFilter.region }}
                onChange={(loc) => setLocationFilter({ city: loc.city, region: loc.region, barangay: loc.barangay, palengke: locationFilter.palengke })}
                label="Hanapin ang mga tindahan malapit sa..."
              />
              <button
                onClick={() => setShowLocationModal(false)}
                className="w-full mt-4 py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg active:scale-[0.98] transition"
              >
                I-set ang Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryIcon({ slug, active }: { slug: string; active: boolean }) {
  const color = active ? 'text-white' : 'text-gray-500';
  switch (slug) {
    case 'fish-seafood': return <Fish size={28} className={color} />;
    case 'meat': return <BeefIcon className={color} />;
    case 'vegetables': return <CarrotIcon className={color} />;
    case 'fruits': return <AppleIcon className={color} />;
    case 'poultry': return <EggIcon className={color} />;
    case 'rice-grains': return <WheatIcon className={color} />;
    case 'condiments-spices': return <span className={color} style={{ fontSize: 28 }}>🧂</span>;
    case 'dried-goods': return <span className={color} style={{ fontSize: 28 }}>🐟</span>;
    case 'noodles-pasta': return <span className={color} style={{ fontSize: 28 }}>🍜</span>;
    case 'eggs': return <EggIcon className={color} />;
    case 'frozen-goods': return <span className={color} style={{ fontSize: 28 }}>🧊</span>;
    case 'bakery': return <span className={color} style={{ fontSize: 28 }}>🍞</span>;
    case 'beverages': return <span className={color} style={{ fontSize: 28 }}>🥤</span>;
    case 'snacks-sweets': return <span className={color} style={{ fontSize: 28 }}>🍪</span>;
    case 'household-items': return <span className={color} style={{ fontSize: 28 }}>🧴</span>;
    case 'general-merchandise': return <Package size={28} className={color} />;
    case 'livestock': return <span className={color} style={{ fontSize: 28 }}>🐔</span>;
    case 'ulam': return <span className={color} style={{ fontSize: 28 }}>🍲</span>;
    case 'kakanin': return <span className={color} style={{ fontSize: 28 }}>🍡</span>;
    default: return <Package size={28} className={color} />;
  }
}

// Custom icons not in lucide
function BeefIcon({ className }: { className?: string }) {
  return <span className={className} style={{ fontSize: 28 }}>🥩</span>;
}
function CarrotIcon({ className }: { className?: string }) {
  return <span className={className} style={{ fontSize: 28 }}>🥕</span>;
}
function AppleIcon({ className }: { className?: string }) {
  return <span className={className} style={{ fontSize: 28 }}>🍎</span>;
}
function EggIcon({ className }: { className?: string }) {
  return <span className={className} style={{ fontSize: 28 }}>🥚</span>;
}
function WheatIcon({ className }: { className?: string }) {
  return <span className={className} style={{ fontSize: 28 }}>🌾</span>;
}

// ============= PRODUCT VIEW =============
function ProductView({ product, store, onBack, onAddToCart, onGoToStore }: { product: Product; store: Store; onBack: () => void; onAddToCart: () => void; onGoToStore: (store: Store, productId: string) => void }) {
  const { profile } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [sizeMultiplier, setSizeMultiplier] = useState(1);
  const [adding, setAdding] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [reminderData, setReminderData] = useState<{ storeName: string; storeId: string; productId: string; productPrice: number } | null>(null);

  const isKilo = product.unit === 'kilo';
  const effectiveQty = isKilo ? quantity * sizeMultiplier : quantity;
  const unitLabel = isKilo ? (sizeMultiplier === 1 ? 'kilo' : sizeMultiplier === 0.5 ? '1/2 kilo' : '1/4 kilo') : product.unit;

  async function addToCart() {
    if (!profile) return;
    setAdding(true);

    const { data: otherItems } = await supabase
      .from('cart_items')
      .select('store_id, store:stores(name)')
      .eq('buyer_id', profile.id)
      .neq('store_id', store.id);

    if (otherItems && otherItems.length > 0) {
      const otherStoreId = otherItems[0].store_id;
      const otherStoreName = (otherItems[0].store as any)?.name || 'ibang tindahan';

      const { data: matchingProduct } = await supabase
        .from('products')
        .select('id, name, price')
        .eq('store_id', otherStoreId)
        .eq('is_available', true)
        .ilike('name', product.name)
        .maybeSingle();

      if (matchingProduct) {
        setReminderData({
          storeName: otherStoreName,
          storeId: otherStoreId,
          productId: matchingProduct.id,
          productPrice: matchingProduct.price,
        });
        setShowReminder(true);
        setAdding(false);
        return;
      }
    }

    await doAddToCart();
  }

  async function doAddToCart() {
    if (!profile) return;
    setAdding(true);
    const { data: existing } = await supabase
      .from('cart_items')
      .select('*')
      .eq('buyer_id', profile.id)
      .eq('product_id', product.id)
      .maybeSingle();

    if (existing) {
      await supabase.from('cart_items').update({ quantity: Number(existing.quantity) + effectiveQty }).eq('id', existing.id);
    } else {
      await supabase.from('cart_items').insert({
        buyer_id: profile.id,
        product_id: product.id,
        store_id: store.id,
        quantity: effectiveQty,
      });
    }
    setAdding(false);
    onAddToCart();
    onBack();
  }

  return (
    <div>
      <div className="relative h-64 bg-gray-100">
        {product.image_url && <img src={product.image_url} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
        <button onClick={onBack} className="absolute top-12 left-4 w-10 h-10 rounded-full bg-white/90 shadow-md flex items-center justify-center">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
      </div>
      <div className="px-5 py-4">
        <p className="text-sm text-gray-400 mb-1">{store.name}</p>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{product.name}</h1>
        <div className="flex items-center gap-3 mb-4">
          <p className="text-2xl font-bold text-brand-600">₱{(Number(product.price) * (isKilo ? sizeMultiplier : 1)).toFixed(2)}</p>
          <p className="text-sm text-gray-400">per {isKilo ? unitLabel : product.unit}</p>
          {store.is_open ? (
            <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Store Open</span>
          ) : (
            <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Store Closed</span>
          )}
        </div>
        {product.description && <p className="text-gray-600 text-sm mb-4">{product.description}</p>}

        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <MapPin size={16} />
          <span>{store.barangay}, {store.city}, {formatRegionForDisplay(store.region)}</span>
        </div>
        {store.palengke_name && (
          <div className="flex items-center gap-2 text-sm text-brand-600 mb-6 bg-brand-50 px-3 py-2 rounded-xl">
            <MapPin size={16} />
            <span>Pwesto sa <strong>{store.palengke_name}</strong></span>
          </div>
        )}

        {(product.delivery_method === 'pickup' || product.delivery_method === 'meetup') && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-700">
                <p className="font-semibold">Buhay na Hayop — {product.delivery_method === 'pickup' ? 'Pick Up Lang' : 'Meet Up Lang'}</p>
                <p className="text-xs mt-1">
                  {product.delivery_method === 'pickup'
                    ? 'Sunduin ang order sa tindahan ng seller. Hindi pwede ang rider delivery para sa buhay na hayop.'
                    : 'Magkasundong lugar ang buyer at seller para sa pagpapalit. Hindi pwede ang rider delivery para sa buhay na hayop.'}
                </p>
              </div>
            </div>
            {store.livestock_permit_url && (
              <div className="flex items-center gap-1.5 text-xs text-green-600 mt-2">
                <Shield size={14} />
                <span>May permit ang seller para sa transport ng buhay na hayop</span>
              </div>
            )}
          </div>
        )}

        {product.stock > 0 ? (
          <div className="space-y-4">
            {isKilo && (
              <div>
                <span className="font-medium text-gray-700 block mb-2">Laki</span>
                <div className="flex gap-2">
              {[
                { label: '1/4 kilo', value: 0.25 },
                { label: '1/2 kilo', value: 0.5 },
                { label: '1 kilo', value: 1 },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSizeMultiplier(opt.value)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${sizeMultiplier === opt.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600'}`}
                >
                  {opt.label}
                </button>
              ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">Bilang</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-90 transition"
                >
                  <Minus size={18} className="text-gray-600" />
                </button>
                <span className="font-semibold text-lg w-8 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}
                  className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center active:scale-90 transition"
                >
                  <Plus size={18} className="text-white" />
                </button>
              </div>
            </div>
            <button
              onClick={addToCart}
              disabled={adding}
              className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-brand-600/20 active:scale-[0.98] transition disabled:opacity-50"
            >
              {adding ? 'Nadadagdag...' : `Idagdag sa Cart · ₱${(Number(product.price) * effectiveQty).toFixed(2)}`}
            </button>
          </div>
        ) : (
          <p className="text-center py-4 text-gray-400 font-medium">Ubos na ang paninda. Balik na lang mamaya!</p>
        )}
      </div>

      {showReminder && reminderData && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end max-w-md mx-auto animate-fade-in">
          <div className="bg-white w-full rounded-t-3xl p-5 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                <Info size={24} className="text-brand-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">May {product.name} din sa {reminderData.storeName}</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  May cart items ka na mula sa {reminderData.storeName}. Available din doon ang {product.name}{reminderData.productPrice !== product.price ? ` sa ₱${reminderData.productPrice}` : ''}.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowReminder(false); doAddToCart(); }}
                className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold active:scale-[0.98] transition"
              >
                Magpatuloy dito
              </button>
              <button
                onClick={() => {
                  setShowReminder(false);
                  onGoToStore({ ...store, id: reminderData.storeId } as Store, reminderData.productId);
                }}
                className="flex-1 py-3.5 rounded-2xl bg-brand-600 text-white font-semibold active:scale-[0.98] transition"
              >
                Tingnan sa {reminderData.storeName}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============= STORE VIEW =============
function StoreView({ store, highlightProductId, onProductClick, onBack }: { store: Store; highlightProductId?: string | null; onProductClick: (p: Product) => void; onBack: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellerAvatar, setSellerAvatar] = useState<string | null>(null);
  const [sellerName, setSellerName] = useState<string>('');
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('products').select('id, name, description, price, unit, image_url, stock, is_available, category_id, store_id, delivery_method, created_at').eq('store_id', store.id).eq('is_available', true).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { setProducts(data || []); setLoading(false); });
    supabase.from('profiles').select('full_name, avatar_url').eq('id', store.seller_id).maybeSingle()
      .then(({ data }) => {
        if (data) { setSellerAvatar(data.avatar_url); setSellerName(data.full_name); }
      });
  }, [store.id]);

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightProductId, products, loading]);

  return (
    <div>
      <div className="relative overflow-hidden bg-white md:rounded-b-3xl">
        {/* Phone: ipakita ang banner eksakto kung ano ang inupload ng seller */}
        <div className="relative aspect-video w-full bg-gray-100 md:hidden">
          {store.banner_url && <img src={store.banner_url} alt={store.name} decoding="async" className="h-full w-full object-cover object-center" fetchPriority="high" />}
          {store.description && (
            <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/70 via-black/40 to-transparent px-4 pb-3 pt-8">
              <p className="line-clamp-2 text-center text-xs leading-5 text-white drop-shadow sm:text-sm">{store.description}</p>
            </div>
          )}
        </div>
        {/* Laptop: berdeng background na may kurbang banner (leaf shape) sa kanan */}
        <div className="relative hidden h-72 overflow-hidden bg-brand-600 md:block lg:h-80">
          <div className="absolute left-0 top-0 z-[1] flex h-full w-[34%] min-w-0 flex-col justify-center px-8 text-white">
            <h2 className="line-clamp-2 font-display text-3xl font-bold lg:text-4xl">{store.name}</h2>
            <div className="mt-2 flex items-center gap-1.5 text-sm text-white/90">
              <Star size={14} className="shrink-0 fill-amber-400 text-amber-400" />
              <span>{store.rating}</span>
              {store.city && <><span className="text-white/50">·</span><span className="truncate">{store.city}</span></>}
            </div>
            <span className={`mt-2 w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${store.is_open ? 'bg-white/90 text-green-700' : 'bg-white/90 text-red-600'}`}>
              {store.is_open ? 'Store Open' : 'Store Closed'}
            </span>
          </div>
          {store.banner_url && (
            <div className="absolute right-0 top-0 h-full w-[62%] overflow-hidden" style={{ borderRadius: '45% 0 0 45% / 50% 0 0 50%' }}>
              <img src={store.banner_url} alt={store.name} decoding="async" className="h-full w-full object-cover object-center" fetchPriority="high" />
              {store.description && (
                <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/70 via-black/40 to-transparent px-6 pb-4 pt-10">
                  <p className="line-clamp-2 text-center text-sm leading-6 text-white drop-shadow">{store.description}</p>
                </div>
              )}
            </div>
          )}
        </div>
        <button onClick={onBack} aria-label="Bumalik" className="absolute top-12 left-4 z-10 w-10 h-10 rounded-full bg-white/90 shadow-md flex items-center justify-center">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
      </div>
      <div className="px-5 pt-4 relative bg-white">
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 shadow-md overflow-hidden border-2 border-white flex-shrink-0">
            {sellerAvatar ? (
              <img src={sellerAvatar} alt={sellerName || store.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-brand-500">
                {sellerName?.[0]?.toUpperCase() || store.name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          <div className="min-w-0 pt-1">
            <h1 className="text-xl font-bold text-gray-800 break-words">{store.name}</h1>
            {sellerName && (
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                <UserRound size={12} className="text-gray-400 flex-shrink-0" />
                {sellerName}
              </p>
            )}
            <div className="flex items-center gap-1 mt-1">
              <Star size={14} className="fill-amber-400 text-amber-400" />
              <span className="text-sm text-gray-600">{store.rating}</span>
              <span className="text-sm text-gray-300">·</span>
              <span className="text-sm text-gray-500">{store.city}</span>
              <span className="text-sm text-gray-300">·</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${store.is_open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {store.is_open ? 'Store Open' : 'Store Closed'}
              </span>
            </div>
            {store.palengke_name && (
              <p className="text-xs text-brand-600 flex items-center gap-1 mt-1">
                <MapPin size={12} />
                Pwesto sa {store.palengke_name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
          <MapPin size={16} />
          <span>{[store.barangay, store.city, formatRegionForDisplay(store.region)].filter(Boolean).join(', ')}</span>
        </div>
      </div>

      {highlightProductId && !loading && products.find(p => p.id === highlightProductId) && (
        <div className="mx-5 mt-3 bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-center gap-2">
          <CheckCircle size={18} className="text-brand-600 flex-shrink-0" />
          <p className="text-sm text-brand-700">
            Pinili mo ang <strong>{products.find(p => p.id === highlightProductId)?.name}</strong>. Tingnan ang lahat ng paninda ng tindahang ito bago mag-order.
          </p>
        </div>
      )}

      <div className="px-5 py-4">
        <h3 className="font-bold text-gray-800 mb-3">Mga Paninda</h3>
        {!store.is_open ? (
          <div className="text-center py-12 text-gray-400">
            <StoreIcon size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-gray-500">Sarado ang tindahan ngayon.</p>
            <p className="text-xs mt-1">Balikan mo mamaya para makita ang paninda!</p>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{[1,2,3,4].map(i => <div key={i} className="h-44 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {products.map(p => {
              const isHighlighted = highlightProductId === p.id;
              return (
                <div key={p.id} ref={isHighlighted ? highlightRef : undefined}>
                  <button
                    onClick={() => onProductClick(p)}
                    className={`w-full bg-white rounded-2xl overflow-hidden text-left active:scale-[0.98] transition relative ${isHighlighted ? 'border-2 border-brand-500 shadow-lg shadow-brand-500/20' : 'border border-gray-100'}`}
                  >
                    {isHighlighted && (
                      <span className="absolute top-2 left-2 z-10 bg-brand-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">Pinili mo</span>
                    )}
                    <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                      {p.image_url && <img src={p.image_url} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                    </div>
                    <div className="p-2.5">
                      <p className="font-semibold text-sm text-gray-800 line-clamp-1">{p.name}</p>
                      <p className="font-bold text-brand-600 mt-1">₱{p.price}<span className="text-xs text-gray-400 font-normal">/{p.unit}</span></p>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Seller Reviews Section */}
      <div className="px-5 pb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
            <Star size={18} className="text-amber-500" /> Mga Review ng Tindahan
          </h3>
          <ReviewSection userId={store.seller_id} />
        </div>
      </div>
    </div>
  );
}

// ============= CART VIEW =============
function cartWeightKg(items: any[]): number {
  return items.reduce((sum, i) => {
    const qty = Number(i.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return sum;
    const u = i.product?.unit?.toLowerCase() || '';
    if (['kilo','kg','kilogram','liter','litro','l'].includes(u)) return sum + qty;
    if (u === 'gram' || u === 'g') return sum + qty / 1000;
    if (u === 'bundle' || u === 'bugkos') return sum + qty * 2;
    if (u === 'tray' || u === 'itlog') return sum + qty;
    if (['piece','pc','piraso'].includes(u)) return sum + qty * 0.3;
    if (u === 'dozen' || u === 'dosen') return sum + qty * 1.5;
    if (u === 'sack' || u === 'sako') return sum + qty * 25;
    return sum + qty * 0.5;
  }, 0);
}

function MultiStoreWeightNotice({ items, storeCount }: { items: any[]; storeCount: number }) {
  if (storeCount < 2) return null;
  const kg = cartWeightKg(items);
  if (kg > 25) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 text-sm text-red-800">
        <p className="font-bold mb-1">⚠️ Mabigat na: {kg.toFixed(1)} kg mula sa {storeCount} tindahan</p>
        <p className="text-xs leading-relaxed">Lagpas na sa 25 kg na kaya ng isang motor. Maaaring <b>2 rider</b> na ang kailangan mo, o mag-<b>Bao-Bao / Tricycle</b> ka na para sa mabigat na karga. Pwede ring bawasan o i-checkout muna ang isang tindahan.</p>
      </div>
    );
  }
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-sm text-amber-800">
      <p className="font-bold mb-1">Paalala: namili ka sa {storeCount} tindahan ({kg.toFixed(1)} kg)</p>
      <p className="text-xs leading-relaxed">Hanggang <b>20 kg</b> lang ang kaya ng isang rider na naka-motor (may palugit hanggang 25 kg). Kapag lumagpas, maaaring 2 rider o Bao-Bao na ang kailangan.</p>
    </div>
  );
}

function CartView({ onCheckout, refreshKey }: { onCheckout: () => void; refreshKey: number }) {
  const { profile } = useAuth();
  const [cartItems, setCartItems] = useState<(CartItem & { product: Product; store: Store })[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCart = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('cart_items')
      .select('*, product:products(*), store:stores(*)')
      .eq('buyer_id', profile.id)
      .order('created_at', { ascending: false });
    setCartItems(((data || []) as any[]).filter((item) => item?.store_id && item?.product && item?.store?.id));
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadCart(); }, [loadCart, refreshKey]);

  async function updateQty(id: string, qty: number) {
    if (qty <= 0) {
      await supabase.from('cart_items').delete().eq('id', id);
    } else {
      await supabase.from('cart_items').update({ quantity: qty }).eq('id', id);
    }
    loadCart();
  }

  async function removeItem(id: string) {
    await supabase.from('cart_items').delete().eq('id', id);
    loadCart();
  }

  const grouped = cartItems.reduce((acc, item) => {
    if (!acc[item.store_id]) acc[item.store_id] = [];
    acc[item.store_id].push(item);
    return acc;
  }, {} as Record<string, (CartItem & { product: Product; store: Store })[]>);

  const total = cartItems.reduce((sum, item) => sum + item.product.price * Number(item.quantity), 0);

  if (loading) return <div className="p-5"><div className="h-40 bg-gray-100 rounded-2xl animate-pulse" /></div>;

  if (cartItems.length === 0) {
    return (
      <div className="px-5 pt-20 text-center">
        <ShoppingCart size={64} className="mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-700 mb-2">Walang laman ang cart</h2>
        <p className="text-gray-400 text-sm">Magdagdag ng paninda para mag-order!</p>
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Cart ko</h2>
      <MultiStoreWeightNotice items={cartItems} storeCount={Object.keys(grouped).length} />
      {Object.entries(grouped).map(([storeId, items]) => (
        <div key={storeId} className="mb-4">
          <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
            <StoreIcon size={16} />
            <span className="font-medium">{items[0].store.name}</span>
            {items[0].store.palengke_name && (
              <>
                <span className="text-gray-300">·</span>
                <MapPin size={14} className="text-brand-500" />
                <span className="text-brand-600">{items[0].store.palengke_name}</span>
              </>
            )}
            <MapPin size={14} />
            <span>{items[0].store.city}</span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {items.map((item, i) => (
              <div key={item.id} className={`flex items-center gap-3 p-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                  {item.product.image_url && <img src={item.product.image_url} alt={item.product.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 line-clamp-1">{item.product.name}</p>
                  <p className="text-brand-600 font-bold">₱{item.product.price}<span className="text-xs text-gray-400 font-normal">/{item.product.unit}</span></p>
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={() => updateQty(item.id, Number(item.quantity) - (item.product.unit === 'kilo' ? 0.25 : 1))} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center active:scale-90 transition">
                      <Minus size={14} className="text-gray-600" />
                    </button>
                    <span className="text-sm font-medium w-12 text-center">{item.product.unit === 'kilo' ? `${Number(item.quantity)} kg` : item.quantity}</span>
                    <button onClick={() => updateQty(item.id, Number(item.quantity) + (item.product.unit === 'kilo' ? 0.25 : 1))} className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center active:scale-90 transition">
                      <Plus size={14} className="text-white" />
                    </button>
                    <button onClick={() => removeItem(item.id)} className="ml-auto text-gray-400">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Subtotal</span><span>₱{total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Delivery fee</span><span className="text-gray-400">Ica-calculate sa checkout</span>
        </div>
        <div className="flex justify-between font-bold text-gray-800 pt-2 border-t border-gray-100">
          <span>Estimated Total</span><span>₱{total.toFixed(2)}</span>
        </div>
      </div>

      <button
        onClick={onCheckout}
        className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-brand-600/20 active:scale-[0.98] transition"
      >
        Mag-checkout
      </button>
    </div>
  );
}

// ============= CHECKOUT VIEW =============
function CheckoutView({ onBack, onOrderPlaced, canAct }: { onBack: () => void; onOrderPlaced: (orders: Order[]) => void; canAct: boolean }) {
  const { profile } = useAuth();
  const [cartItems, setCartItems] = useState<(CartItem & { product: Product; store: Store })[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [showIpMismatchModal, setShowIpMismatchModal] = useState(false);
  const [securityPin, setSecurityPin] = useState('');
  const [simulateSms, setSimulateSms] = useState(false);
  const [mockOtp, setMockOtp] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState<LocationData>({
    barangay: profile?.barangay == null ? '' : String(profile.barangay),
    district: profile?.district == null ? '' : String(profile.district),
    city: profile?.city == null ? '' : String(profile.city),
    region: profile?.region == null || profile.region === '' ? 'NCR' : String(profile.region),
    province: profile?.province == null ? '' : String(profile.province),
  });
  const [addressDetails, setAddressDetails] = useState(profile?.complete_address == null ? '' : String(profile.complete_address));
  const [paymentMethod, setPaymentMethod] = useState<'qr_code' | 'cod'>('qr_code');
  const [note, setNote] = useState('');
  const [deliveryPin, setDeliveryPin] = useState<Coords | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'found' | 'denied' | 'unavailable' | 'timeout'>('idle');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  useEffect(() => {
    if (!profile) return;
    supabase.from('cart_items').select('*, product:products(*), store:stores(*)').eq('buyer_id', profile.id)
      .then(({ data, error }) => {
        if (error) {
          console.error('Hindi ma-load ang checkout cart:', error);
          setCartItems([]);
          setLoading(false);
          return;
        }
        setCartItems(((data || []) as any[]).filter((i) => i?.store_id && i?.product && i?.store?.id));
        setLoading(false);
      })
      .catch((error) => {
        console.error('Hindi ma-load ang checkout cart:', error);
        setCartItems([]);
        setLoading(false);
      });
  }, [profile]);

  // Auto-detect buyer's GPS location on checkout load
  // Two-stage approach: try low-accuracy (fast) first, then refine with high-accuracy
  const detectLocation = useCallback((highAccuracy: boolean) => {
    if (!navigator.geolocation) { setGpsStatus('unavailable'); return; }
    setGpsStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setDeliveryPin({ lat: latitude, lng: longitude });
        setGpsStatus('found');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus('denied');
        } else if (err.code === err.TIMEOUT) {
          if (highAccuracy) {
            // High-accuracy timed out — fall back to low-accuracy
            detectLocation(false);
          } else {
            setGpsStatus('timeout');
          }
        } else {
          setGpsStatus('unavailable');
        }
      },
      { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 12000 : 8000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    detectLocation(true);
  }, [detectLocation]);

  const grouped = useMemo(() => cartItems.reduce((acc, item) => {
    if (!item?.store_id || !item?.product || !item?.store?.id) return acc;
    if (!acc[item.store_id]) acc[item.store_id] = [];
    acc[item.store_id].push(item);
    return acc;
  }, {} as Record<string, (CartItem & { product: Product; store: Store })[]>), [cartItems]);

  const groupedStores = useMemo(() => Object.values(grouped)
    .map(items => items[0]?.store)
    .filter((store): store is Store => Boolean(store?.id)), [grouped]);

  // Get store coordinates for the first store (for map centering)
  const firstStore = Object.values(grouped)[0]?.[0]?.store;
  const storeCoords = firstStore ? getStoreCoords(firstStore) : null;

  // Get delivery coordinates: prefer pin, fall back to text-based geocoding
  const deliveryCoords: Coords | null = deliveryPin || getDeliveryCoords(deliveryLocation);

  // Road distance cache per store (keyed by storeId)
  const [roadDistanceCache, setRoadDistanceCache] = useState<Record<string, { distanceKm: number; durationMin: number }>>({});

  // Fetch road distance for each store when delivery coords are available
  useEffect(() => {
    if (!deliveryCoords || !deliveryPin) return;
    const stores = groupedStores;
    const storeIds = stores.map(s => s.id);
    const missing = storeIds.filter(id => !roadDistanceCache[id]);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const updates: Record<string, { distanceKm: number; durationMin: number }> = {};
      for (const store of stores) {
        if (roadDistanceCache[store.id]) continue;
        const sCoords = getStoreCoords(store);
        if (sCoords && deliveryCoords) {
          try {
            const result = await fetchRoadDistance(sCoords, deliveryCoords);
            if (!cancelled) updates[store.id] = result;
          } catch (error) {
            console.warn('Hindi makuha ang road distance para sa store:', store.id, error);
          }
        }
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setRoadDistanceCache(prev => ({ ...prev, ...updates }));
      }
    })();

    return () => { cancelled = true; };
  }, [deliveryCoords, groupedStores, roadDistanceCache]);

  // Check if any item in a store group is a livestock product (pickup/meetup only)
  function isLivestockOrder(items: (CartItem & { product: Product; store: Store })[]): boolean {
    return items.some(i => i.product.delivery_method === 'pickup' || i.product.delivery_method === 'meetup');
  }

  // Estimate cargo weight in kg for a set of cart items based on unit type
  function estimateWeightKg(items: (CartItem & { product: Product; store: Store })[]): number {
    return items.reduce((sum, i) => {
      const qty = Number(i.quantity);
      if (!Number.isFinite(qty) || qty <= 0) return sum;
      const unit = i.product.unit?.toLowerCase() || '';
      if (unit === 'kilo' || unit === 'kg' || unit === 'kilogram') return sum + qty;
      if (unit === 'gram' || unit === 'g') return sum + qty / 1000;
      if (unit === 'pack' || unit === 'sachet') return sum + qty * 0.5;
      if (unit === 'bundle' || unit === 'bugkos') return sum + qty * 2;
      if (unit === 'tray' || unit === 'itlog') return sum + qty * 1;
      if (unit === 'piece' || unit === 'pc' || unit === 'piraso') return sum + qty * 0.3;
      if (unit === 'dozen' || unit === 'dosen') return sum + qty * 1.5;
      if (unit === 'sack' || unit === 'sako') return sum + qty * 25;
      if (unit === 'liter' || unit === 'litro' || unit === 'l') return sum + qty;
      return sum + qty * 0.5;
    }, 0);
  }

  // Multi-store checkout: only the FIRST deliverable store (Store A) carries the base fee
  // and distance charge. Other stores (B, C...) have ₱0 delivery fee — their cargo weight
  // is added to Store A's weight surcharge. Store A receives the rider's fee (non-COD).
  function getFeeForStore(store: Store, items?: (CartItem & { product: Product; store: Store })[]): ReturnType<typeof getBaseFeeForStore> & { isPrimary: boolean; primaryStoreName: string | null; combinedStores: number } {
    const deliverable = Object.values(grouped).filter(its => !isLivestockOrder(its));
    if (deliverable.length <= 1) return { ...getBaseFeeForStore(store, items), isPrimary: true, primaryStoreName: null, combinedStores: 1 };
    const primaryStore = deliverable[0][0].store;
    if (store.id === primaryStore.id) {
      return { ...getBaseFeeForStore(store, deliverable.flat()), isPrimary: true, primaryStoreName: null, combinedStores: deliverable.length };
    }
    const own = items ? estimateWeightKg(items) : 0;
    return { fee: 0, distanceKm: 0, isEstimated: false, distanceCharge: 0, weightSurcharge: 0, totalWeightKg: own, isNcr: isNcrRegion(store.region, store.city), tier: getRequiredTier(own), riderNet: 0, commission: 0, isPrimary: false, primaryStoreName: primaryStore.name, combinedStores: deliverable.length };
  }

  // Calculate tiered fee per store: distance charge + weight surcharge
  function getBaseFeeForStore(store: Store, items?: (CartItem & { product: Product; store: Store })[]): { fee: number; distanceKm: number; isEstimated: boolean; distanceCharge: number; weightSurcharge: number; totalWeightKg: number; isNcr: boolean; tier: VehicleTier; riderNet: number; commission: number } {
    const sCoords = getStoreCoords(store);
    const totalWeightKg = items ? estimateWeightKg(items) : 0;
    const tier = getRequiredTier(totalWeightKg);

    if (sCoords && deliveryCoords && deliveryPin) {
      const road = roadDistanceCache[store.id];
      if (!road) {
        return { fee: 0, distanceKm: 0, isEstimated: true, distanceCharge: 0, weightSurcharge: 0, totalWeightKg, isNcr: isNcrRegion(store.region, store.city), tier, riderNet: 0, commission: 0 };
      }
      const distKm = Number.isFinite(Number(road.distanceKm)) ? Math.max(0, Number(road.distanceKm)) : 0;
      const fleet = computeFleetDeliveryFee(distKm, totalWeightKg, store.region, store.city, tier);
      return { fee: fleet.total, distanceKm: Math.round(distKm * 100) / 100, isEstimated: false, distanceCharge: fleet.distanceCharge, weightSurcharge: fleet.weightSurcharge, totalWeightKg, isNcr: fleet.isNcr, tier: fleet.tier, riderNet: fleet.riderNet, commission: fleet.commission };
    }
    const km = estimateDistanceKm(
      { barangay: store.barangay, city: store.city, region: store.region },
      { barangay: deliveryLocation.barangay, city: deliveryLocation.city, region: deliveryLocation.region },
    );
    const fleet = computeFleetDeliveryFee(km, totalWeightKg, store.region, store.city, tier);
    return { fee: fleet.total, distanceKm: km, isEstimated: true, distanceCharge: fleet.distanceCharge, weightSurcharge: fleet.weightSurcharge, totalWeightKg, isNcr: fleet.isNcr, tier: fleet.tier, riderNet: fleet.riderNet, commission: fleet.commission };
  }

  async function placeOrder() {
    if (!profile) return;
    if (!profile.house_photo_url) {
      alert('Kailangan mag-upload ng larawan ng bahay mo sa Profile bago mag-order. Para makilala ng rider kung aling bahay ang pupuntahan.');
      return;
    }

    // Require road distance for all stores before placing order — no straight-line fallback
    if (deliveryPin) {
      const allStores = groupedStores;
      const missing = allStores.filter(s => !roadDistanceCache[s.id]);
      if (missing.length > 0) {
        setPlacing(true);
        const updates: Record<string, { distanceKm: number; durationMin: number }> = {};
        for (const store of missing) {
          const sCoords = getStoreCoords(store);
          if (sCoords && deliveryPin) {
            const result = await fetchRoadDistance(sCoords, deliveryPin);
            updates[store.id] = result;
          }
        }
        setRoadDistanceCache(prev => ({ ...prev, ...updates }));
        setPlacing(false);
      }
    }

    setPlacing(true);

    // Security: Order flooding check — max 4 distinct stores in 2 min
    const storeIds = Object.keys(grouped);
    for (const storeId of storeIds) {
      const floodCheck = await checkOrderFlood(profile.id, storeId);
      if (floodCheck.flagged) {
        setPlacing(false);
        alert(`Order Flooding Detected: ${floodCheck.message || 'Account suspended.'} You have been logged out for security.`);
        await supabase.auth.signOut();
        return;
      }
    }

    // Security: IP / Delivery mismatch check
    if (deliveryLocation.city || deliveryLocation.region) {
      const ipCheck = await checkIpMismatch(deliveryLocation.city || '', deliveryLocation.region || '');
      if (ipCheck.mismatch) {
        setPlacing(false);
        setShowIpMismatchModal(true);
        return;
      }
    }

    const groupId = createCheckoutGroupId();
    const createdOrders: Order[] = [];

    for (const [storeId, items] of Object.entries(grouped)) {
      const store = items[0].store;
      const livestock = isLivestockOrder(items);
      const total = items.reduce((sum, i) => sum + i.product.price * Number(i.quantity), 0);
      const feeBreakdown = livestock ? null : getFeeForStore(store, items);
      const deliveryFee = feeBreakdown?.fee || 0;
      const deliveryMethod = livestock ? (items[0].product.delivery_method || 'pickup') : null;
      const fullAddress = [addressDetails, deliveryLocation.barangay, deliveryLocation.district, deliveryLocation.city, deliveryLocation.region]
        .filter(Boolean).join(', ');

      const commissionAmount = Math.round(total * COMMISSION_RATE * 100) / 100;

      const { data: order, error } = await supabase.from('orders').insert({
        buyer_id: profile.id,
        store_id: storeId,
        status: 'pending',
        payment_method: paymentMethod,
        payment_status: 'pending',
        total,
        delivery_fee: deliveryFee,
        delivery_method: deliveryMethod,
        delivery_barangay: deliveryLocation.barangay || null,
        delivery_district: deliveryLocation.district || null,
        delivery_city: deliveryLocation.city || null,
        delivery_region: deliveryLocation.region || null,
        delivery_address: fullAddress,
        delivery_lat: deliveryPin?.lat ?? null,
        delivery_lng: deliveryPin?.lng ?? null,
        buyer_note: note || null,
        commission_amount: commissionAmount,
        distance_km: feeBreakdown?.distanceKm || 0,
        vehicle_type: feeBreakdown?.tier || null,
        delivery_group_id: groupId,
        scheduled_delivery_at: scheduleEnabled && scheduleDate && scheduleTime
          ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
          : null,
      }).select('*').single();

      if (error) { setPlacing(false); return; }
      createdOrders.push(order as Order);

      const orderItems = items.map(i => ({
        order_id: order.id,
        product_id: i.product_id,
        product_name: i.product.name,
        product_image: i.product.image_url,
        price: i.product.price,
        quantity: Number(i.quantity),
        unit: i.product.unit,
      }));

      await supabase.from('order_items').insert(orderItems);
      await supabase.from('cart_items').delete().eq('buyer_id', profile.id).eq('store_id', storeId);
    }

    setPlacing(false);
    onOrderPlaced(createdOrders);
  }

  if (loading) return <div className="p-5"><div className="h-40 bg-gray-100 rounded-2xl animate-pulse" /></div>;
  if (cartItems.length === 0) return <div className="p-5 text-center text-gray-400">Walang laman ang cart.</div>;

  const grandTotal = Object.entries(grouped).reduce((sum, [_, items]) => {
    const livestock = isLivestockOrder(items);
    const fee = livestock ? 0 : getFeeForStore(items[0].store, items).fee;
    return sum + items.reduce((s, i) => s + i.product.price * Number(i.quantity), 0) + fee;
  }, 0);

  return (
    <div className="px-5 py-4 pb-8">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-800">Checkout</h2>
      </div>

      {/* Schedule Delivery */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock size={18} className="text-brand-600" />
          <h3 className="font-semibold text-gray-800">Oras ng Pag-deliver</h3>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            onClick={() => setScheduleEnabled(!scheduleEnabled)}
            className={`relative w-12 h-6 rounded-full transition ${scheduleEnabled ? 'bg-brand-500' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${scheduleEnabled ? 'left-6' : 'left-0.5'}`} />
          </button>
          <span className="text-sm text-gray-700">Mag-book ng advance order (pwede bukas o sa susunod na araw)</span>
        </label>
        {scheduleEnabled && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Petsa ng Pag-deliver</label>
              <input
                type="date"
                value={scheduleDate}
                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                max={new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Oras ng Pag-deliver</label>
              <input
                type="time"
                value={scheduleTime}
                min="06:00"
                max="20:00"
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">6:00 AM hanggang 8:00 PM lang ang available na oras.</p>
            </div>
            {scheduleDate && scheduleTime && (
              <div className="bg-brand-50 rounded-xl px-3 py-2.5 text-xs text-brand-700">
                <strong>Advance Order:</strong> Ipapa-deliver sa {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. May time ang seller para maghanda ng order mo.
              </div>
            )}
          </div>
        )}
        {!scheduleEnabled && (
          <p className="text-xs text-gray-400 mt-1">Ipapa-deliver agad pagkatapos ma-confirm ng seller at magbayad ka.</p>
        )}
      </div>

      {/* Delivery Address */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={18} className="text-brand-600" />
          <h3 className="font-semibold text-gray-800">Delivery Address</h3>
        </div>
        <LocationSelector
          value={deliveryLocation}
          onChange={setDeliveryLocation}
          compact
        />
        <div className="mt-3">
          <label className="text-xs font-medium text-gray-500 mb-1 block">Eksaktong Detalye (House/Block/Phase)</label>
          <input
            type="text"
            value={addressDetails}
            onChange={(e) => setAddressDetails(e.target.value)}
            placeholder="Hal. Blk 3 Lot 12, Phase 2, Subdivision"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition text-sm"
          />
        </div>

        {/* Auto GPS status */}
        {gpsStatus === 'locating' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-brand-600 bg-brand-50 rounded-xl px-3 py-2">
            <span className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
            Hinahanap ang iyong lokasyon...
          </div>
        )}
        {gpsStatus === 'found' && deliveryPin && (
          <div className="mt-3 flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-xl px-3 py-2">
            <MapPin size={14} className="text-green-600 flex-shrink-0" />
            Nakuha ang iyong lokasyon: {deliveryPin.lat.toFixed(4)}, {deliveryPin.lng.toFixed(4)}
          </div>
        )}
        {gpsStatus === 'denied' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
            <MapPin size={14} className="text-amber-600 flex-shrink-0" />
            <span className="flex-1">Hindi ma-access ang lokasyon. Pwede ring i-drop ang pin sa mapa sa baba.</span>
            <button onClick={() => detectLocation(true)} className="font-semibold text-amber-700 underline flex-shrink-0">Subukang muli</button>
          </div>
        )}
        {gpsStatus === 'timeout' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
            <MapPin size={14} className="text-amber-600 flex-shrink-0" />
            <span className="flex-1">Matagal ang GPS. Subukan muli o i-drop ang pin sa mapa.</span>
            <button onClick={() => detectLocation(true)} className="font-semibold text-amber-700 underline flex-shrink-0">Subukang muli</button>
          </div>
        )}
        {gpsStatus === 'unavailable' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
            <MapPin size={14} className="text-gray-400 flex-shrink-0" />
            Hindi available ang GPS. I-drop ang pin sa mapa sa baba.
          </div>
        )}

        {/* Map pin toggle */}
        <button
          onClick={() => setShowMap(!showMap)}
          className="mt-3 w-full py-2.5 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/50 text-brand-600 text-sm font-medium flex items-center justify-center gap-2 transition active:scale-[0.98]"
        >
          <MapPin size={16} />
          {showMap ? 'Itago ang mapa' : 'I-drop ang pin sa mapa para sa eksaktong lokasyon'}
        </button>

        {showMap && (
          <div className="mt-3">
            <DeliveryMap
              storeCoords={storeCoords}
              deliveryCoords={deliveryCoords}
              onPinDrop={(lat, lng) => setDeliveryPin({ lat, lng })}
              storeName={firstStore?.name}
            />
            {deliveryPin && (
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  Pin: {deliveryPin.lat.toFixed(4)}, {deliveryPin.lng.toFixed(4)}
                </span>
                <button
                  onClick={() => setDeliveryPin(null)}
                  className="text-red-500 font-medium"
                >
                  I-clear ang pin
                </button>
              </div>
            )}
            <p className="mt-1 text-xs text-gray-400">
              I-tap ang mapa para i-drop ang pin sa iyong eksaktong lokasyon. Mas tumpak ang calculation ng delivery fee gamit ang pin.
            </p>
          </div>
        )}
      </div>

      {/* House photo warning */}
      {!profile?.house_photo_url && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <Home size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-amber-800 mb-1">Kailangan ang larawan ng bahay</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              Mag-upload muna ng larawan ng labas ng bahay (makikita ang pinto o gate) sa Profile mo bago ka makapag-order. Para makilala ng rider kung aling bahay ang pupuntahan.
            </p>
          </div>
        </div>
      )}

      <MultiStoreWeightNotice items={Object.values(grouped).flat()} storeCount={Object.keys(grouped).length} />
      {/* Order Items by Store with Delivery Fee Breakdown */}
      {Object.entries(grouped).map(([storeId, items]) => {
        const store = items[0].store;
        const livestock = isLivestockOrder(items);
        const { fee, distanceKm, isEstimated, distanceCharge, weightSurcharge, totalWeightKg, isNcr, tier, isPrimary, primaryStoreName, combinedStores } = getFeeForStore(store, items);
        const rates = getZoneRates(store.region, store.city, tier);

        return (
          <div key={storeId} className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
            <div className="flex items-center gap-2 mb-3">
              <StoreIcon size={16} className="text-gray-500" />
              <span className="font-semibold text-sm text-gray-700">{store.name}</span>
              {store.palengke_name && (
                <span className="text-xs text-brand-600 flex items-center gap-0.5">
                  <MapPin size={12} />
                  {store.palengke_name}
                </span>
              )}
            </div>
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 py-2">
                <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                  {item.product.image_url && <img src={item.product.image_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{item.product.name}</p>
                  <p className="text-xs text-gray-400">{item.product.unit === 'kilo' ? `${Number(item.quantity)} kg` : item.quantity} × ₱{item.product.price}</p>
                </div>
                <p className="font-semibold text-sm text-gray-700">₱{(Number(item.product.price) * Number(item.quantity)).toFixed(0)}</p>
              </div>
            ))}

            {livestock ? (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <div className="bg-amber-50 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-700">
                    <p className="font-semibold">Buhay na Hayop — Pick Up / Meet Up Lang</p>
                    <p className="mt-0.5">Hindi pwede ang rider para sa buhay na hayop. Kailangan pick up sa tindahan o meet up sa napagkasunduang lugar. Wala ring delivery fee.</p>
                  </div>
                </div>
                {store.livestock_permit_url && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600">
                    <Shield size={14} />
                    <span>May permit ang seller para sa transport ng buhay na hayop</span>
                  </div>
                )}
              </div>
            ) : !isPrimary ? (
              <div className="mt-3 pt-3 border-t border-gray-50 space-y-1.5">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Cargo Weight</span>
                  <span>{totalWeightKg.toFixed(2)} kg</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-gray-700 pt-1.5 border-t border-gray-50">
                  <span>Delivery Fee</span>
                  <span>₱0.00</span>
                </div>
                <p className="text-xs text-brand-700 bg-brand-50 rounded-lg p-2">
                  Walang base fee at distance charge dito. Idinagdag na ang bigat ng karga sa delivery fee ng <strong>{primaryStoreName}</strong>. Wala kang babayaran sa rider para sa tindahang ito.
                </p>
              </div>
            ) : fee === 0 && deliveryPin && !roadDistanceCache[store.id] ? (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <div className="flex items-center gap-2 text-xs text-brand-600 bg-brand-50 rounded-xl px-3 py-2.5">
                  <span className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                  Kinukuha ang road distance para sa eksaktong delivery fee...
                </div>
              </div>
            ) : (
              <div className="mt-3 pt-3 border-t border-gray-50 space-y-1.5">
                {combinedStores > 1 && (
                  <p className="text-xs text-brand-700 bg-brand-50 rounded-lg p-2">
                    Isang delivery fee lang para sa {combinedStores} tindahan. Kasama na rito ang pinagsamang bigat ng karga. {paymentMethod !== 'cod' && 'Ang tindahang ito ang tatanggap ng bayad para sa rider.'}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Zone</span>
                  <span className={`font-medium px-2 py-0.5 rounded-full ${isNcr ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                    {isNcr ? 'NCR / Metro Manila' : 'Province'}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Distance {isEstimated && <span className="text-amber-500">(estimated)</span>}</span>
                  <span>{distanceKm.toFixed(2)} km</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Distance Charge {distanceKm <= 2 ? '(base, first 2 km)' : `(base + ${(distanceKm - 2).toFixed(2)} km × ₱${rates.perKmRate})`}</span>
                  <span>₱{distanceCharge.toFixed(2)}</span>
                </div>
                {totalWeightKg > 20 && (
                  <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2 mt-1">Standard motorcycle is not eligible for this load. A {tier === 'tricycle' ? 'Tricycle / Bao-Bao' : 'Minivan'} is required.</p>
                )}
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Cargo Weight</span>
                  <span>{totalWeightKg.toFixed(2)} kg {totalWeightKg <= FREE_WEIGHT_KG ? `(free ≤ ${FREE_WEIGHT_KG} kg)` : `(${(totalWeightKg - FREE_WEIGHT_KG).toFixed(2)} kg excess)`}</span>
                </div>
                {weightSurcharge > 0 && (
                  <div className="flex justify-between text-xs text-orange-600">
                    <span>Weight Surcharge ({(totalWeightKg - FREE_WEIGHT_KG).toFixed(2)} kg × ₱{rates.weightSurchargeRate})</span>
                    <span>₱{weightSurcharge.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold text-gray-700 pt-1.5 border-t border-gray-50">
                  <span>Total Delivery Fee (Rider Payout)</span>
                  <span>₱{fee.toFixed(2)}</span>
                </div>
                {distanceKm > 20 && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mt-1">
                    Mahaba ang distansya — ang rider ay sasahurin ng ₱{fee.toFixed(0)} para sa paghatid.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Payment Method */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <h3 className="font-semibold text-gray-800 mb-3">Payment Method</h3>
        <div className="space-y-2">
          <button
            onClick={() => setPaymentMethod('qr_code')}
            className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 transition ${paymentMethod === 'qr_code' ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}
          >
            <QrCode size={24} className={paymentMethod === 'qr_code' ? 'text-brand-600' : 'text-gray-400'} />
            <div className="text-left">
              <p className="font-medium text-sm text-gray-800">QR Code (GCash/Maya)</p>
              <p className="text-xs text-gray-400">I-scan ang QR code ng seller</p>
            </div>
            {paymentMethod === 'qr_code' && <Check size={20} className="text-brand-600 ml-auto" />}
          </button>
          <button
            onClick={() => setPaymentMethod('cod')}
            className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 transition ${paymentMethod === 'cod' ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}
          >
            <Package size={24} className={paymentMethod === 'cod' ? 'text-brand-600' : 'text-gray-400'} />
            <div className="text-left">
              <p className="font-medium text-sm text-gray-800">Cash on Delivery</p>
              <p className="text-xs text-gray-400">Bayaran sa rider upon delivery</p>
            </div>
            {paymentMethod === 'cod' && <Check size={20} className="text-brand-600 ml-auto" />}
          </button>
        </div>
      </div>

      {/* Note */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <h3 className="font-semibold text-gray-800 mb-2">Note sa Seller (opsyonal)</h3>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Hal. Pababa po ng konti ang isda..."
          rows={2}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500 resize-none"
        />
      </div>

      {/* Total */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex justify-between font-bold text-lg text-gray-800">
          <span>Total</span><span>₱{grandTotal.toFixed(2)}</span>
        </div>
      </div>

      <button
        onClick={placeOrder}
        disabled={placing || !canAct || !profile?.house_photo_url || (!!deliveryPin && Object.values(grouped).some(items => {
          const storeId = items[0]?.store?.id;
          return Boolean(storeId && !roadDistanceCache[storeId]);
        }))}
        className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-brand-600/20 active:scale-[0.98] transition disabled:opacity-50"
      >
        {placing ? 'Nagpapadala...' : !!deliveryPin && Object.values(grouped).some(items => {
          const storeId = items[0]?.store?.id;
          return Boolean(storeId && !roadDistanceCache[storeId]);
        }) ? 'Kinukuha ang road distance...' : `Mag-order Na · ₱${grandTotal.toFixed(2)}`}
      </button>

      {/* IP / Delivery Mismatch Verification Modal */}
      {showIpMismatchModal && (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center px-5">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert size={28} className="text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 text-center mb-2">Security Verification Required</h3>
            <p className="text-sm text-gray-500 text-center mb-4">
              Ang iyong IP location ay hindi tumutugma sa delivery address. Para sa kaligtasan, kailangan i-verify ang transaction na ito.
            </p>

            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 mb-4">
              <label className="text-sm font-medium text-gray-600">Simulate SMS Gateway (Mock)</label>
              <button
                onClick={() => {
                  const otp = Math.floor(1000 + Math.random() * 9000).toString();
                  setMockOtp(otp);
                  setSimulateSms(!simulateSms);
                }}
                className={`relative w-12 h-7 rounded-full transition ${simulateSms ? 'bg-brand-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${simulateSms ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            {simulateSms && mockOtp && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-center">
                <p className="text-xs text-blue-600 font-medium">Mock OTP Code</p>
                <p className="text-2xl font-bold text-blue-700 tracking-widest">{mockOtp}</p>
              </div>
            )}

            <div className="mb-4">
              <label className="text-sm font-medium text-gray-600 mb-1 block">Ilagay ang Security PIN o OTP</label>
              <input
                type="text"
                maxLength={6}
                value={securityPin}
                onChange={(e) => setSecurityPin(e.target.value)}
                placeholder="4-digit PIN o OTP"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 outline-none text-center text-lg tracking-widest"
              />
            </div>

            <button
              onClick={async () => {
                if (securityPin.length < 4) { alert('Ilagay ang 4-digit PIN o OTP.'); return; }
                setShowIpMismatchModal(false);
                setSecurityPin('');
                setSimulateSms(false);
                setMockOtp('');
                // Re-run placeOrder after verification
                setPlacing(true);
                // Ensure road distances are loaded before computing fees
                if (deliveryPin) {
                  const allStores = groupedStores;
                  const missing = allStores.filter(s => !roadDistanceCache[s.id]);
                  if (missing.length > 0) {
                    const updates: Record<string, { distanceKm: number; durationMin: number }> = {};
                    for (const store of missing) {
                      const sCoords = getStoreCoords(store);
                      if (sCoords && deliveryPin) {
                        const result = await fetchRoadDistance(sCoords, deliveryPin);
                        updates[store.id] = result;
                      }
                    }
                    setRoadDistanceCache(prev => ({ ...prev, ...updates }));
                  }
                }
                const groupId = createCheckoutGroupId();
                const createdOrders: Order[] = [];
                for (const [storeId, items] of Object.entries(grouped)) {
                  const store = items[0].store;
                  const livestock = isLivestockOrder(items);
                  const total = items.reduce((sum, i) => sum + i.product.price * Number(i.quantity), 0);
                  const feeBreakdown = livestock ? null : getFeeForStore(store, items);
                  const deliveryFee = livestock ? 0 : (feeBreakdown?.fee || 0);
                  const deliveryMethod = livestock ? (items[0].product.delivery_method || 'pickup') : null;
                  const fullAddress = [addressDetails, deliveryLocation.barangay, deliveryLocation.district, deliveryLocation.city, deliveryLocation.region].filter(Boolean).join(', ');
                  const commissionAmount = Math.round(total * COMMISSION_RATE * 100) / 100;
                  const { data: order, error } = await supabase.from('orders').insert({
                    buyer_id: profile!.id, store_id: storeId, status: 'pending', payment_method: paymentMethod, payment_status: 'pending',
                    total, delivery_fee: deliveryFee, delivery_method: deliveryMethod, delivery_barangay: deliveryLocation.barangay || null, delivery_district: deliveryLocation.district || null,
                    delivery_city: deliveryLocation.city || null, delivery_region: deliveryLocation.region || null, delivery_address: fullAddress,
                    delivery_lat: deliveryPin?.lat ?? null, delivery_lng: deliveryPin?.lng ?? null, buyer_note: note || null,
                    commission_amount: commissionAmount, delivery_group_id: groupId,
                    distance_km: feeBreakdown?.distanceKm || 0, vehicle_type: feeBreakdown?.tier || null,
                  }).select('*').single();
                  if (error) { setPlacing(false); return; }
                  createdOrders.push(order as Order);
                  const orderItems = items.map(i => ({ order_id: order.id, product_id: i.product_id, product_name: i.product.name, product_image: i.product.image_url, price: i.product.price, quantity: i.quantity, unit: i.product.unit }));
                  await supabase.from('order_items').insert(orderItems);
                  await supabase.from('cart_items').delete().eq('buyer_id', profile!.id).eq('store_id', storeId);
                }
                setPlacing(false);
                onOrderPlaced(createdOrders);
              }}
              className="w-full py-3.5 bg-brand-600 text-white rounded-xl font-semibold text-sm active:scale-95 transition mb-2"
            >
              I-authorize ang Order
            </button>
            <button
              onClick={() => { setShowIpMismatchModal(false); setSecurityPin(''); setSimulateSms(false); setMockOtp(''); }}
              className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm"
            >
              Kanselahin
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============= PAYMENT SUMMARY VIEW =============
function PaymentSummaryView({ orders, onDone, onBack }: { orders: Order[]; onDone: () => void; onBack: () => void }) {
  const { profile } = useAuth();
  const [stores, setStores] = useState<Record<string, Store>>({});
  const [paymentRefs, setPaymentRefs] = useState<Record<string, string>>({});
  const [paidStatus, setPaidStatus] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    async function loadStores() {
      const storeIds = [...new Set(orders.map(o => o.store_id))];
      const { data } = await supabase.from('stores').select('*').in('id', storeIds);
      const map: Record<string, Store> = {};
      (data || []).forEach((s: any) => { map[s.id] = s; });
      setStores(map);
    }
    loadStores();
  }, [orders]);

  // Subscribe to order updates to reflect payment_status changes
  useEffect(() => {
    const orderIds = orders.map(o => o.id);
    if (orderIds.length === 0) return;
    const sub = supabase.channel('payment-summary')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload: any) => {
        if (payload.new && orderIds.includes(payload.new.id)) {
          setPaidStatus(prev => ({ ...prev, [payload.new.id]: payload.new.payment_status === 'paid' }));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [orders]);

  const isQR = orders.every(o => o.payment_method === 'qr_code');
  const paidCount = orders.filter(o => paidStatus[o.id] || o.payment_status === 'paid').length;
  const allPaid = paidCount === orders.length;

  async function markPaid(orderId: string) {
    setSubmitting(orderId);
    await supabase.from('orders').update({
      payment_status: 'paid',
      payment_reference: paymentRefs[orderId]?.trim() || null,
    }).eq('id', orderId);
    setPaidStatus(prev => ({ ...prev, [orderId]: true }));
    setSubmitting(null);
  }

  return (
    <div className="px-5 py-4 pb-8">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-800">Payment Summary</h2>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">{paidCount} ng {orders.length} tindahan ang nabayaran</span>
          <span className="text-sm font-bold text-brand-600">{Math.round((paidCount / orders.length) * 100)}%</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${(paidCount / orders.length) * 100}%` }} />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {allPaid ? 'Nabayaran na lahat! Pwede mo na itong i-view sa Orders tab.' : 'Magbayad sa bawat tindahan gamit ang kanilang QR code, tapos i-mark bilang paid.'}
        </p>
      </div>

      {/* Per-store payment cards */}
      {orders.map((order) => {
        const store = stores[order.store_id];
        const isPaid = paidStatus[order.id] || order.payment_status === 'paid';
        const amount = Number(order.total) + Number(order.delivery_fee);

        return (
          <div key={order.id} className={`bg-white rounded-2xl border-2 p-4 mb-3 transition ${isPaid ? 'border-green-300 bg-green-50/30' : 'border-gray-100'}`}>
            {/* Store header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                  <StoreIcon size={16} className="text-brand-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-800">{store?.name || 'Tindahan'}</p>
                  {store?.palengke_name && <p className="text-xs text-brand-600">{store.palengke_name}</p>}
                </div>
              </div>
              {isPaid ? (
                <span className="text-xs font-bold text-green-700 bg-green-100 px-3 py-1 rounded-full flex items-center gap-1">
                  <Check size={14} /> Nabayaran na
                </span>
              ) : (
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                  Pending
                </span>
              )}
            </div>

            {/* Amount */}
            <div className="flex justify-between items-center py-2 border-t border-gray-50">
              <span className="text-sm text-gray-500">Amount to pay</span>
              <span className="text-lg font-bold text-gray-800">₱{amount.toFixed(2)}</span>
            </div>

            {/* QR Code section - only for QR payments */}
            {isQR && !isPaid && store?.qr_code_url && (
              <div className="mt-3">
                {/* QR Code Image */}
                <div className="bg-gray-50 rounded-xl p-4 flex justify-center">
                  <img src={store.qr_code_url} alt={`QR Code ng ${store.name}`} loading="lazy" decoding="async" className="w-40 h-40 rounded-xl object-contain" />
                </div>

                {/* Download button */}
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(store.qr_code_url!);
                      const blob = await response.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `qr-code-${store.name.replace(/\s+/g, '-').toLowerCase()}.png`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    } catch {
                      window.open(store.qr_code_url!, '_blank');
                    }
                  }}
                  className="w-full mt-3 py-2.5 bg-brand-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
                >
                  <Download size={16} /> I-download ang QR Code
                </button>

                {/* Reference number input */}
                <div className="mt-3">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Payment Reference Number</label>
                  <input
                    type="text"
                    value={paymentRefs[order.id] || ''}
                    onChange={(e) => setPaymentRefs(prev => ({ ...prev, [order.id]: e.target.value }))}
                    placeholder="Hal. 1234567890 o Gcash Ref#"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500 transition mb-2"
                  />
                  <button
                    onClick={() => markPaid(order.id)}
                    disabled={submitting === order.id}
                    className="w-full py-2.5 bg-green-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
                  >
                    <Check size={16} /> {submitting === order.id ? 'Nagse-send...' : 'Naka-bayad na Ako'}
                  </button>
                </div>
              </div>
            )}

            {/* QR code not uploaded */}
            {isQR && !isPaid && !store?.qr_code_url && (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 bg-amber-50 rounded-xl p-3">
                <ImageOff size={16} className="text-amber-500 flex-shrink-0" />
                <p>Wala pang QR code ang tindahan na ito. Makipag-ugnayan sa seller via chat.</p>
              </div>
            )}

            {/* COD note */}
            {!isQR && !isPaid && (
              <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-xl p-3">
                <Package size={16} className="text-amber-500 flex-shrink-0" />
                <p>Cash on Delivery — maghanda ng <strong>₱{amount.toFixed(2)}</strong> para sa rider.</p>
              </div>
            )}
          </div>
        );
      })}

      {/* Done button */}
      <button
        onClick={onDone}
        className={`w-full py-4 rounded-2xl font-semibold text-lg shadow-lg active:scale-[0.98] transition ${
          allPaid
            ? 'bg-green-600 text-white shadow-green-600/20'
            : 'bg-brand-600 text-white shadow-brand-600/20'
        }`}
      >
        {allPaid ? 'Tapos na — Pumunta sa Orders' : 'Pumunta sa Orders'}
      </button>
    </div>
  );
}

// ============= ORDERS VIEW =============
function OrdersView({ onOrderClick }: { onOrderClick: (o: Order) => void }) {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<(Order & { store: Store })[]>([]);
  const [reviewMap, setReviewMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'active' | 'history'>('active');

  const loadOrders = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('orders').select('*, store:stores(*)').eq('buyer_id', profile.id).is('hidden_by_buyer_at', null).order('created_at', { ascending: false });
    const list = (data || []) as any as (Order & { store: Store })[];
    setOrders(list);

    const deliveredIds = list.filter(o => o.status === 'delivered').map(o => o.id);
    if (deliveredIds.length > 0) {
      const { data: revs } = await supabase.from('reviews').select('order_id, review_type').in('order_id', deliveredIds);
      const map: Record<string, string[]> = {};
      for (const r of (revs || []) as { order_id: string; review_type: string }[]) {
        if (!map[r.order_id]) map[r.order_id] = [];
        map[r.order_id].push(r.review_type);
      }
      setReviewMap(map);
    } else {
      setReviewMap({});
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadOrders();
    if (!profile) return;
    const sub = supabase.channel('buyer-orders-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `buyer_id=eq.${profile.id}` }, () => loadOrders())
      .subscribe();
    const revSub = supabase.channel('buyer-orders-reviews')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => loadOrders())
      .subscribe();
    return () => { supabase.removeChannel(sub); supabase.removeChannel(revSub); };
  }, [loadOrders, profile]);

  const activeStatuses: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up'];

  // Ang delivered na order ay nananatili sa "Aktibo" hangga't hindi pa nakakapag-iwan ng review ang buyer
  const needsReview = useCallback((o: Order) => {
    if (o.status !== 'delivered') return false;
    const types = reviewMap[o.id] || [];
    if (!types.includes('seller')) return true;
    if (o.rider_id && !types.includes('rider')) return true;
    return false;
  }, [reviewMap]);

  const activeOrders = orders.filter(o => activeStatuses.includes(o.status) || needsReview(o));
  const historyOrders = orders.filter(o => !activeStatuses.includes(o.status) && !needsReview(o));
  const activeCount = activeOrders.length;
  const pendingReviewCount = orders.filter(needsReview).length;

  if (loading) return <div className="p-5"><div className="h-32 bg-gray-100 rounded-2xl animate-pulse" /></div>;

  const displayed = subTab === 'active' ? activeOrders : historyOrders;

  // Group orders by delivery_group_id; ungrouped orders (null) stay as individual items
  const grouped: { key: string; orders: (Order & { store: Store })[] }[] = [];
  const groupMap = new Map<string, (Order & { store: Store })[]>();
  for (const order of displayed) {
    const gid = order.delivery_group_id || order.id;
    if (!groupMap.has(gid)) groupMap.set(gid, []);
    groupMap.get(gid)!.push(order);
  }
  for (const [key, groupOrders] of groupMap) {
    grouped.push({ key, orders: groupOrders });
  }

  return (
    <div className="px-5 py-4">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Mga Orders ko</h2>

      {/* Sub-tabs */}
      <div className="flex gap-2 mb-4 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setSubTab('active')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1.5 ${
            subTab === 'active' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Clock size={16} />
          Aktibo
          {activeCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {activeCount > 9 ? '9+' : activeCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setSubTab('history')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1.5 ${
            subTab === 'history' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'
          }`}
        >
          <CheckCircle size={16} />
          Kasaysayan
          {historyOrders.length > 0 && (
            <span className="bg-gray-300 text-gray-600 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {historyOrders.length > 9 ? '9+' : historyOrders.length}
            </span>
          )}
        </button>
      </div>

      {subTab === 'active' && activeCount > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2">
          <Bell size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">May {activeCount} active order{activeCount > 1 ? 's' : ''} na pinoprocess pa</p>
        </div>
      )}

      {subTab === 'active' && pendingReviewCount > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-2">
          <Star size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            May <strong>{pendingReviewCount}</strong> na-deliver na order na wala pang review. Kumusta ang iyong experience sa tindahan at rider? Mag-iwan ng review para matapos at mailipat ito sa History.
          </p>
        </div>
      )}

      {displayed.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {subTab === 'active' ? (
            <>
              <Package size={48} className="mx-auto mb-3 opacity-50" />
              <p>Wala pang active order. Mag-order na!</p>
            </>
          ) : (
            <>
              <CheckCircle size={48} className="mx-auto mb-3 opacity-50" />
              <p>Wala pang completed na orders.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(group => {
            const isMulti = group.orders.length > 1;
            const firstOrder = group.orders[0];
            const groupNeedsReview = group.orders.some(needsReview);
            const isActive = activeStatuses.includes(firstOrder.status);
            const totalAmount = group.orders.reduce((sum, o) => sum + Number(o.total) + Number(o.delivery_fee), 0);
            const allSameStatus = group.orders.every(o => o.status === firstOrder.status);
            const displayStatus = allSameStatus ? firstOrder.status : 'pending';
            const anyRiderPickedUp = group.orders.some(o => o.rider_id && o.status === 'picked_up');

            if (!isMulti) {
              const order = firstOrder;
              const canDelete = !isActive && !groupNeedsReview;
              return (
                <div
                  key={group.key}
                  className={`w-full rounded-2xl border p-4 ${
                    isActive ? 'bg-red-50 border-red-300 shadow-sm' : groupNeedsReview ? 'bg-amber-50 border-amber-300 shadow-sm' : 'bg-white border-gray-100'
                  }`}
                >
                  <button
                    onClick={() => onOrderClick(order)}
                    className="w-full text-left active:scale-[0.98] transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-800">{order.store.name}</p>
                        <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {isActive && order.status === 'pending' && (
                          <span className="text-[10px] font-bold text-white bg-amber-500 px-2 py-0.5 rounded-full">BAGO</span>
                        )}
                        {groupNeedsReview && (
                          <span className="text-[10px] font-bold text-white bg-amber-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Star size={10} className="fill-white" /> KUMUSTA ANG EXPERIENCE MO? MAG-IWAN NG REVIEW
                          </span>
                        )}
                        <span className={`text-xs px-2 py-1 rounded-full border ${ORDER_STATUS_COLORS[order.status]}`}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">₱{(Number(order.total) + Number(order.delivery_fee)).toFixed(0)}</span>
                        {order.rider_id && order.status === 'picked_up' && (
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Bike size={10} /> Paparating na
                          </span>
                        )}
                      </div>
                      <ChevronRight size={18} className="text-gray-300" />
                    </div>
                  </button>
                  {canDelete && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm('Itago ang order na ito sa listahan mo? Hindi ito mabubura sa ibang tao.')) return;
                        await supabase.from('orders').update({ hidden_by_buyer_at: new Date().toISOString() }).eq('id', order.id);
                        loadOrders();
                      }}
                      className="mt-2 w-full py-2 text-xs font-medium text-red-500 bg-red-50 rounded-lg active:scale-[0.98] transition flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={13} /> Itago
                    </button>
                  )}
                </div>
              );
            }

            // Multi-store grouped card
            const canDeleteMulti = !isActive && !groupNeedsReview;
            return (
              <div
                key={group.key}
                className={`w-full rounded-2xl border p-4 ${
                  isActive ? 'bg-red-50 border-red-300 shadow-sm' : groupNeedsReview ? 'bg-amber-50 border-amber-300 shadow-sm' : 'bg-white border-gray-100'
                }`}
              >
                <button
                  onClick={() => onOrderClick(firstOrder)}
                  className="w-full text-left active:scale-[0.98] transition"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-white bg-brand-500 px-2 py-0.5 rounded-full">MULTI-STORE</span>
                        <span className="text-xs text-gray-400">{group.orders.length} tindahan</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {group.orders.map((o, i) => (
                          <span key={o.id} className="text-xs text-gray-600 font-medium">
                            {o.store.name}{i < group.orders.length - 1 ? ',' : ''}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{new Date(firstOrder.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {isActive && displayStatus === 'pending' && (
                        <span className="text-[10px] font-bold text-white bg-amber-500 px-2 py-0.5 rounded-full">BAGO</span>
                      )}
                      {groupNeedsReview && (
                        <span className="text-[10px] font-bold text-white bg-amber-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Star size={10} className="fill-white" /> KUMUSTA ANG EXPERIENCE MO? MAG-IWAN NG REVIEW
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full border ${ORDER_STATUS_COLORS[displayStatus]}`}>
                        {ORDER_STATUS_LABELS[displayStatus]}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">₱{totalAmount.toFixed(0)}</span>
                      {anyRiderPickedUp && (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Bike size={10} /> Paparating na
                        </span>
                      )}
                    </div>
                    <ChevronRight size={18} className="text-gray-300" />
                  </div>
                </button>
                {canDeleteMulti && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm('Itago ang mga order na ito sa listahan mo? Hindi ito mabubura sa ibang tao.')) return;
                      await Promise.all(group.orders.map(o => supabase.from('orders').update({ hidden_by_buyer_at: new Date().toISOString() }).eq('id', o.id)));
                      loadOrders();
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

// ============= ORDER DETAIL VIEW =============
function OrderDetailView({ order, onBack, onOpenChat }: { order: Order; onBack: () => void; onOpenChat: (orderId: string, buyerId: string, type: 'buyer_seller' | 'buyer_rider', partnerName: string, partnerRole: string, sellerId?: string | null, riderId?: string | null) => void }) {
  const { profile } = useAuth();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [rider, setRider] = useState<{ full_name: string; phone: string | null; avatar_url: string | null; rider_qr_code_url: string | null } | null>(null);
  const [currentOrder, setCurrentOrder] = useState(order);
  const [paymentRef, setPaymentRef] = useState(order.payment_reference || '');
  const [submitting, setSubmitting] = useState(false);
  const [siblingOrders, setSiblingOrders] = useState<(Order & { store: Store })[]>([]);
  const [showRiderProfile, setShowRiderProfile] = useState(false);

  useEffect(() => {
    supabase.from('order_items').select('*').eq('order_id', order.id).then(({ data }) => setItems(data || []));
    supabase.from('stores').select('*').eq('id', order.store_id).maybeSingle().then(({ data }) => setStore(data as Store | null));
    if (order.rider_id) {
      supabase.from('profiles').select('full_name, phone, avatar_url, rider_qr_code_url').eq('id', order.rider_id).maybeSingle().then(({ data }) => setRider(data as any));
    }

    if (order.delivery_group_id) {
      supabase.from('orders').select('*, store:stores(*)').eq('delivery_group_id', order.delivery_group_id).neq('id', order.id)
        .then(({ data }) => { setSiblingOrders((data || []) as any); });
    }

    const sub = supabase.channel(`order-${order.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` }, (payload: any) => {
        if (payload.new) setCurrentOrder(payload.new as Order);
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [order.id, order.delivery_group_id]);

  const isBuyer = profile?.id === currentOrder.buyer_id;
  const isCancelled = currentOrder.status === 'cancelled';
  const isDelivered = currentOrder.status === 'delivered';

  const isCod = currentOrder.payment_method === 'cod';

  // Build buyer-side step list — COD skips the "Nabayaran na" step (payment happens at delivery)
  const buyerSteps: StepInfo[] = isCod ? [
    { key: 'placed', label: 'Na-order na', description: 'Nai-submit na ang order mo. Naghihintay ng confirmation mula sa seller na available ang mga paninda.', status: 'completed' },
    { key: 'confirmed', label: 'Na-confirm ng seller', description: 'Na-confirm na ng seller! Available ang mga paninda. Maghanda ka na ng cash para sa rider pagdating.', status: 'completed' },
    { key: 'preparing', label: 'Inihahanda ng seller', description: 'Inihahanda na ng seller ang order mo. Hintayin lang ang rider na ma-assign at mag-pick up.', status: 'completed' },
    { key: 'on_the_way', label: 'On the way na!', description: 'Nakuha na ng rider ang parcel at papunta na sa iyo. Makikita mo ang live location sa mapa sa baba.', status: 'completed' },
    { key: 'delivered', label: 'Na-deliver na!', description: 'Na-deliver na ang order mo sa iyo. Magbayad sa rider ng ₱' + (Number(currentOrder.total) + Number(currentOrder.delivery_fee)).toFixed(2) + '. Salamat!', status: 'completed' },
  ] : [
    { key: 'placed', label: 'Na-order na', description: 'Nai-submit na ang order mo. Naghihintay ng confirmation mula sa seller na available ang mga paninda.', status: 'completed' },
    { key: 'confirmed', label: 'Na-confirm ng seller', description: 'Na-confirm na ng seller! Available ang mga paninda. Pwede ka na magbayad.', status: 'completed' },
    { key: 'paid', label: 'Nabayaran na', description: 'Nabayaran na ang order! Inihahanda na ng seller ang mga paninda. Magko-contact na ng rider.', status: 'completed' },
    { key: 'preparing', label: 'Inihahanda ng seller', description: 'Inihahanda na ng seller ang order mo. Hintayin lang ang rider na ma-assign at mag-pick up.', status: 'completed' },
    { key: 'on_the_way', label: 'On the way na!', description: 'Nakuha na ng rider ang parcel at papunta na sa iyo. Makikita mo ang live location sa mapa sa baba.', status: 'completed' },
    { key: 'delivered', label: 'Na-deliver na!', description: 'Na-deliver na ang order mo sa iyo. Salamat! Pwede mo na i-review ang seller at rider.', status: 'completed' },
  ];

  // Map order status to step index
  let currentStepIndex = 0;
  if (isCod) {
    if (currentOrder.status === 'pending') currentStepIndex = 0;
    else if (currentOrder.status === 'accepted') currentStepIndex = 1;
    else if (currentOrder.status === 'preparing' || currentOrder.status === 'ready_for_pickup') currentStepIndex = 2;
    else if (currentOrder.status === 'picked_up') currentStepIndex = 3;
    else if (currentOrder.status === 'delivered') currentStepIndex = 4;
  } else {
    if (currentOrder.status === 'pending') currentStepIndex = 0;
    else if (currentOrder.status === 'accepted') {
      if (currentOrder.payment_status !== 'paid') currentStepIndex = 1;
      else currentStepIndex = 2;
    }
    else if (currentOrder.status === 'preparing' || currentOrder.status === 'ready_for_pickup') currentStepIndex = 3;
    else if (currentOrder.status === 'picked_up') currentStepIndex = 4;
    else if (currentOrder.status === 'delivered') currentStepIndex = 5;
  }

  // Mark steps
  buyerSteps.forEach((s, i) => {
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
                Ipapa-deliver sa {new Date(currentOrder.scheduled_delivery_at).toLocaleString('en-PH', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
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
                  ? 'Sunduin ang order sa tindahan ng seller. Walang rider delivery para sa buhay na hayop.'
                  : 'Magkasundong lugar kayo ng seller para sa pagpapalit. Walang rider delivery para sa buhay na hayop.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Step Tracker */}
      {!isCancelled && (
        <div className="mb-3">
          <OrderStepTracker steps={buyerSteps} currentStepIndex={currentStepIndex} />
        </div>
      )}
      {isCancelled && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-3 text-center">
          <p className="text-sm font-semibold text-red-700">Nakansela ang order na ito.</p>
        </div>
      )}

      {/* Active step action area */}
      {!isCancelled && !isDelivered && currentStepIndex === 1 && currentOrder.payment_method === 'qr_code' && currentOrder.payment_status !== 'paid' && store?.qr_code_url && (
        <div className="bg-white rounded-2xl border-2 border-brand-200 p-4 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <QrCode size={18} className="text-brand-600" />
            <span className="font-semibold text-sm text-gray-800">Magbayad gamit ang QR Code</span>
          </div>
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl mb-2">
            <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">1</div>
            <div>
              <p className="text-sm font-medium text-blue-900">I-scan ang QR code</p>
              <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">Buksan ang GCash o Maya app, piliin ang "Scan QR", at i-scan ang QR code sa baba.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl mb-2">
            <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
            <div>
              <p className="text-sm font-medium text-amber-900">Isang phone lang ang gamit?</p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">I-download ang QR code image, buksan ang GCash app, piliin ang "Upload QR" o "Import QR", at i-upload ang na-download na image.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl mb-4">
            <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
            <div>
              <p className="text-sm font-medium text-green-900">Ilagay ang tamang halaga</p>
              <p className="text-xs text-green-700 mt-0.5 leading-relaxed">Bayaran ang <strong>₱{(Number(currentOrder.total) + Number(currentOrder.delivery_fee)).toFixed(2)}</strong> na kabuuang halaga (kasama ang delivery fee).</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 flex justify-center">
            <img src={store.qr_code_url} alt="QR Code ng Seller" loading="lazy" decoding="async" className="w-48 h-48 rounded-xl object-contain" />
          </div>
          <button
            onClick={async () => {
              try {
                const response = await fetch(store.qr_code_url!);
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `qr-code-${store.name.replace(/\s+/g, '-').toLowerCase()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch {
                window.open(store.qr_code_url!, '_blank');
              }
            }}
            className="w-full mt-3 py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <Download size={18} /> I-download ang QR Code
          </button>
          <div className="mt-4">
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Payment Reference Number</label>
            <p className="text-xs text-gray-400 mb-2 leading-relaxed">Pagkatapos magbayad sa GCash/Maya, may makikita kang reference o transaction ID. Ilagay ito bilang proof ng payment mo.</p>
            <input
              type="text"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="Hal. 1234567890 o Gcash Ref#"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500 transition mb-3"
            />
            <button
              onClick={async () => {
                setSubmitting(true);
                await supabase.from('orders').update({
                  payment_status: 'paid',
                  payment_reference: paymentRef.trim() || null,
                }).eq('id', currentOrder.id);
                setCurrentOrder(prev => ({ ...prev, payment_status: 'paid', payment_reference: paymentRef.trim() || null }));
                setSubmitting(false);
              }}
              disabled={submitting}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-lg shadow-green-600/20 disabled:opacity-50"
            >
              <Check size={18} /> {submitting ? 'Nagse-send...' : 'Naka-bayad na Ako'}
            </button>
          </div>
        </div>
      )}

      {/* QR code not uploaded by seller */}
      {!isCancelled && currentStepIndex === 1 && currentOrder.payment_method === 'qr_code' && currentOrder.payment_status !== 'paid' && !store?.qr_code_url && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3 flex items-center gap-2">
          <ImageOff size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700">Hindi pa nag-upload ang seller ng QR code. Makipag-ugnayan sa seller via chat.</p>
        </div>
      )}

      {/* COD note for buyer when confirmed */}
      {!isCancelled && currentOrder.payment_method === 'cod' && currentOrder.status === 'accepted' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3 flex items-center gap-2">
          <Package size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700">Cash on Delivery — maghanda ng <strong>₱{(Number(currentOrder.total) + Number(currentOrder.delivery_fee)).toFixed(2)}</strong> para sa rider pagdating.</p>
        </div>
      )}

      {/* Live ETA Timer — shown when rider is on the way (pickup or delivery); hidden for livestock */}
      {(currentOrder.status === 'ready_for_pickup' || currentOrder.status === 'picked_up') && currentOrder.rider_lat != null && currentOrder.rider_lng != null && currentOrder.delivery_method !== 'pickup' && currentOrder.delivery_method !== 'meetup' && store && (
        <LiveETATimer
          riderCoords={{ lat: currentOrder.rider_lat, lng: currentOrder.rider_lng }}
          buyerCoords={currentOrder.status === 'ready_for_pickup'
            ? getStoreCoords(store)
            : getDeliveryCoords({
                lat: currentOrder.delivery_lat,
                lng: currentOrder.delivery_lng,
                barangay: currentOrder.delivery_barangay,
                city: currentOrder.delivery_city,
                region: currentOrder.delivery_region,
              })}
          riderName={rider?.full_name || 'Rider'}
          variant="buyer"
          gpsActive
        />
      )}

      {/* Live Tracking Map — shown when rider is on the way (to store or to buyer) */}
      {(currentOrder.status === 'ready_for_pickup' || currentOrder.status === 'picked_up') && currentOrder.rider_lat != null && currentOrder.rider_lng != null && store && (
        <BuyerLiveTrackingMap
          riderLat={currentOrder.rider_lat}
          riderLng={currentOrder.rider_lng}
          riderName={rider?.full_name || 'Rider'}
          storeCoords={getStoreCoords(store)}
          deliveryCoords={getDeliveryCoords({
            lat: currentOrder.delivery_lat,
            lng: currentOrder.delivery_lng,
            barangay: currentOrder.delivery_barangay,
            city: currentOrder.delivery_city,
            region: currentOrder.delivery_region,
          })}
          deliveryAddress={currentOrder.delivery_address || `${currentOrder.delivery_barangay} ${currentOrder.delivery_city} ${currentOrder.delivery_region}`}
          pickedUpAt={currentOrder.picked_up_at}
          sameCity={store?.city === currentOrder.delivery_city}
          phase={currentOrder.status === 'ready_for_pickup' ? 'to_store' : 'to_buyer'}
        />
      )}
      {currentOrder.status === 'picked_up' && (currentOrder.rider_lat == null || currentOrder.rider_lng == null) && (
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
              <Bike size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-800">Paparating na ang rider!</p>
              <p className="text-xs text-blue-600">Nasa daan na ang rider papunta sa iyo. Makikita ang live location dito pag nagsimula na ang rider.</p>
            </div>
          </div>
        </div>
      )}
      {currentOrder.status === 'ready_for_pickup' && currentOrder.rider_id && (currentOrder.rider_lat == null || currentOrder.rider_lng == null) && (
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
              <Bike size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-800">Nasa daan na ang rider papunta sa store!</p>
              <p className="text-xs text-blue-600">Tinuloy na ng rider ang pagpunta sa store para kunin ang order mo. Makikita ang live location dito pag nagsimula na ang rider.</p>
            </div>
          </div>
        </div>
      )}

      {/* COD: Rider QR code for buyer to pay full amount — shown when rider has picked up */}
      {!isCancelled && currentOrder.status === 'picked_up' && currentOrder.payment_method === 'cod' && rider?.rider_qr_code_url && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <QrCode size={18} className="text-blue-600" />
            <span className="font-semibold text-sm text-blue-800">Magbayad sa Rider</span>
          </div>
          <p className="text-xs text-blue-700 mb-3 leading-relaxed">
            Pwede mong bayaran ang buong halaga na <strong>₱{(Number(currentOrder.total) + Number(currentOrder.delivery_fee)).toFixed(2)}</strong> (paninda + delivery fee) sa rider gamit ang QR code, o maghanda ng cash pagdating niya.
          </p>
          <div className="bg-white rounded-xl p-3 flex justify-center mb-2">
            <img src={rider.rider_qr_code_url} alt="QR Code ng Rider" loading="lazy" decoding="async" className="w-40 h-40 rounded-xl object-contain" />
          </div>
          <button
            onClick={async () => {
              try {
                const response = await fetch(rider.rider_qr_code_url!);
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `rider-qr-${rider.full_name.replace(/\\s+/g, '-').toLowerCase()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch {
                window.open(rider.rider_qr_code_url!, '_blank');
              }
            }}
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <Download size={16} /> I-download ang QR Code
          </button>
        </div>
      )}
      {!isCancelled && currentOrder.status === 'picked_up' && currentOrder.payment_method === 'cod' && rider && !rider.rider_qr_code_url && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3 flex items-center gap-2">
          <Package size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700">Maghanda ng <strong>₱{(Number(currentOrder.total) + Number(currentOrder.delivery_fee)).toFixed(2)}</strong> cash (paninda + delivery fee) para sa rider pagdating.</p>
        </div>
      )}

      {/* Store info */}
      {store && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <StoreIcon size={16} className="text-gray-500" />
            <span className="font-semibold text-gray-800">{store.name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <MapPin size={14} />
            <span>{store.barangay}, {store.city}, {formatRegionForDisplay(store.region)}</span>
          </div>
          {store.palengke_name && (
            <div className="flex items-center gap-2 text-sm text-brand-600 mt-2">
              <MapPin size={14} />
              <span>Pwesto sa <strong>{store.palengke_name}</strong></span>
            </div>
          )}
          {isBuyer && !isCancelled && (
            <button
              onClick={() => onOpenChat(currentOrder.id, currentOrder.buyer_id, 'buyer_seller', store.name, 'Seller', store.seller_id, null)}
              className="w-full mt-3 py-2.5 bg-brand-50 text-brand-700 rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition border border-brand-100"
            >
              <MessageCircle size={16} /> Chat with Seller
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

      {/* Rider info */}
      {rider && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Bike size={16} className="text-blue-500" />
            <span className="font-semibold text-gray-800">Rider</span>
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowRiderProfile(true)}
              className="flex items-center gap-2 active:scale-95 transition"
            >
              <Avatar src={rider.avatar_url} name={rider.full_name} size={36} />
              <div className="text-left">
                <span className="text-sm text-gray-600 block">{rider.full_name}</span>
                <span className="text-xs text-blue-600 flex items-center gap-0.5">
                  <Star size={10} className="fill-amber-400 text-amber-400" /> Tingnan ang profile at reviews
                </span>
              </div>
            </button>
            <a href={`tel:${rider.phone}`} className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
              <Phone size={16} className="text-blue-600" />
            </a>
          </div>
          {isBuyer && !isCancelled && !isDelivered && (
            <button
              onClick={() => onOpenChat(currentOrder.id, currentOrder.buyer_id, 'buyer_rider', rider.full_name, 'Rider', null, currentOrder.rider_id)}
              className="w-full mt-3 py-2.5 bg-blue-50 text-blue-700 rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition border border-blue-100"
            >
              <MessageCircle size={16} /> Chat with Rider
            </button>
          )}
        </div>
      )}

      {/* Rider Profile Modal */}
      {showRiderProfile && rider && currentOrder.rider_id && (
        <RiderProfileModal
          riderId={currentOrder.rider_id}
          riderName={rider.full_name}
          riderAvatar={rider.avatar_url}
          riderPhone={rider.phone}
          onClose={() => setShowRiderProfile(false)}
        />
      )}

      {/* Delivery Address */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Navigation size={16} className="text-brand-600" />
          <span className="font-semibold text-gray-800">Delivery Address</span>
        </div>
        <p className="text-sm text-gray-600">{currentOrder.delivery_address}</p>
        <p className="text-sm text-gray-400">{currentOrder.delivery_barangay}, {currentOrder.delivery_city}, {formatRegionForDisplay(currentOrder.delivery_region)}</p>
      </div>

      {/* Sibling stores in the same delivery group */}
      {siblingOrders.length > 0 && (
        <div className="bg-white rounded-2xl border border-brand-200 p-4 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <StoreIcon size={16} className="text-brand-600" />
            <span className="font-semibold text-gray-800 text-sm">Ibang tindahan sa order na ito</span>
            <span className="text-[10px] font-bold text-white bg-brand-500 px-2 py-0.5 rounded-full">MULTI-STORE</span>
          </div>
          {siblingOrders.map(sib => {
            const sibAmount = sib.total + sib.delivery_fee;
            const isPaid = sib.payment_status === 'paid';
            return (
              <div key={sib.id} className="flex items-center justify-between py-2 border-t border-gray-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <StoreIcon size={14} className="text-brand-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{sib.store.name}</p>
                    <p className="text-xs text-gray-400">₱{sibAmount.toFixed(0)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {sib.payment_method === 'qr_code' && sib.store.qr_code_url && !isPaid && (
                    <a href={sib.store.qr_code_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 font-medium">
                      <QrCode size={16} className="inline" /> QR
                    </a>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-full border ${ORDER_STATUS_COLORS[sib.status]}`}>
                    {ORDER_STATUS_LABELS[sib.status]}
                  </span>
                  {isPaid ? (
                    <span className="text-xs text-green-600 font-medium">Paid</span>
                  ) : (
                    <span className="text-xs text-amber-600 font-medium">Pending</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Leave a Review - only for delivered orders; for COD, only after seller accepts payment */}
      {isBuyer && isDelivered && (!isCod || !!currentOrder.cod_payment_accepted_at) && (
        <ReviewSectionForOrder
          orderId={currentOrder.id}
          store={store}
          rider={rider}
          riderId={currentOrder.rider_id}
          sellerId={store?.seller_id || null}
        />
      )}

      {/* COD: waiting for seller to confirm payment before review */}
      {isBuyer && isDelivered && isCod && !currentOrder.cod_payment_accepted_at && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3 flex items-center gap-2">
          <Clock size={18} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700">Naghihintay na tanggapin ng seller ang COD payment mula sa rider bago makapag-review.</p>
        </div>
      )}

      {/* Cancel button if pending */}
      {isBuyer && currentOrder.status === 'pending' && (
        <button
          onClick={async () => {
            await supabase.from('orders').update({ status: 'cancelled' }).eq('id', currentOrder.id);
            onBack();
          }}
          className="w-full py-3 bg-white text-red-500 border border-red-200 rounded-2xl font-semibold active:scale-[0.98] transition"
        >
          Kanselahin ang Order
        </button>
      )}
    </div>
  );
}

// ============= SHARE STORE CARD =============
function ShareStoreCard({ storeName, storeSlug }: { storeName: string; storeSlug: string }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/s/${storeSlug}`;
  const shareText = `Maganda ang experience ko sa ${storeName} dito sa GoPalengke! Sariwa ang paninda at mabilis ang delivery — diretso sa bahay galing palengke. Suportahan natin ang lokal na tindera at tindero. Subukan mo rin: ${shareUrl}`;
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="bg-gradient-to-br from-brand-50 to-amber-50 rounded-2xl border border-brand-200 p-4 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Share2 size={18} className="text-brand-600" />
        <p className="font-bold text-sm text-gray-800">Naging maganda ba ang pamimili mo?</p>
      </div>
      <p className="text-xs text-gray-600 mb-3 leading-relaxed">
        Opsyonal lang ito — pero malaking tulong kay <strong>{storeName}</strong> kung i-share mo sa Facebook o Messenger. Mas maraming makakakita, mas dumadami ang suki ng ating lokal na palengke.
      </p>
      <div className="bg-white/70 border border-brand-100 rounded-xl p-3 mb-3">
        <p className="text-[11px] text-gray-500 italic leading-relaxed">"{shareText}"</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 py-3 bg-[#1877F2] text-white rounded-xl font-semibold text-xs active:scale-95 transition"
        >
          <Facebook size={20} />
          Facebook
        </a>
        <button type="button"
          onClick={() => shareToMessenger(shareUrl)}
          className="flex flex-col items-center gap-1 py-3 bg-gradient-to-br from-[#00B2FF] to-[#006AFF] text-white rounded-xl font-semibold text-xs active:scale-95 transition"
        >
          <MessageCircle size={20} />
          Messenger
        </button>
        <button
          onClick={copyLink}
          className="flex flex-col items-center gap-1 py-3 bg-gray-700 text-white rounded-xl font-semibold text-xs active:scale-95 transition"
        >
          {copied ? <Check size={20} /> : <Copy size={20} />}
          {copied ? 'Nakopya!' : 'Kopyahin'}
        </button>
      </div>
    </div>
  );
}

// ============= RIDER PROFILE MODAL =============
function RiderProfileModal({ riderId, riderName, riderAvatar, riderPhone, onClose }: {
  riderId: string;
  riderName: string;
  riderAvatar: string | null;
  riderPhone: string | null;
  onClose: () => void;
}) {
  const [riderProfile, setRiderProfile] = useState<{
    full_name: string; phone: string | null; avatar_url: string | null;
    barangay: string | null; city: string | null; region: string | null;
    complete_address: string | null; is_available: boolean;
    rider_age: number | null; rider_family_status: string | null;
    rider_residence_address: string | null; rider_plate_number: string | null;
    rider_motor_model: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('profiles').select('full_name, phone, avatar_url, barangay, city, region, complete_address, is_available, rider_age, rider_family_status, rider_residence_address, rider_plate_number, rider_motor_model').eq('id', riderId).maybeSingle()
      .then(({ data }) => { setRiderProfile(data as any); setLoading(false); });
  }, [riderId]);

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end max-w-md mx-auto animate-fade-in" onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl max-h-[85vh] overflow-y-auto animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between border-b border-gray-100 z-10">
          <h2 className="text-lg font-bold text-gray-800">Profile ng Rider</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : riderProfile ? (
          <div className="px-5 py-4 pb-8">
            {/* Rider header */}
            <div className="flex flex-col items-center mb-4">
              <Avatar src={riderProfile.avatar_url} name={riderProfile.full_name} size={80} />
              <h3 className="font-bold text-gray-800 text-lg mt-3">{riderProfile.full_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${riderProfile.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {riderProfile.is_available ? 'Available' : 'Offline'}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-0.5">
                  <Bike size={12} /> Rider
                </span>
              </div>
              {(riderProfile.barangay || riderProfile.city) && (
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <MapPin size={12} /> {riderProfile.barangay}, {riderProfile.city}, {formatRegionForDisplay(riderProfile.region)}
                </p>
              )}
              {riderPhone && (
                <a href={`tel:${riderPhone}`} className="mt-3 w-full py-2.5 bg-blue-50 text-blue-700 rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:scale-95 transition border border-blue-100">
                  <Phone size={16} /> Tumawag sa Rider
                </a>
              )}
            </div>

            {/* Rider Details */}
            <div className="bg-gray-50 rounded-2xl p-4 mb-3">
              <h4 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
                <UserRound size={16} className="text-brand-600" /> Detalye ng Rider
              </h4>
              <div className="space-y-2.5">
                {riderProfile.rider_age != null && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 w-28 flex-shrink-0">Edad</span>
                    <span className="text-gray-700 font-medium">{riderProfile.rider_age} taong gulang</span>
                  </div>
                )}
                {riderProfile.rider_family_status && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 w-28 flex-shrink-0">Pamilya</span>
                    <span className="text-gray-700 font-medium">{riderProfile.rider_family_status}</span>
                  </div>
                )}
                {riderProfile.rider_residence_address && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-gray-400 w-28 flex-shrink-0">Totoong Address</span>
                    <span className="text-gray-700 font-medium">{riderProfile.rider_residence_address}</span>
                  </div>
                )}
                {riderProfile.complete_address && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-gray-400 w-28 flex-shrink-0">Kumpletong Address</span>
                    <span className="text-gray-700 font-medium">{riderProfile.complete_address}</span>
                  </div>
                )}
                {riderProfile.rider_plate_number && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 w-28 flex-shrink-0">Plate Number</span>
                    <span className="text-gray-700 font-medium">{riderProfile.rider_plate_number}</span>
                  </div>
                )}
                {riderProfile.rider_motor_model && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 w-28 flex-shrink-0">Model ng Motor</span>
                    <span className="text-gray-700 font-medium">{riderProfile.rider_motor_model}</span>
                  </div>
                )}
                {riderPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 w-28 flex-shrink-0">Telepono</span>
                    <span className="text-gray-700 font-medium">{riderPhone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Rider Reviews */}
            <div className="bg-gray-50 rounded-2xl p-4">
              <h4 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
                <Star size={16} className="text-amber-500" /> Mga Review mula sa mga naunaang transaksyon
              </h4>
              <ReviewSection userId={riderId} />
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">Hindi mahanap ang profile ng rider.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============= REVIEW SECTION FOR ORDER =============
function ReviewSectionForOrder({
  orderId,
  store,
  rider,
  riderId,
  sellerId,
}: {
  orderId: string;
  store: Store | null;
  rider: { full_name: string; phone: string | null; avatar_url: string | null } | null;
  riderId: string | null;
  sellerId: string | null;
}) {
  const [existingReviews, setExistingReviews] = useState<{ review_type: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('reviews').select('review_type').eq('order_id', orderId).then(({ data }) => {
      setExistingReviews(data || []);
      setLoading(false);
    });
  }, [orderId]);

  if (loading) return null;

  const hasSellerReview = existingReviews.some(r => r.review_type === 'seller');
  const hasRiderReview = existingReviews.some(r => r.review_type === 'rider');

  return (
    <div>
      <h3 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
        <Star size={18} className="text-amber-500" /> Mag-iwan ng Review
      </h3>

      {/* Seller Review Form */}
      {sellerId && !hasSellerReview && store && (
        <ReviewForm
          orderId={orderId}
          revieweeId={sellerId}
          reviewType="seller"
          revieweeName={store.name}
          storeSlug={store.slug}
          onSubmitted={() => setExistingReviews(prev => [...prev, { review_type: 'seller' }])}
        />
      )}

      {/* Rider Review Form */}
      {riderId && !hasRiderReview && rider && (
        <ReviewForm
          orderId={orderId}
          revieweeId={riderId}
          reviewType="rider"
          revieweeName={rider.full_name}
          onSubmitted={() => setExistingReviews(prev => [...prev, { review_type: 'rider' }])}
        />
      )}

      {/* Already reviewed */}
      {hasSellerReview && hasRiderReview && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-2 mb-3">
          <Check size={18} className="text-green-600" />
          <p className="text-sm text-green-700 font-medium">Salamat! Nai-review mo na ang seller at rider para sa order na ito.</p>
        </div>
      )}
      {hasSellerReview && !hasRiderReview && !riderId && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-2 mb-3">
          <Check size={18} className="text-green-600" />
          <p className="text-sm text-green-700 font-medium">Salamat sa pag-review ng seller!</p>
        </div>
      )}

      {/* Share store after reviewing */}
      {hasSellerReview && store?.slug && (
        <ShareStoreCard storeName={store.name} storeSlug={store.slug} />
      )}
    </div>
  );
}

// ============= MESSAGES VIEW =============
function MessagesView({ onOpenChat, adminConversations, onOpenAdminChat }: { onOpenChat: (convId: string, name: string, role: string) => void; adminConversations: AdminConversation[]; onOpenAdminChat: (convId: string, name: string) => void }) {
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
        .eq('buyer_id', userId)
        .order('updated_at', { ascending: false });
      if (!convs) { setLoading(false); return; }

      const enriched = await Promise.all((convs as Conversation[]).map(async (conv) => {
        let otherName = 'Unknown';
        let otherRole = '';
        if (conv.type === 'buyer_seller') {
          const { data: store } = await supabase
            .from('stores')
            .select('name')
            .eq('seller_id', conv.seller_id)
            .maybeSingle();
          otherName = store?.name || 'Seller';
          otherRole = 'Seller';
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
    const sub = supabase.channel('buyer-messages-list')
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
    const sub = supabase.channel('buyer-admin-msgs')
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
          <p className="text-sm">Wala pang messages. Mag-order muna para makapag-chat!</p>
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

// ============= PROFILE VIEW =============
function ProfileView({ onSignOut }: { onSignOut: () => void }) {
  const { profile, refreshProfile } = useAuth();
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [housePhotoUploading, setHousePhotoUploading] = useState(false);
  const [location, setLocation] = useState<LocationData>({
    barangay: profile?.barangay || '',
    district: profile?.district || '',
    city: profile?.city || '',
    region: profile?.region || 'NCR',
  });
  const [saving, setSaving] = useState(false);
  const [completeAddress, setCompleteAddress] = useState(profile?.complete_address || '');
  const [savingAddress, setSavingAddress] = useState(false);

  async function saveLocation() {
    if (!profile) return;
    setSaving(true);
    await supabase.from('profiles').update({
      barangay: location.barangay,
      district: location.district || null,
      city: location.city,
      region: location.region,
    }).eq('id', profile.id);
    setSaving(false);
    setShowLocationModal(false);
  }

  async function saveCompleteAddress() {
    if (!profile) return;
    setSavingAddress(true);
    await supabase.from('profiles').update({
      complete_address: completeAddress || null,
    }).eq('id', profile.id);
    await refreshProfile();
    setSavingAddress(false);
  }

  return (
    <div className="px-5 py-4 pb-40">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Profile ko</h2>
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <Avatar src={profile?.avatar_url} name={profile?.full_name} size={64} />
          <div>
            <p className="font-bold text-gray-800 text-lg">{profile?.full_name}</p>
            <p className="text-sm text-gray-400">{profile?.email}</p>
            <span className="inline-block mt-1 text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">Mamimili</span>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          {profile?.phone && (
            <div className="flex items-center gap-2 text-gray-600"><Phone size={16} /><span>{profile.phone}</span></div>
          )}
          <div className="flex items-center gap-2 text-gray-600"><MapPin size={16} /><span>{profile?.barangay}, {profile?.city}, {formatRegionForDisplay(profile?.region)}</span></div>
        </div>
      </div>

      {/* Profile Picture Upload */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <ImageUploadField
          label="Profile Picture"
          value={profile?.avatar_url || ''}
          bucket="profile-images"
          folder={`avatars/${profile?.id}`}
          aspectClass="aspect-square w-full max-w-40"
          cropAspect={1}
          hint="Mag-upload ng larawan para makilala ka ng seller at rider. Para sa transparency ng transaction."
          onChange={async (url) => {
            if (!profile) return;
            setAvatarUploading(true);
            await supabase.from('profiles').update({ avatar_url: url || null }).eq('id', profile.id);
            await refreshProfile();
            setAvatarUploading(false);
          }}
        />
        {avatarUploading && <p className="text-xs text-brand-500 mt-1">Nag-a-upload...</p>}
      </div>

      {/* House Photo Upload — required for delivery */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Home size={18} className="text-brand-600" />
          <h3 className="font-semibold text-sm text-gray-800">Larawan ng Bahay (Required)</h3>
        </div>
        <p className="text-xs text-gray-400 mb-3 leading-relaxed">
          Mag-upload ng larawan ng labas ng bahay na makikita ang pinto o gate. Para makilala ng rider kung aling bahay ang pupuntahan niya.
        </p>
        <ImageUploadField
          label=""
          value={profile?.house_photo_url || ''}
          bucket="profile-images"
          folder={`houses/${profile?.id}`}
          aspectClass="aspect-[4/3] w-full max-w-md"
          cropAspect={4 / 3}
          hint="Kailangan makita ang pinto o gate ng bahay."
          onChange={async (url) => {
            if (!profile) return;
            setHousePhotoUploading(true);
            await supabase.from('profiles').update({ house_photo_url: url || null }).eq('id', profile.id);
            await refreshProfile();
            setHousePhotoUploading(false);
          }}
        />
        {housePhotoUploading && <p className="text-xs text-brand-500 mt-1">Nag-a-upload...</p>}
        {profile?.house_photo_url && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600">
            <CheckCircle size={14} />
            <span>Na-upload na ang larawan ng bahay</span>
          </div>
        )}
      </div>

      <button
        onClick={() => setShowLocationModal(true)}
        className="w-full bg-white rounded-2xl border border-gray-100 p-4 mb-2 flex items-center justify-between active:scale-[0.98] transition"
      >
        <div className="flex items-center gap-3">
          <MapPin size={20} className="text-brand-600" />
          <span className="font-medium text-gray-700">Palitan ang Location</span>
        </div>
        <ChevronRight size={18} className="text-gray-300" />
      </button>

      {/* Complete Address */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 mt-2">
        <div className="flex items-center gap-2 mb-1">
          <Home size={18} className="text-brand-600" />
          <h3 className="font-semibold text-sm text-gray-800">Buong Address ng Bahay</h3>
        </div>
        <p className="text-xs text-gray-400 mb-3 leading-relaxed">
          I-type ang buong address ng bahay mo (hal. Blk 3 Lot 12, Phase 2, Subdivision). Makikita ito ng rider kasama ang barangay, city, at region.
        </p>
        <textarea
          value={completeAddress}
          onChange={(e) => setCompleteAddress(e.target.value)}
          placeholder="Hal. Blk 3 Lot 12, Phase 2, Subdivision, malapit sa gate"
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition text-sm resize-none"
        />
        <button
          onClick={saveCompleteAddress}
          disabled={savingAddress}
          className="w-full mt-3 py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {savingAddress ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Nagsasave...
            </>
          ) : (
            <>
              <Check size={16} />
              I-save ang Address
            </>
          )}
        </button>
        {profile?.complete_address && (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-green-600">
            <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>Nai-save na: {profile.complete_address}</span>
          </div>
        )}
      </div>

      {/* Video Call Credits */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 mt-2">
        <VideoCreditStore />
      </div>

      {/* Shareable Profile URL */}
      {profile?.slug && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-2">
          <div className="flex items-center gap-2 mb-2">
            <Share2 size={18} className="text-brand-600" />
            <span className="font-medium text-sm text-gray-700">Link ng Profile</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-500 truncate border border-gray-100">
              {window.location.origin}{window.location.pathname}#/u/{profile.slug}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#/u/${profile.slug}`);
              }}
              className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center active:scale-95 transition flex-shrink-0"
            >
              <Copy size={16} className="text-brand-600" />
            </button>
            <button
              onClick={() => navigate(`/u/${profile.slug}`)}
              className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center active:scale-95 transition flex-shrink-0"
            >
              <ExternalLink size={16} className="text-brand-600" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={onSignOut}
        className="w-full py-3 bg-white text-red-500 border border-red-200 rounded-2xl font-semibold active:scale-[0.98] transition mt-4"
      >
        Mag-sign Out
      </button>

      {showLocationModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end max-w-md mx-auto animate-fade-in">
          <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Palitan ang Location</h2>
              <button onClick={() => setShowLocationModal(false)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={20} className="text-gray-600" />
              </button>
            </div>
            <div className="px-5 py-4 pb-8">
              <LocationSelector
                value={location}
                onChange={setLocation}
                label="Bagong location ng bahay"
              />
              <button
                onClick={saveLocation}
                disabled={saving}
                className="w-full mt-4 py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg active:scale-[0.98] transition disabled:opacity-50"
              >
                {saving ? 'Nagsasave...' : 'I-save ang Location'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============= BOTTOM NAV =============
function BottomNav({ tab, setTab, unreadMessages, orderUpdates, cartCount }: { tab: Tab; setTab: (t: Tab) => void; unreadMessages: number; orderUpdates: number; cartCount: number }) {
  const { profile } = useAuth();

  const items: { id: Tab; icon: typeof Home; label: string; badge?: number; alert?: boolean }[] = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'orders', icon: Package, label: 'Orders', badge: orderUpdates, alert: orderUpdates > 0 },
    { id: 'cart', icon: ShoppingCart, label: 'Cart', badge: cartCount },
    { id: 'messages', icon: MessageCircle, label: 'Messages', badge: unreadMessages },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-7xl bg-white border-t border-gray-100 px-1 py-1.5 safe-bottom z-50 md:px-6">
      <div className="flex items-center justify-around">
        {items.map(item => {
          const Icon = item.icon;
          const active = tab === item.id;
          const isAlert = item.alert && item.badge && item.badge > 0;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className="flex-1 flex flex-col items-center gap-0.5 py-1.5 px-0.5 min-w-0 relative"
            >
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
