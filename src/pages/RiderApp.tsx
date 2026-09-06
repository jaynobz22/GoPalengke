import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Order, OrderItem, Store, OrderStatus } from '@/lib/types';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types';
import { estimateDistanceKm, computeDeliveryFee, PER_KM_RATE, BASE_DELIVERY_FEE } from '@/lib/deliveryFee';
import { ChatView, getOrCreateConversation } from '@/components/ChatView';
import { Avatar } from '@/components/Avatar';
import { ImageUploadField } from '@/components/ImageUploadField';
import { InactiveBanner } from '@/components/InactiveBanner';
import { ReviewSection } from '@/components/Reviews';
import {
  Bike, Package, User, ArrowLeft, MapPin, Phone, Navigation,
  Store as StoreIcon, Clock, Check, Navigation as NavIcon, MapPinned, MessageCircle,
  Share2, Copy, ExternalLink, Power, Timer, Star,
} from 'lucide-react';

type Tab = 'deliveries' | 'history' | 'profile';

export function RiderApp() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('deliveries');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [chatPartnerName, setChatPartnerName] = useState('');
  const [chatPartnerRole, setChatPartnerRole] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Track unread messages for badge
  useEffect(() => {
    if (!profile) return;
    const userId = profile.id;
    async function countUnread() {
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .eq('rider_id', userId);
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
    const sub = supabase.channel('rider-unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => countUnread())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [profile]);

  async function openChat(order: Order, buyerName: string) {
    if (!profile) return;
    const conv = await getOrCreateConversation(order.id, order.buyer_id, 'buyer_rider', null, profile.id);
    if (conv) {
      setActiveConversationId(conv.id);
      setChatPartnerName(buyerName);
      setChatPartnerRole('Buyer');
      setShowChat(true);
    }
  }

  const canAct = profile?.is_active ?? true;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative">
      {!canAct && <InactiveBanner />}
      <div className="flex-1 pb-20 overflow-y-auto">
        {tab === 'deliveries' && (
          selectedOrder ? (
            <RiderOrderDetail order={selectedOrder} onBack={() => setSelectedOrder(null)} onOpenChat={openChat} />
          ) : (
            <RiderDeliveries onOrderClick={setSelectedOrder} canAct={canAct} />
          )
        )}
        {tab === 'history' && (
          selectedOrder ? (
            <RiderOrderDetail order={selectedOrder} onBack={() => setSelectedOrder(null)} onOpenChat={openChat} />
          ) : (
            <RiderHistory onOrderClick={setSelectedOrder} />
          )
        )}
        {tab === 'profile' && <RiderProfile onSignOut={signOut} />}

        {showChat && activeConversationId && (
          <div className="fixed inset-0 z-50 bg-gray-50 max-w-md mx-auto">
            <ChatView
              conversationId={activeConversationId}
              otherName={chatPartnerName}
              otherRole={chatPartnerRole}
              onBack={() => { setShowChat(false); setActiveConversationId(null); }}
            />
          </div>
        )}
      </div>

      <RiderBottomNav tab={tab} setTab={(t) => { setTab(t); setSelectedOrder(null); }} riderId={profile?.id || ''} unreadMessages={unreadCount} />
    </div>
  );
}

// ============= DELIVERIES =============
function RiderDeliveries({ onOrderClick, canAct }: { onOrderClick: (o: Order) => void; canAct: boolean }) {
  const { profile } = useAuth();
  const [availableOrders, setAvailableOrders] = useState<(Order & { store: Store; buyer: { full_name: string } })[]>([]);
  const [myOrders, setMyOrders] = useState<(Order & { store: Store; buyer: { full_name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: available }, { data: mine }] = await Promise.all([
      supabase.from('orders').select('*, store:stores(*), buyer:profiles!orders_buyer_id_fkey(full_name)')
        .in('status', ['ready_for_pickup']).is('rider_id', null).order('created_at', { ascending: true }),
      supabase.from('orders').select('*, store:stores(*), buyer:profiles!orders_buyer_id_fkey(full_name)')
        .eq('rider_id', profile.id).in('status', ['picked_up']).order('created_at', { ascending: false }),
    ]);
    setAvailableOrders((available || []) as any);
    setMyOrders((mine || []) as any);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    if (profile) setIsAvailable(profile.is_available ?? false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const sub = supabase.channel('rider-deliveries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load]);

  async function toggleAvailability() {
    if (!profile) return;
    setToggling(true);
    const newValue = !isAvailable;
    setIsAvailable(newValue);
    await supabase.from('profiles').update({ is_available: newValue }).eq('id', profile.id);
    setToggling(false);
  }

  async function acceptOrder(order: Order) {
    if (!profile) return;
    await supabase.from('orders').update({
      rider_id: profile.id,
      status: 'picked_up',
      picked_up_at: new Date().toISOString(),
    }).eq('id', order.id);
    load();
  }

  if (loading) {
    return <div className="p-5"><div className="h-32 bg-gray-100 rounded-2xl animate-pulse" /></div>;
  }

  return (
    <div>
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-5 pt-12 pb-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Bike size={24} />
          <span className="text-xl font-bold">GoPalengke Rider</span>
        </div>
        <p className="text-blue-100 text-sm">Kumusta, {profile?.full_name?.split(' ')[0]}! Handa ka na ba mag-deliver?</p>
      </div>

      {/* Availability Toggle */}
      <div className="px-5 py-4">
        <button
          onClick={toggleAvailability}
          disabled={toggling || !canAct}
          className={`w-full rounded-2xl p-4 flex items-center justify-between transition active:scale-[0.98] ${
            isAvailable
              ? 'bg-green-50 border-2 border-green-300'
              : 'bg-gray-50 border-2 border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isAvailable ? 'bg-green-500' : 'bg-gray-300'
            }`}>
              <Power size={24} className="text-white" />
            </div>
            <div className="text-left">
              <p className={`font-bold text-sm ${isAvailable ? 'text-green-700' : 'text-gray-600'}`}>
                {isAvailable ? 'Available ka na' : 'Hindi ka available'}
              </p>
              <p className={`text-xs ${isAvailable ? 'text-green-600' : 'text-gray-400'}`}>
                {isAvailable ? 'Makikita mo ang available na orders' : 'I-on para makakuha ng orders'}
              </p>
            </div>
          </div>
          <div className={`relative w-14 h-8 rounded-full transition ${isAvailable ? 'bg-green-500' : 'bg-gray-300'}`}>
            <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all ${isAvailable ? 'left-7' : 'left-1'}`} />
          </div>
        </button>
      </div>

      {/* My Active Deliveries */}
      <div className="px-5 pb-4">
        <h2 className="font-bold text-gray-800 mb-3">Active Deliveries ko</h2>
        {myOrders.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Bike size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Wala kang active delivery. Kumuha ng order!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {myOrders.map(order => (
              <button key={order.id} onClick={() => onOrderClick(order)}
                className="w-full bg-white rounded-2xl border border-blue-200 p-4 text-left active:scale-[0.98] transition">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-gray-800">{order.buyer?.full_name || 'Buyer'}</p>
                  <span className={`text-xs px-2 py-1 rounded-full border ${ORDER_STATUS_COLORS[order.status]}`}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <StoreIcon size={14} /><span>{order.store.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <MapPin size={14} /><span>{order.delivery_barangay}, {order.delivery_city}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-gray-400">₱{order.delivery_fee.toFixed(0)} ang fee</span>
                  <span className="text-xs text-blue-600 font-medium">Tignan ang details →</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Available Orders — only shown when rider is available */}
      {isAvailable && (
        <div className="px-5 pb-4">
          <h2 className="font-bold text-gray-800 mb-3">Mga Available na Orders</h2>
          {availableOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Package size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Wala pang available na orders. Maghintay lang!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableOrders.map(order => (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-800">{order.buyer?.full_name || 'Buyer'}</p>
                    <span className="text-xs text-gray-400">{new Date(order.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <StoreIcon size={14} /><span>{order.store.name}</span>
                    <MapPin size={14} /><span>{order.store.barangay}, {order.store.city}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                    <Navigation size={14} /><span>Deliver to: {order.delivery_barangay}, {order.delivery_city}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Delivery fee</p>
                      <p className="font-bold text-blue-600">₱{order.delivery_fee.toFixed(0)}</p>
                    </div>
                    <button onClick={() => acceptOrder(order)} disabled={!canAct}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold active:scale-95 transition disabled:opacity-50">
                      Tanggapin
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============= RIDER ORDER DETAIL =============
function RiderOrderDetail({ order, onBack, onOpenChat }: { order: Order; onBack: () => void; onOpenChat: (order: Order, buyerName: string) => void }) {
  const { profile } = useAuth();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [buyer, setBuyer] = useState<{ full_name: string; phone: string | null; avatar_url: string | null } | null>(null);
  const [currentOrder, setCurrentOrder] = useState(order);
  const [updating, setUpdating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [gpsActive, setGpsActive] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    supabase.from('order_items').select('*').eq('order_id', order.id).then(({ data }) => setItems(data || []));
    supabase.from('stores').select('*').eq('id', order.store_id).maybeSingle().then(({ data }) => setStore(data as Store | null));
    supabase.from('profiles').select('full_name, phone, avatar_url').eq('id', order.buyer_id).maybeSingle().then(({ data }) => setBuyer(data as any));

    const sub = supabase.channel(`rider-order-${order.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` }, (payload: any) => {
        if (payload.new) setCurrentOrder(payload.new as Order);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [order.id]);

  // Start GPS tracking when order is picked_up
  useEffect(() => {
    if (currentOrder.status !== 'picked_up' || !profile) return;

    function startGps() {
      if (!navigator.geolocation) return;
      setGpsActive(true);
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          supabase.from('orders').update({ rider_lat: lat, rider_lng: lng }).eq('id', currentOrder.id);
        },
        () => { setGpsActive(false); },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    }
    startGps();

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      setGpsActive(false);
    };
  }, [currentOrder.status, currentOrder.id, profile]);

  // Countdown timer
  useEffect(() => {
    if (currentOrder.status !== 'picked_up' || !currentOrder.picked_up_at) return;
    const interval = setInterval(() => {
      const pickedAt = new Date(currentOrder.picked_up_at!).getTime();
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - pickedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [currentOrder.status, currentOrder.picked_up_at]);

  async function markDelivered() {
    setUpdating(true);
    await supabase.from('orders').update({ status: 'delivered', rider_lat: null, rider_lng: null }).eq('id', currentOrder.id);
    setUpdating(false);
    onBack();
  }

  const sameCity = store?.city === currentOrder.delivery_city;
  const estimatedKm = estimateDistanceKm(
    store ? { barangay: store.barangay, city: store.city, region: store.region } : null,
    { barangay: currentOrder.delivery_barangay, city: currentOrder.delivery_city, region: currentOrder.delivery_region },
  );
  const estimatedTotalSeconds = sameCity ? 15 * 60 : 30 * 60;
  const remainingSeconds = Math.max(0, estimatedTotalSeconds - elapsedSeconds);
  const remainingMin = Math.floor(remainingSeconds / 60);
  const remainingSec = remainingSeconds % 60;
  const isOverdue = elapsedSeconds > estimatedTotalSeconds;

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-800">Delivery Details</h2>
      </div>

      {/* Status + Timer */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm px-3 py-1 rounded-full border ${ORDER_STATUS_COLORS[currentOrder.status]}`}>
            {ORDER_STATUS_LABELS[currentOrder.status]}
          </span>
          <span className="text-sm text-gray-400">#{order.id.slice(0, 8)}</span>
        </div>
        {currentOrder.status === 'picked_up' && currentOrder.picked_up_at && (
          <div className={`mt-3 p-3 rounded-xl flex items-center gap-3 ${isOverdue ? 'bg-red-50' : 'bg-blue-50'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOverdue ? 'bg-red-500' : 'bg-blue-500'}`}>
              <Timer size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <p className={`text-xs ${isOverdue ? 'text-red-500' : 'text-blue-500'}`}>
                {isOverdue ? 'Lampas sa estimated time' : 'Oras na natitira'}
              </p>
              <p className={`font-bold text-lg ${isOverdue ? 'text-red-600' : 'text-blue-700'}`}>
                {isOverdue
                  ? `+${Math.floor((elapsedSeconds - estimatedTotalSeconds) / 60)}m ${((elapsedSeconds - estimatedTotalSeconds) % 60)}s`
                  : `${remainingMin}m ${remainingSec}s`}
              </p>
            </div>
            {gpsActive && (
              <div className="flex items-center gap-1 text-xs text-green-600">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                GPS
              </div>
            )}
          </div>
        )}
      </div>

      {/* Route Info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <NavIcon size={18} className="text-blue-600" /> Route
        </h3>
        {/* Pickup */}
        {store && (
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <StoreIcon size={16} className="text-brand-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400 font-medium">PICKUP</p>
              <p className="font-semibold text-sm text-gray-800">{store.name}</p>
              <p className="text-sm text-gray-500">{store.barangay}, {store.city}, {store.region}</p>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.name + ' ' + store.barangay + ' ' + store.city + ' ' + store.region)}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 mt-1">
                <MapPin size={12} /> Buksan sa Google Maps
              </a>
            </div>
          </div>
        )}
        {/* Connector line */}
        <div className="ml-4 w-0.5 h-6 bg-gray-200 mb-1" />
        {/* Dropoff */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <MapPinned size={16} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-medium">DROPOFF</p>
            <p className="font-semibold text-sm text-gray-800">{buyer?.full_name || 'Buyer'}</p>
            <p className="text-sm text-gray-500">{currentOrder.delivery_address}</p>
            <p className="text-sm text-gray-500">{currentOrder.delivery_barangay}, {currentOrder.delivery_city}, {currentOrder.delivery_region}</p>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentOrder.delivery_address + ' ' + currentOrder.delivery_barangay + ' ' + currentOrder.delivery_city + ' ' + currentOrder.delivery_region)}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 mt-1">
              <MapPin size={12} /> Buksan sa Google Maps
            </a>
          </div>
        </div>

        {/* Distance/Time */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-around">
          <div className="text-center">
            <p className="text-xs text-gray-400">Estimated Distance</p>
            <p className="font-bold text-gray-800">~{estimatedKm} km</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Estimated Time</p>
            <p className="font-bold text-gray-800">{sameCity ? '10-15 min' : '20-30 min'}</p>
          </div>
        </div>
        <div className="mt-2 text-center text-xs text-gray-400">
          ₱{BASE_DELIVERY_FEE} base + {estimatedKm}km × ₱{PER_KM_RATE} = ₱{computeDeliveryFee(store ? { barangay: store.barangay, city: store.city, region: store.region } : null, { barangay: currentOrder.delivery_barangay, city: currentOrder.delivery_city, region: currentOrder.delivery_region }).toFixed(0)} ang fee
        </div>
      </div>

      {/* Contact */}
      {buyer && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
          <h3 className="font-semibold text-gray-800 mb-2">Contact Buyer</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar src={buyer.avatar_url} name={buyer.full_name} size={36} />
              <div>
                <p className="text-sm font-medium text-gray-800">{buyer.full_name}</p>
                {buyer.phone && <p className="text-xs text-gray-400">{buyer.phone}</p>}
              </div>
            </div>
            <a href={`tel:${buyer.phone}`} className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Phone size={18} className="text-blue-600" />
            </a>
          </div>
          {currentOrder.status !== 'delivered' && currentOrder.status !== 'cancelled' && (
            <button
              onClick={() => onOpenChat(currentOrder, buyer.full_name)}
              className="w-full mt-3 py-2.5 bg-blue-50 text-blue-700 rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition border border-blue-100"
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
              {item.product_image && <img src={item.product_image} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{item.product_name}</p>
              <p className="text-xs text-gray-400">{item.quantity} × ₱{item.price}</p>
            </div>
            <p className="font-semibold text-sm text-gray-700">₱{(item.price * item.quantity).toFixed(0)}</p>
          </div>
        ))}
        <div className="pt-2 border-t border-gray-100 mt-2">
          <div className="flex justify-between font-bold text-gray-800">
            <span>Total (incl. delivery)</span><span>₱{(currentOrder.total + currentOrder.delivery_fee).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-blue-600 mt-1">
            <span>Iyong kita (delivery fee)</span><span>₱{currentOrder.delivery_fee.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Payment Info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
        <h3 className="font-semibold text-gray-800 mb-2">Payment</h3>
        <p className="text-sm text-gray-600">
          {currentOrder.payment_method === 'qr_code' ? 'QR Code (GCash/Maya)' : 'Cash on Delivery'}
        </p>
        {currentOrder.payment_method === 'cod' && (
          <p className="text-xs text-amber-600 mt-1">Kolektahin ang ₱{(currentOrder.total + currentOrder.delivery_fee).toFixed(2)} sa buyer</p>
        )}
      </div>

      {/* Action */}
      {currentOrder.status === 'picked_up' && (
        <button onClick={markDelivered} disabled={updating}
          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-blue-600/20 active:scale-[0.98] transition disabled:opacity-50">
          {updating ? 'Nag-uupdate...' : 'Mark as Delivered'}
        </button>
      )}
    </div>
  );
}

// ============= HISTORY =============
function RiderHistory({ onOrderClick }: { onOrderClick: (o: Order) => void }) {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<(Order & { store: Store; buyer: { full_name: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    supabase.from('orders').select('*, store:stores(*), buyer:profiles!orders_buyer_id_fkey(full_name)')
      .eq('rider_id', profile.id).in('status', ['delivered', 'cancelled']).order('created_at', { ascending: false })
      .then(({ data }) => { setOrders((data || []) as any); setLoading(false); });
  }, [profile]);

  const totalEarnings = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.delivery_fee, 0);

  return (
    <div className="px-5 py-4">
      <h2 className="text-xl font-bold text-gray-800 mb-4">History</h2>

      {orders.length > 0 && (
        <div className="bg-blue-50 rounded-2xl p-4 mb-4">
          <p className="text-sm text-blue-600">Total Kita</p>
          <p className="text-2xl font-bold text-blue-700">₱{totalEarnings.toFixed(2)}</p>
          <p className="text-xs text-blue-400 mt-1">{orders.filter(o => o.status === 'delivered').length} na deliveries</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package size={48} className="mx-auto mb-3 opacity-50" />
          <p>Wala ka pang completed deliveries.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(order => (
            <button key={order.id} onClick={() => onOrderClick(order)}
              className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left active:scale-[0.98] transition">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm text-gray-800">{order.buyer?.full_name || 'Buyer'}</p>
                  <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border ${ORDER_STATUS_COLORS[order.status]}`}>
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{order.store.name}</span>
                <span className="text-sm font-bold text-blue-600">+₱{order.delivery_fee.toFixed(0)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============= PROFILE =============
function RiderProfile({ onSignOut }: { onSignOut: () => void }) {
  const { profile, refreshProfile } = useAuth();
  const [stats, setStats] = useState({ totalDeliveries: 0, totalEarnings: 0 });
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    supabase.from('orders').select('*').eq('rider_id', profile.id).eq('status', 'delivered')
      .then(({ data }) => {
        const orders = data || [];
        setStats({
          totalDeliveries: orders.length,
          totalEarnings: orders.reduce((s, o: any) => s + o.delivery_fee, 0),
        });
      });
  }, [profile]);

  return (
    <div className="px-5 py-4">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Profile ko</h2>
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <Avatar src={profile?.avatar_url} name={profile?.full_name} size={64} className="!bg-blue-100 !text-blue-600" />
          <div>
            <p className="font-bold text-gray-800 text-lg">{profile?.full_name}</p>
            <p className="text-sm text-gray-400">{profile?.email}</p>
            <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Rider</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-800">{stats.totalDeliveries}</p>
            <p className="text-xs text-gray-400">Deliveries</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">₱{stats.totalEarnings.toFixed(0)}</p>
            <p className="text-xs text-gray-400">Kita</p>
          </div>
        </div>
      </div>

      {/* Reviews */}
      {profile && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <h3 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
            <Star size={16} className="text-amber-500" /> Mga Review mula sa Buyers
          </h3>
          <ReviewSection userId={profile.id} />
        </div>
      )}

      {/* Profile Picture Upload */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <ImageUploadField
          label="Profile Picture"
          value={profile?.avatar_url || ''}
          bucket="profile-images"
          folder={`avatars/${profile?.id}`}
          aspectClass="h-32"
          hint="Mag-upload ng larawan para makilala ka ng buyers at sellers. Para sa transparency ng transaction."
          onChange={async (url) => {
            if (!profile) return;
            setAvatarUploading(true);
            await supabase.from('profiles').update({ avatar_url: url || null }).eq('id', profile.id);
            await refreshProfile();
            setAvatarUploading(false);
          }}
        />
        {avatarUploading && <p className="text-xs text-blue-500 mt-1">Nag-a-upload...</p>}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
          <Phone size={16} /><span>{profile?.phone || 'Wala pang numero'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MapPin size={16} /><span>{profile?.barangay}, {profile?.city}, {profile?.region}</span>
        </div>
      </div>

      {/* Shareable Profile URL */}
      {profile?.slug && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Share2 size={18} className="text-blue-600" />
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
              className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center active:scale-95 transition flex-shrink-0"
            >
              <Copy size={16} className="text-blue-600" />
            </button>
            <button
              onClick={() => { window.location.hash = `/u/${profile.slug}`; }}
              className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center active:scale-95 transition flex-shrink-0"
            >
              <ExternalLink size={16} className="text-blue-600" />
            </button>
          </div>
        </div>
      )}

      <button onClick={onSignOut} className="w-full py-3 bg-white text-red-500 border border-red-200 rounded-2xl font-semibold active:scale-[0.98] transition">
        Mag-sign Out
      </button>
    </div>
  );
}

// ============= RIDER BOTTOM NAV =============
function RiderBottomNav({ tab, setTab, riderId, unreadMessages }: { tab: Tab; setTab: (t: Tab) => void; riderId: string; unreadMessages: number }) {
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('rider_id', riderId).in('status', ['picked_up'])
      .then(({ count }) => setActiveCount(count || 0));

    const sub = supabase.channel('rider-nav')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `rider_id=eq.${riderId}` }, () => {
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('rider_id', riderId).in('status', ['picked_up'])
          .then(({ count }) => setActiveCount(count || 0));
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [riderId]);

  const items = [
    { id: 'deliveries' as Tab, icon: Bike, label: 'Deliveries', badge: activeCount + unreadMessages },
    { id: 'history' as Tab, icon: Clock, label: 'History' },
    { id: 'profile' as Tab, icon: User, label: 'Profile' },
  ];

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 px-2 py-1.5 safe-bottom z-50">
      <div className="flex items-center justify-around">
        {items.map(item => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button key={item.id} onClick={() => setTab(item.id)} className="flex flex-col items-center gap-0.5 py-1.5 px-6 relative">
              <div className="relative">
                <Icon size={22} className={active ? 'text-blue-600' : 'text-gray-400'} />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold" style={{ fontSize: 9 }}>
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-xs ${active ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
