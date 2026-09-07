import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Product, Store, Category, CartItem, Order, OrderItem, OrderStatus, Conversation, AdminConversation } from '@/lib/types';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types';
import { LocationSelector, type LocationData } from '@/components/LocationSelector';
import { InactiveBanner } from '@/components/InactiveBanner';
import {
  computeDeliveryFee, estimateDistanceKm,
  haversineKm, getStoreCoords, getDeliveryCoords,
  computeDeliveryFeeFromCoords, BASE_DELIVERY_FEE, PER_KM_RATE,
  type Coords,
} from '@/lib/deliveryFee';
import { DeliveryMap } from '@/components/DeliveryMap';
import { COMMISSION_RATE } from '@/lib/types';
import { ChatView, getOrCreateConversation } from '@/components/ChatView';
import { Avatar } from '@/components/Avatar';
import { ImageUploadField } from '@/components/ImageUploadField';
import { ReviewForm, ReviewSection } from '@/components/Reviews';
import { AdminVideoCall } from '@/components/AdminVideoCall';
import { AdminChat } from '@/components/AdminChat';
import { useIncomingAdminCall } from '@/lib/useAdminCall';
import { useAdminConversations } from '@/lib/useAdminChat';
import {
  Search, ShoppingCart, Home, Package, User, Plus, Minus, Trash2, X,
  MapPin, Star, Fish, ArrowLeft, Check, ChevronRight, Bike, Store as StoreIcon,
  QrCode, Clock, Phone, Navigation, Filter, ShoppingBag, MessageCircle, Send,
  Share2, Copy, ExternalLink, Download, ImageOff, Bell, Timer, CheckCircle, LogOut,
  Shield,
} from 'lucide-react';

type Tab = 'home' | 'orders' | 'cart' | 'messages' | 'profile';
type View = 'browse' | 'product' | 'store' | 'checkout' | 'order_detail' | 'chat' | 'payment_summary';

export function BuyerApp() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('home');
  const [view, setView] = useState<View>('browse');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cartRefresh, setCartRefresh] = useState(0);
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
    setSelectedProduct(product);
    setSelectedStore(store);
    setView('product');
  }

  function navigateToStore(store: Store) {
    setSelectedStore(store);
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
  }

  function refreshCart() {
    setCartRefresh(c => c + 1);
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
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative">
      {!canAct && <InactiveBanner />}
      {/* Content */}
      <div className="flex-1 pb-20 overflow-y-auto">
        {tab === 'home' && view === 'browse' && (
          <BrowseView onProductClick={navigateToProduct} onStoreClick={navigateToStore} orderUpdates={orderUpdates} onOpenOrders={() => { setTab('orders'); setView('browse'); }} onSignOut={signOut} />
        )}
        {tab === 'home' && view === 'product' && selectedProduct && (
          <ProductView product={selectedProduct} store={selectedStore!} onBack={backToBrowse} onAddToCart={refreshCart} />
        )}
        {tab === 'home' && view === 'store' && selectedStore && (
          <StoreView store={selectedStore} onProductClick={(p) => navigateToProduct(p, selectedStore)} onBack={backToBrowse} />
        )}
        {tab === 'home' && view === 'checkout' && (
          <CheckoutView onBack={backToBrowse} onOrderPlaced={(orders) => {
            if (orders.length > 1) {
              setPaymentGroupOrders(orders);
              setView('payment_summary');
            } else {
              setTab('orders');
              setView('browse');
            }
          }} canAct={canAct} />
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
      <BottomNav tab={tab} setTab={(t) => { setTab(t); setView('browse'); }} unreadMessages={totalUnread} orderUpdates={orderUpdates} />
    </div>
  );
}

// ============= BROWSE VIEW =============
function BrowseView({ onProductClick, onStoreClick, orderUpdates, onOpenOrders, onSignOut }: { onProductClick: (p: Product, s: Store) => void; onStoreClick: (s: Store) => void; orderUpdates: number; onOpenOrders: () => void; onSignOut: () => void }) {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<(Product & { store: Store })[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState({ city: '', region: '', barangay: '', palengke: '' });
  const [showLocationModal, setShowLocationModal] = useState(false);

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
        supabase.from('products').select('id, name, description, price, unit, image_url, stock, is_available, category_id, store_id, created_at, store:stores(id, name, barangay, district, city, region, palengke_name, is_open, rating, logo_url, banner_url)').eq('is_available', true).order('created_at', { ascending: false }).limit(30),
        supabase.from('stores').select('id, name, description, barangay, district, city, region, palengke_name, logo_url, banner_url, is_open, rating, qr_code_url, payment_method, seller_id').eq('is_open', true).order('rating', { ascending: false }).limit(20),
      ]);
      setCategories(cats || []);
      setProducts((prods || []) as any);
      setStores(strs || []);
      setLoading(false);
    }
    load();
  }, []);

  // Realtime: reload when stores or products change (e.g. admin deactivates a seller)
  useEffect(() => {
    const sub = supabase.channel('browse-stores-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => {
        supabase.from('stores').select('id, name, description, barangay, district, city, region, palengke_name, logo_url, banner_url, is_open, rating, qr_code_url, payment_method, seller_id').eq('is_open', true).order('rating', { ascending: false }).limit(20)
          .then(({ data }) => setStores(data || []));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        supabase.from('products').select('id, name, description, price, unit, image_url, stock, is_available, category_id, store_id, created_at, store:stores(id, name, barangay, district, city, region, palengke_name, is_open, rating, logo_url, banner_url)').eq('is_available', true).order('created_at', { ascending: false }).limit(30)
          .then(({ data }) => setProducts((data || []) as any));
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const filteredProducts = products.filter(p => {
    if (activeCategory && p.category_id !== activeCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.store.name.toLowerCase().includes(search.toLowerCase()) && !(p.store.palengke_name || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (locationFilter.city && p.store.city.toLowerCase() !== locationFilter.city.toLowerCase()) return false;
    if (locationFilter.region && p.store.region.toLowerCase() !== locationFilter.region.toLowerCase()) return false;
    if (locationFilter.barangay && p.store.barangay.toLowerCase() !== locationFilter.barangay.toLowerCase()) return false;
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
    if (locationFilter.barangay && s.barangay.toLowerCase() !== locationFilter.barangay.toLowerCase()) return false;
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

  return (
    <div>
      {/* Header */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-5 pt-12 pb-6 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Fish size={24} />
            <span className="text-xl font-bold">GoPalengke</span>
          </div>
          <button onClick={onSignOut} className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center active:scale-90 transition">
            <LogOut size={18} className="text-white" />
          </button>
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
            {locationFilter.city || profile?.barangay || 'Set location'}, {locationFilter.region || profile?.city || ''} {locationFilter.region || profile?.region || ''}
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
            className={`px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 ${!locationFilter.palengke && !locationFilter.barangay ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}`}
          >
            Near Me
          </button>
          <button
            onClick={() => setLocationFilter({ city: '', region: '', barangay: '', palengke: '' })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 ${!locationFilter.city && !locationFilter.region && !locationFilter.palengke && !locationFilter.barangay ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}`}
          >
            Lahat
          </button>
          <input
            type="text"
            value={locationFilter.palengke}
            onChange={(e) => setLocationFilter(f => ({ ...f, palengke: e.target.value }))}
            placeholder="Palengke"
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 outline-none w-28 flex-shrink-0"
          />
          <input
            type="text"
            value={locationFilter.barangay}
            onChange={(e) => setLocationFilter(f => ({ ...f, barangay: e.target.value }))}
            placeholder="Barangay"
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 outline-none w-24 flex-shrink-0"
          />
          <button
            onClick={() => setShowLocationModal(true)}
            className="px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 bg-gray-100 text-gray-600"
          >
            Palitan Location
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="px-5 py-4">
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              className={`flex flex-col items-center gap-1.5 flex-shrink-0 ${activeCategory === cat.id ? 'opacity-100' : 'opacity-70'}`}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl ${activeCategory === cat.id ? 'bg-brand-500' : 'bg-white border border-gray-200'}`}>
                <CategoryIcon slug={cat.slug} active={activeCategory === cat.id} />
              </div>
              <span className={`text-xs font-medium text-center ${activeCategory === cat.id ? 'text-brand-700' : 'text-gray-600'}`}>{cat.name_fil}</span>
            </button>
          ))}
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
                className="flex-shrink-0 w-40 bg-white rounded-2xl overflow-hidden border border-gray-100 active:scale-[0.98] transition"
              >
                <div className="h-20 bg-gray-100 relative">
                  {store.banner_url && <img src={store.banner_url} alt={store.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                  {store.city.toLowerCase() === (locationFilter.city || '').toLowerCase() && (
                    <span className="absolute top-1 right-1 bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full">Near You</span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="font-semibold text-sm text-gray-800 line-clamp-1">{store.name}</p>
                  {store.palengke_name && (
                    <p className="text-xs text-brand-600 line-clamp-1 flex items-center gap-0.5 mt-0.5">
                      <MapPin size={10} />
                      {store.palengke_name}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-1">
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    <span className="text-xs text-gray-500">{store.rating}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <MapPin size={12} className="text-gray-400" />
                    <span className="text-xs text-gray-500 line-clamp-1">{store.city}</span>
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
          <div className="grid grid-cols-2 gap-3">
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
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {nearYouProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => onProductClick(p, p.store)}
                      className="bg-white rounded-2xl overflow-hidden border border-green-200 text-left active:scale-[0.98] transition"
                    >
                      <div className="h-32 bg-gray-100 relative">
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
                <div className="grid grid-cols-2 gap-3">
                  {otherProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => onProductClick(p, p.store)}
                      className="bg-white rounded-2xl overflow-hidden border border-gray-100 text-left active:scale-[0.98] transition"
                    >
                      <div className="h-32 bg-gray-100 relative">
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
function ProductView({ product, store, onBack, onAddToCart }: { product: Product; store: Store; onBack: () => void; onAddToCart: () => void }) {
  const { profile } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  async function addToCart() {
    if (!profile) return;
    setAdding(true);
    const { data: existing } = await supabase
      .from('cart_items')
      .select('*')
      .eq('buyer_id', profile.id)
      .eq('product_id', product.id)
      .maybeSingle();

    if (existing) {
      await supabase.from('cart_items').update({ quantity: existing.quantity + quantity }).eq('id', existing.id);
    } else {
      await supabase.from('cart_items').insert({
        buyer_id: profile.id,
        product_id: product.id,
        store_id: store.id,
        quantity,
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
          <p className="text-2xl font-bold text-brand-600">₱{product.price}</p>
          <p className="text-sm text-gray-400">per {product.unit}</p>
          {store.is_open ? (
            <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Bukas ngayon</span>
          ) : (
            <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Sarado</span>
          )}
        </div>
        {product.description && <p className="text-gray-600 text-sm mb-4">{product.description}</p>}

        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <MapPin size={16} />
          <span>{store.barangay}, {store.city}, {store.region}</span>
        </div>
        {store.palengke_name && (
          <div className="flex items-center gap-2 text-sm text-brand-600 mb-6 bg-brand-50 px-3 py-2 rounded-xl">
            <MapPin size={16} />
            <span>Pwesto sa <strong>{store.palengke_name}</strong></span>
          </div>
        )}

        {product.stock > 0 ? (
          <div className="space-y-4">
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
              {adding ? 'Nadadagdag...' : `Idagdag sa Cart · ₱${(product.price * quantity).toFixed(2)}`}
            </button>
          </div>
        ) : (
          <p className="text-center py-4 text-gray-400 font-medium">Ubos na ang paninda. Balik na lang mamaya!</p>
        )}
      </div>
    </div>
  );
}

// ============= STORE VIEW =============
function StoreView({ store, onProductClick, onBack }: { store: Store; onProductClick: (p: Product) => void; onBack: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('products').select('id, name, description, price, unit, image_url, stock, is_available, category_id, store_id, created_at').eq('store_id', store.id).eq('is_available', true).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { setProducts(data || []); setLoading(false); });
  }, [store.id]);

  return (
    <div>
      <div className="relative h-40 bg-gray-200">
        {store.banner_url && <img src={store.banner_url} alt={store.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <button onClick={onBack} className="absolute top-12 left-4 w-10 h-10 rounded-full bg-white/90 shadow-md flex items-center justify-center">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
      </div>
      <div className="px-5 -mt-8 relative">
        <div className="flex items-end gap-3">
          <div className="w-16 h-16 rounded-2xl bg-white shadow-md overflow-hidden border-2 border-white flex-shrink-0">
            {store.logo_url && <img src={store.logo_url} alt={store.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
          </div>
          <div className="pb-1">
            <h1 className="text-xl font-bold text-gray-800">{store.name}</h1>
            <div className="flex items-center gap-1">
              <Star size={14} className="fill-amber-400 text-amber-400" />
              <span className="text-sm text-gray-600">{store.rating}</span>
              <span className="text-sm text-gray-300">·</span>
              <span className="text-sm text-gray-500">{store.city}</span>
            </div>
            {store.palengke_name && (
              <p className="text-xs text-brand-600 flex items-center gap-1 mt-1">
                <MapPin size={12} />
                Pwesto sa {store.palengke_name}
              </p>
            )}
          </div>
        </div>
        {store.description && <p className="text-gray-600 text-sm mt-3">{store.description}</p>}
        <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
          <MapPin size={16} />
          <span>{store.barangay}, {store.district}, {store.city}, {store.region}</span>
        </div>
      </div>

      <div className="px-5 py-4">
        <h3 className="font-bold text-gray-800 mb-3">Mga Paninda</h3>
        {loading ? (
          <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i => <div key={i} className="h-44 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map(p => (
              <button
                key={p.id}
                onClick={() => onProductClick(p)}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 text-left active:scale-[0.98] transition"
              >
                <div className="h-32 bg-gray-100">
                  {p.image_url && <img src={p.image_url} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                </div>
                <div className="p-2.5">
                  <p className="font-semibold text-sm text-gray-800 line-clamp-1">{p.name}</p>
                  <p className="font-bold text-brand-600 mt-1">₱{p.price}<span className="text-xs text-gray-400 font-normal">/{p.unit}</span></p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============= CART VIEW =============
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
    setCartItems((data || []) as any);
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

  const total = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

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
                    <button onClick={() => updateQty(item.id, item.quantity - 1)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center active:scale-90 transition">
                      <Minus size={14} className="text-gray-600" />
                    </button>
                    <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, item.quantity + 1)} className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center active:scale-90 transition">
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
  const [deliveryLocation, setDeliveryLocation] = useState<LocationData>({
    barangay: profile?.barangay || '',
    district: profile?.district || '',
    city: profile?.city || '',
    region: profile?.region || 'NCR',
  });
  const [addressDetails, setAddressDetails] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'qr_code' | 'cod'>('qr_code');
  const [note, setNote] = useState('');
  const [deliveryPin, setDeliveryPin] = useState<Coords | null>(null);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    if (!profile) return;
    supabase.from('cart_items').select('*, product:products(*), store:stores(*)').eq('buyer_id', profile.id)
      .then(({ data }) => { setCartItems((data || []) as any); setLoading(false); });
  }, [profile]);

  const grouped = cartItems.reduce((acc, item) => {
    if (!acc[item.store_id]) acc[item.store_id] = [];
    acc[item.store_id].push(item);
    return acc;
  }, {} as Record<string, (CartItem & { product: Product; store: Store })[]>);

  // Get store coordinates for the first store (for map centering)
  const firstStore = Object.values(grouped)[0]?.[0]?.store;
  const storeCoords = firstStore ? getStoreCoords(firstStore) : null;

  // Get delivery coordinates: prefer pin, fall back to text-based geocoding
  const deliveryCoords: Coords | null = deliveryPin || getDeliveryCoords(deliveryLocation);

  // Calculate fee per store using coordinates when available
  function getFeeForStore(store: Store): { fee: number; distanceKm: number; isEstimated: boolean } {
    const sCoords = getStoreCoords(store);
    if (sCoords && deliveryCoords) {
      const result = computeDeliveryFeeFromCoords(sCoords, deliveryCoords);
      return { ...result, isEstimated: !deliveryPin };
    }
    // Fallback to text-based
    const km = estimateDistanceKm(
      { barangay: store.barangay, city: store.city, region: store.region },
      { barangay: deliveryLocation.barangay, city: deliveryLocation.city, region: deliveryLocation.region },
    );
    return { fee: BASE_DELIVERY_FEE + PER_KM_RATE * km, distanceKm: km, isEstimated: true };
  }

  async function placeOrder() {
    if (!profile) return;
    setPlacing(true);

    const groupId = crypto.randomUUID();
    const createdOrders: Order[] = [];

    for (const [storeId, items] of Object.entries(grouped)) {
      const store = items[0].store;
      const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      const { fee: deliveryFee } = getFeeForStore(store);
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
        delivery_barangay: deliveryLocation.barangay || null,
        delivery_district: deliveryLocation.district || null,
        delivery_city: deliveryLocation.city || null,
        delivery_region: deliveryLocation.region || null,
        delivery_address: fullAddress,
        delivery_lat: deliveryPin?.lat ?? null,
        delivery_lng: deliveryPin?.lng ?? null,
        buyer_note: note || null,
        commission_amount: commissionAmount,
        delivery_group_id: groupId,
      }).select('*').single();

      if (error) { setPlacing(false); return; }
      createdOrders.push(order as Order);

      const orderItems = items.map(i => ({
        order_id: order.id,
        product_id: i.product_id,
        product_name: i.product.name,
        product_image: i.product.image_url,
        price: i.product.price,
        quantity: i.quantity,
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
    const { fee } = getFeeForStore(items[0].store);
    return sum + items.reduce((s, i) => s + i.product.price * i.quantity, 0) + fee;
  }, 0);

  return (
    <div className="px-5 py-4 pb-8">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-800">Checkout</h2>
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

      {/* Order Items by Store with Delivery Fee Breakdown */}
      {Object.entries(grouped).map(([storeId, items]) => {
        const store = items[0].store;
        const { fee, distanceKm, isEstimated } = getFeeForStore(store);
        const distanceFee = fee - BASE_DELIVERY_FEE;

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
                  <p className="text-xs text-gray-400">{item.quantity} × ₱{item.product.price}</p>
                </div>
                <p className="font-semibold text-sm text-gray-700">₱{(item.product.price * item.quantity).toFixed(0)}</p>
              </div>
            ))}

            {/* Delivery Fee Breakdown */}
            <div className="mt-3 pt-3 border-t border-gray-50 space-y-1.5">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Base Delivery Fee</span>
                <span>₱{BASE_DELIVERY_FEE.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Calculated Distance {isEstimated && <span className="text-amber-500">(estimated)</span>}</span>
                <span>{distanceKm.toFixed(2)} km</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Distance Fee ({distanceKm.toFixed(2)} km × ₱{PER_KM_RATE})</span>
                <span>₱{distanceFee.toFixed(2)}</span>
              </div>
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
        disabled={placing || !canAct}
        className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-brand-600/20 active:scale-[0.98] transition disabled:opacity-50"
      >
        {placing ? 'Nagpapadala...' : `Mag-order Na · ₱${grandTotal.toFixed(2)}`}
      </button>
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
        const amount = order.total + order.delivery_fee;

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
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'active' | 'history'>('active');

  const loadOrders = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('orders').select('*, store:stores(*)').eq('buyer_id', profile.id).order('created_at', { ascending: false });
    setOrders((data || []) as any);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadOrders();
    if (!profile) return;
    const sub = supabase.channel('buyer-orders-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `buyer_id=eq.${profile.id}` }, () => loadOrders())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [loadOrders, profile]);

  const activeStatuses: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up'];
  const historyStatuses: OrderStatus[] = ['delivered', 'cancelled'];

  const activeOrders = orders.filter(o => activeStatuses.includes(o.status));
  const historyOrders = orders.filter(o => historyStatuses.includes(o.status));
  const activeCount = activeOrders.length;

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
            const isActive = activeStatuses.includes(firstOrder.status);
            const totalAmount = group.orders.reduce((sum, o) => sum + o.total + o.delivery_fee, 0);
            const allSameStatus = group.orders.every(o => o.status === firstOrder.status);
            const displayStatus = allSameStatus ? firstOrder.status : 'pending';
            const anyRiderPickedUp = group.orders.some(o => o.rider_id && o.status === 'picked_up');

            if (!isMulti) {
              const order = firstOrder;
              return (
                <button
                  key={group.key}
                  onClick={() => onOrderClick(order)}
                  className={`w-full rounded-2xl border p-4 text-left active:scale-[0.98] transition ${
                    isActive ? 'bg-red-50 border-red-300 shadow-sm' : 'bg-white border-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-800">{order.store.name}</p>
                      <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isActive && order.status === 'pending' && (
                        <span className="text-[10px] font-bold text-white bg-amber-500 px-2 py-0.5 rounded-full">BAGO</span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full border ${ORDER_STATUS_COLORS[order.status]}`}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">₱{(order.total + order.delivery_fee).toFixed(0)}</span>
                      {order.rider_id && order.status === 'picked_up' && (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Bike size={10} /> Paparating na
                        </span>
                      )}
                    </div>
                    <ChevronRight size={18} className="text-gray-300" />
                  </div>
                </button>
              );
            }

            // Multi-store grouped card
            return (
              <button
                key={group.key}
                onClick={() => onOrderClick(firstOrder)}
                className={`w-full rounded-2xl border p-4 text-left active:scale-[0.98] transition ${
                  isActive ? 'bg-red-50 border-red-300 shadow-sm' : 'bg-white border-gray-100'
                }`}
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
                  <div className="flex items-center gap-2">
                    {isActive && displayStatus === 'pending' && (
                      <span className="text-[10px] font-bold text-white bg-amber-500 px-2 py-0.5 rounded-full">BAGO</span>
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
  const [rider, setRider] = useState<{ full_name: string; phone: string | null; avatar_url: string | null } | null>(null);
  const [currentOrder, setCurrentOrder] = useState(order);
  const [paymentRef, setPaymentRef] = useState(order.payment_reference || '');
  const [submitting, setSubmitting] = useState(false);
  const [siblingOrders, setSiblingOrders] = useState<(Order & { store: Store })[]>([]);

  useEffect(() => {
    supabase.from('order_items').select('*').eq('order_id', order.id).then(({ data }) => setItems(data || []));
    supabase.from('stores').select('*').eq('id', order.store_id).maybeSingle().then(({ data }) => setStore(data as Store | null));
    if (order.rider_id) {
      supabase.from('profiles').select('full_name, phone, avatar_url').eq('id', order.rider_id).maybeSingle().then(({ data }) => setRider(data as any));
    }

    // Load sibling orders in the same delivery group
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

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-800">Order Details</h2>
      </div>

      {/* Status */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <span className={`text-sm px-3 py-1 rounded-full border ${ORDER_STATUS_COLORS[currentOrder.status]}`}>
            {ORDER_STATUS_LABELS[currentOrder.status]}
          </span>
          <span className="text-sm text-gray-400">#{order.id.slice(0, 8)}</span>
        </div>
        <OrderStatusTracker status={currentOrder.status} />
      </div>

      {/* Store */}
      {store && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <StoreIcon size={16} className="text-gray-500" />
            <span className="font-semibold text-gray-800">{store.name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <MapPin size={14} />
            <span>{store.barangay}, {store.city}, {store.region}</span>
          </div>
          {store.palengke_name && (
            <div className="flex items-center gap-2 text-sm text-brand-600 mt-2">
              <MapPin size={14} />
              <span>Pwesto sa <strong>{store.palengke_name}</strong></span>
            </div>
          )}
          {isBuyer && currentOrder.status !== 'cancelled' && (
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
              <p className="text-xs text-gray-400">{item.quantity} × ₱{item.price}</p>
            </div>
            <p className="font-semibold text-sm text-gray-700">₱{(item.price * item.quantity).toFixed(0)}</p>
          </div>
        ))}
      </div>

      {/* Rider */}
      {rider && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Bike size={16} className="text-blue-500" />
            <span className="font-semibold text-gray-800">Rider</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar src={rider.avatar_url} name={rider.full_name} size={36} />
              <span className="text-sm text-gray-600">{rider.full_name}</span>
            </div>
            <a href={`tel:${rider.phone}`} className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
              <Phone size={16} className="text-blue-600" />
            </a>
          </div>
          {isBuyer && currentOrder.status !== 'cancelled' && currentOrder.status !== 'delivered' && (
            <button
              onClick={() => onOpenChat(currentOrder.id, currentOrder.buyer_id, 'buyer_rider', rider.full_name, 'Rider', null, currentOrder.rider_id)}
              className="w-full mt-3 py-2.5 bg-blue-50 text-blue-700 rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition border border-blue-100"
            >
              <MessageCircle size={16} /> Chat with Rider
            </button>
          )}
        </div>
      )}

      {/* Live Tracking Map */}
      {currentOrder.status === 'picked_up' && currentOrder.rider_lat != null && currentOrder.rider_lng != null && (
        <LiveTrackingMap
          riderLat={currentOrder.rider_lat}
          riderLng={currentOrder.rider_lng}
          riderName={rider?.full_name || 'Rider'}
          deliveryAddress={`${currentOrder.delivery_address} ${currentOrder.delivery_barangay} ${currentOrder.delivery_city} ${currentOrder.delivery_region}`}
          pickedUpAt={currentOrder.picked_up_at}
          sameCity={store?.city === currentOrder.delivery_city}
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

      {/* Delivery Address */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Navigation size={16} className="text-brand-600" />
          <span className="font-semibold text-gray-800">Delivery Address</span>
        </div>
        <p className="text-sm text-gray-600">{currentOrder.delivery_address}</p>
        <p className="text-sm text-gray-400">{currentOrder.delivery_barangay}, {currentOrder.delivery_city}, {currentOrder.delivery_region}</p>
      </div>

      {/* Payment */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
        <h3 className="font-semibold text-gray-800 mb-2">Payment</h3>
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Method</span>
          <span>{currentOrder.payment_method === 'qr_code' ? 'QR Code (GCash/Maya)' : 'Cash on Delivery'}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Subtotal</span><span>₱{currentOrder.total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Delivery fee</span><span>₱{currentOrder.delivery_fee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-gray-800 pt-2 border-t border-gray-100">
          <span>Total</span><span>₱{(currentOrder.total + currentOrder.delivery_fee).toFixed(2)}</span>
        </div>

        {/* QR Code Payment Section - only shows after seller confirms the order */}
        {isBuyer && currentOrder.payment_method === 'qr_code' && currentOrder.status !== 'cancelled' && currentOrder.status !== 'delivered' && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {currentOrder.status === 'pending' ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock size={16} className="text-amber-500 flex-shrink-0" />
                <p>Naghihintay pa na ma-confirm ng seller ang order mo. Lalabas ang QR code at payment instructions dito kapag na-confirm na.</p>
              </div>
            ) : store?.qr_code_url ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <QrCode size={18} className="text-brand-600" />
                  <span className="font-semibold text-sm text-gray-800">Paano Magbayad gamit ang QR Code</span>
                </div>

                {/* Step 1: Scan */}
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl mb-2.5">
                  <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">1</div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">I-scan ang QR code</p>
                    <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">Buksan ang GCash o Maya app sa ibang phone, piliin ang "Scan QR", at i-scan ang QR code sa baba.</p>
                  </div>
                </div>

                {/* Step 2: Download & Upload */}
                <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl mb-2.5">
                  <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
                  <div>
                    <p className="text-sm font-medium text-amber-900">Isang phone lang ang gamit?</p>
                    <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">I-download ang QR code image gamit ang button sa baba. Tapos, buksan ang GCash app, piliin ang "Upload QR" o "Import QR", at i-upload ang na-download na image.</p>
                  </div>
                </div>

                {/* Step 3: Enter amount */}
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl mb-4">
                  <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
                  <div>
                    <p className="text-sm font-medium text-green-900">Ilagay ang tamang halaga</p>
                    <p className="text-xs text-green-700 mt-0.5 leading-relaxed">Bayaran ang <strong>₱{(currentOrder.total + currentOrder.delivery_fee).toFixed(2)}</strong> na kabuuang halaga (kasama ang delivery fee).</p>
                  </div>
                </div>

                {/* QR Code Image */}
                <div className="bg-gray-50 rounded-xl p-4 flex justify-center">
                  <img src={store.qr_code_url} alt="QR Code ng Seller" loading="lazy" decoding="async" className="w-48 h-48 rounded-xl object-contain" />
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
                  className="w-full mt-3 py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
                >
                  <Download size={18} /> I-download ang QR Code
                </button>

                {/* Payment Reference Form + Mark as Paid button */}
                {currentOrder.payment_status !== 'paid' ? (
                  <div className="mt-4">
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                      Payment Reference Number
                    </label>
                    <p className="text-xs text-gray-400 mb-2 leading-relaxed">
                      Pagkatapos magbayad sa GCash/Maya, may makikita kang reference o transaction ID. Ilagay ito bilang proof ng payment mo.
                    </p>
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
                ) : (
                  <div className="mt-4">
                    <div className="w-full py-3 bg-green-100 text-green-700 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border border-green-300">
                      <Check size={18} /> Na-confirm mo na ang payment
                    </div>
                    {currentOrder.payment_reference && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-xs text-gray-400 mb-0.5">Reference Number:</p>
                        <p className="text-sm font-mono font-medium text-gray-700">{currentOrder.payment_reference}</p>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-gray-400 mt-3 text-center leading-relaxed">
                  Pagkatapos mag-bayad sa GCash/Maya, ilagay ang reference number at i-tap ang button para ma-notify ang seller na paid na ang order mo.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <ImageOff size={16} className="text-gray-400 flex-shrink-0" />
                <p>Hindi pa nag-upload ang seller ng QR code. Makipag-ugnayan sa seller via chat para makahingi ng payment details.</p>
              </div>
            )}
          </div>
        )}
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

      {/* Leave a Review - only for delivered orders */}
      {isBuyer && currentOrder.status === 'delivered' && (
        <ReviewSectionForOrder
          orderId={currentOrder.id}
          store={store}
          rider={rider}
          riderId={currentOrder.rider_id}
          sellerId={store?.seller_id || null}
        />
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
    </div>
  );
}

// ============= LIVE TRACKING MAP =============
function LiveTrackingMap({ riderLat, riderLng, riderName, deliveryAddress, pickedUpAt, sameCity }: {
  riderLat: number;
  riderLng: number;
  riderName: string;
  deliveryAddress: string;
  pickedUpAt: string | null;
  sameCity: boolean;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!pickedUpAt) return;
    const interval = setInterval(() => {
      const pickedAt = new Date(pickedUpAt).getTime();
      setElapsedSeconds(Math.floor((Date.now() - pickedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [pickedUpAt]);

  const estimatedTotalSeconds = sameCity ? 15 * 60 : 30 * 60;
  const remainingSeconds = Math.max(0, estimatedTotalSeconds - elapsedSeconds);
  const remainingMin = Math.floor(remainingSeconds / 60);
  const remainingSec = remainingSeconds % 60;
  const isOverdue = elapsedSeconds > estimatedTotalSeconds;

  const mapUrl = `https://maps.google.com/maps?q=${riderLat},${riderLng}&z=15&output=embed`;
  const directionsUrl = `https://www.google.com/maps/dir/${riderLat},${riderLng}/${encodeURIComponent(deliveryAddress)}`;

  return (
    <div className="bg-white rounded-2xl border border-blue-200 p-4 mb-3">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <Navigation size={18} className="text-blue-600" /> Live Location ng Rider
      </h3>

      {/* Embedded Map */}
      <div className="rounded-xl overflow-hidden border border-gray-200 mb-3">
        <iframe
          src={mapUrl}
          width="100%"
          height="200"
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Rider Live Location"
        />
      </div>

      {/* ETA Countdown */}
      <div className={`p-3 rounded-xl flex items-center gap-3 mb-3 ${isOverdue ? 'bg-red-50' : 'bg-blue-50'}`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOverdue ? 'bg-red-500' : 'bg-blue-500'}`}>
          <Timer size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <p className={`text-xs ${isOverdue ? 'text-red-500' : 'text-blue-500'}`}>
            {isOverdue ? 'Lampas sa estimated time' : 'Tinatayang oras ng pagdating'}
          </p>
          <p className={`font-bold text-lg ${isOverdue ? 'text-red-600' : 'text-blue-700'}`}>
            {isOverdue
              ? `+${Math.floor((elapsedSeconds - estimatedTotalSeconds) / 60)}m`
              : `${remainingMin}m ${remainingSec}s`}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-green-600">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live
        </div>
      </div>

      {/* Rider name + Directions link */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bike size={16} className="text-blue-500" />
          <span className="text-sm text-gray-600">{riderName}</span>
        </div>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium"
        >
          <MapPin size={12} /> Buksan sa Google Maps
        </a>
      </div>
    </div>
  );
}

function OrderStatusTracker({ status }: { status: OrderStatus }) {
  const steps: { key: OrderStatus; label: string }[] = [
    { key: 'pending', label: 'Order' },
    { key: 'accepted', label: 'Confirm' },
    { key: 'preparing', label: 'Hahanda' },
    { key: 'picked_up', label: 'Pickup' },
    { key: 'delivered', label: 'Delivered' },
  ];
  const currentIndex = steps.findIndex(s => s.key === status);
  const isCancelled = status === 'cancelled';

  if (isCancelled) {
    return <p className="text-center text-red-500 text-sm py-2">Nakansela ang order na ito.</p>;
  }

  return (
    <div className="flex items-center justify-between">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              i <= currentIndex ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-400'
            }`}>
              {i < currentIndex ? <Check size={14} /> : i + 1}
            </div>
            <span className={`text-xs ${i <= currentIndex ? 'text-brand-600 font-medium' : 'text-gray-400'}`}>{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 flex-1 mx-1 ${i < currentIndex ? 'bg-brand-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ============= MESSAGES VIEW =============
function MessagesView({ onOpenChat, adminConversations, onOpenAdminChat }: { onOpenChat: (convId: string, name: string, role: string) => void; adminConversations: (AdminConversation & { admin: { full_name: string } })[]; onOpenAdminChat: (convId: string, name: string) => void }) {
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
                  onClick={() => onOpenAdminChat(c.id, c.admin?.full_name || 'Admin')}
                  className="w-full bg-blue-50 rounded-2xl border border-blue-200 p-4 text-left active:scale-[0.98] transition flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <Shield size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm text-gray-800 truncate">{c.admin?.full_name || 'Admin'}</p>
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
  const [location, setLocation] = useState<LocationData>({
    barangay: profile?.barangay || '',
    district: profile?.district || '',
    city: profile?.city || '',
    region: profile?.region || 'NCR',
  });
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="px-5 py-4">
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
          <div className="flex items-center gap-2 text-gray-600"><MapPin size={16} /><span>{profile?.barangay}, {profile?.city}, {profile?.region}</span></div>
        </div>
      </div>

      {/* Profile Picture Upload */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <ImageUploadField
          label="Profile Picture"
          value={profile?.avatar_url || ''}
          bucket="profile-images"
          folder={`avatars/${profile?.id}`}
          aspectClass="h-32"
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
              onClick={() => { window.location.hash = `/u/${profile.slug}`; }}
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
function BottomNav({ tab, setTab, unreadMessages, orderUpdates }: { tab: Tab; setTab: (t: Tab) => void; unreadMessages: number; orderUpdates: number }) {
  const { profile } = useAuth();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    if (!profile) return;
    supabase.from('cart_items').select('id').eq('buyer_id', profile.id)
      .then(({ data }) => setCartCount(data?.length || 0));

    const sub = supabase.channel('cart-nav')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cart_items', filter: `buyer_id=eq.${profile.id}` }, () => {
        supabase.from('cart_items').select('id').eq('buyer_id', profile.id)
          .then(({ data }) => setCartCount(data?.length || 0));
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [profile]);

  const items: { id: Tab; icon: typeof Home; label: string; badge?: number; alert?: boolean }[] = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'orders', icon: Package, label: 'Orders', badge: orderUpdates, alert: orderUpdates > 0 },
    { id: 'cart', icon: ShoppingCart, label: 'Cart', badge: cartCount },
    { id: 'messages', icon: MessageCircle, label: 'Messages', badge: unreadMessages },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 px-2 py-1.5 safe-bottom z-50">
      <div className="flex items-center justify-around">
        {items.map(item => {
          const Icon = item.icon;
          const active = tab === item.id;
          const isAlert = item.alert && item.badge && item.badge > 0;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className="flex flex-col items-center gap-0.5 py-1.5 px-3 relative"
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
                className={`text-xs ${
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
