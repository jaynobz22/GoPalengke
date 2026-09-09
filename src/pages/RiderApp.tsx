import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { navigate } from '@/lib/router';
import type { Order, OrderItem, Store, Conversation, AdminConversation } from '@/lib/types';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types';
import { estimateDistanceKm, computeDeliveryFee, PER_KM_RATE, BASE_DELIVERY_FEE, getStoreCoords, getDeliveryCoords, type Coords } from '@/lib/deliveryFee';
import { RiderNavigationMap, type NavPhase } from '@/components/RiderNavigationMap';
import { ChatView, getOrCreateConversation } from '@/components/ChatView';
import { Avatar } from '@/components/Avatar';
import { ImageUploadField } from '@/components/ImageUploadField';
import { InactiveBanner } from '@/components/InactiveBanner';
import { ReviewSection } from '@/components/Reviews';
import { OrderStepTracker, type StepInfo } from '@/components/OrderStepTracker';
import { AdminVideoCall } from '@/components/AdminVideoCall';
import { AdminChat } from '@/components/AdminChat';
import { useIncomingAdminCall } from '@/lib/useAdminCall';
import { useAdminConversations } from '@/lib/useAdminChat';
import {
  Bike, Package, User, ArrowLeft, MapPin, Phone, Navigation,
  Store as StoreIcon, Clock, Check, Navigation as NavIcon, MapPinned, MessageCircle,
  Share2, Copy, ExternalLink, Power, Timer, Star, UserCheck, LogOut, Shield,
  QrCode, Download, DollarSign,
} from 'lucide-react';

type Tab = 'deliveries' | 'messages' | 'history' | 'profile';

export function RiderApp() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('deliveries');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [chatPartnerName, setChatPartnerName] = useState('');
  const [chatPartnerRole, setChatPartnerRole] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { incomingCall, adminName, clearCall } = useIncomingAdminCall();
  const [activeAdminCall, setActiveAdminCall] = useState<{ roomId: string; callId: string; otherName: string } | null>(null);
  const { conversations: adminConvs, unreadCount: adminUnread } = useAdminConversations();
  const [activeAdminChat, setActiveAdminChat] = useState<{ conversationId: string; otherName: string } | null>(null);

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

  const totalUnread = unreadCount + adminUnread;

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

  function openChatFromMessages(convId: string, name: string, role: string) {
    setActiveConversationId(convId);
    setChatPartnerName(name);
    setChatPartnerRole(role);
    setShowChat(true);
  }

  const canAct = profile?.is_active ?? true;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative">
      {!canAct && <InactiveBanner />}
      <div className="flex-1 pb-24 overflow-y-auto">
        {tab === 'deliveries' && (
          selectedOrder ? (
            <RiderOrderDetail order={selectedOrder} onBack={() => setSelectedOrder(null)} onOpenChat={openChat} />
          ) : (
            <RiderDeliveries onOrderClick={setSelectedOrder} canAct={canAct} onSignOut={signOut} />
          )
        )}
        {tab === 'messages' && (
          <RiderMessagesView onOpenChat={openChatFromMessages} adminConversations={adminConvs} onOpenAdminChat={(convId, name) => {
            setActiveAdminChat({ conversationId: convId, otherName: name });
          }} />
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
          <div className="fixed inset-0 z-[60] bg-gray-50 max-w-md mx-auto">
            <ChatView
              conversationId={activeConversationId}
              otherName={chatPartnerName}
              otherRole={chatPartnerRole}
              onBack={() => { setShowChat(false); setActiveConversationId(null); }}
            />
          </div>
        )}
      </div>

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

      <RiderBottomNav tab={tab} setTab={(t) => { setTab(t); setSelectedOrder(null); }} riderId={profile?.id || ''} unreadMessages={totalUnread} />
    </div>
  );
}

// Helper: group orders by delivery_group_id (or individual if null)
function groupOrders(orders: (Order & { store: Store; buyer: { full_name: string } })[]) {
  const map = new Map<string, (Order & { store: Store; buyer: { full_name: string } })[]>();
  for (const order of orders) {
    const key = order.delivery_group_id || order.id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(order);
  }
  return Array.from(map.entries()).map(([key, orders]) => ({ key, orders }));
}

// ============= DELIVERIES =============
function RiderDeliveries({ onOrderClick, canAct, onSignOut }: { onOrderClick: (o: Order) => void; canAct: boolean; onSignOut: () => void }) {
  const { profile } = useAuth();
  const [availableOrders, setAvailableOrders] = useState<(Order & { store: Store; buyer: { full_name: string } })[]>([]);
  const [assignedOrders, setAssignedOrders] = useState<(Order & { store: Store; buyer: { full_name: string } })[]>([]);
  const [myOrders, setMyOrders] = useState<(Order & { store: Store; buyer: { full_name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: available }, { data: assigned }, { data: mine }] = await Promise.all([
      supabase.from('orders').select('*, store:stores(*), buyer:profiles!orders_buyer_id_fkey(full_name)')
        .in('status', ['ready_for_pickup']).is('rider_id', null).order('created_at', { ascending: true }),
      supabase.from('orders').select('*, store:stores(*), buyer:profiles!orders_buyer_id_fkey(full_name)')
        .eq('rider_id', profile.id).eq('status', 'ready_for_pickup').order('created_at', { ascending: true }),
      supabase.from('orders').select('*, store:stores(*), buyer:profiles!orders_buyer_id_fkey(full_name)')
        .eq('rider_id', profile.id).in('status', ['picked_up']).order('created_at', { ascending: false }),
    ]);
    setAvailableOrders((available || []) as any);
    setAssignedOrders((assigned || []) as any);
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
    // If this order is part of a delivery group, accept all sibling orders too
    if (order.delivery_group_id) {
      await supabase.from('orders').update({
        rider_id: profile.id,
        status: 'picked_up',
        picked_up_at: new Date().toISOString(),
      }).eq('delivery_group_id', order.delivery_group_id);
    } else {
      await supabase.from('orders').update({
        rider_id: profile.id,
        status: 'picked_up',
        picked_up_at: new Date().toISOString(),
      }).eq('id', order.id);
    }
    load();
  }

  if (loading) {
    return <div className="p-5"><div className="h-32 bg-gray-100 rounded-2xl animate-pulse" /></div>;
  }

  return (
    <div>
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-5 pt-12 pb-6 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bike size={24} />
            <span className="text-xl font-bold">GoPalengke Rider</span>
          </div>
          <button onClick={onSignOut} className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center active:scale-90 transition">
            <LogOut size={18} className="text-white" />
          </button>
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
            {(() => {
              const groups = groupOrders(myOrders);
              return groups.map(group => {
                const isMulti = group.orders.length > 1;
                const first = group.orders[0];
                const totalFee = group.orders.reduce((s, o) => s + o.delivery_fee, 0);
                return (
                  <button key={group.key} onClick={() => onOrderClick(first)}
                    className="w-full bg-white rounded-2xl border border-blue-200 p-4 text-left active:scale-[0.98] transition">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800">{first.buyer?.full_name || 'Buyer'}</p>
                        {isMulti && (
                          <span className="text-[10px] font-bold text-white bg-brand-500 px-2 py-0.5 rounded-full">MULTI-PICKUP</span>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full border ${ORDER_STATUS_COLORS[first.status]}`}>
                        {ORDER_STATUS_LABELS[first.status]}
                      </span>
                    </div>
                    {isMulti ? (
                      <>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                          <StoreIcon size={14} /><span>{group.orders.length} tindahan:</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-1">
                          {group.orders.map((o, i) => (
                            <span key={o.id} className="text-xs text-gray-600 font-medium">
                              {o.store.name}{i < group.orders.length - 1 ? ',' : ''}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <StoreIcon size={14} /><span>{first.store.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <MapPin size={14} /><span>{first.delivery_barangay}, {first.delivery_city}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-gray-400">₱{totalFee.toFixed(0)} ang fee</span>
                      <span className="text-xs text-blue-600 font-medium">Tignan ang details →</span>
                    </div>
                  </button>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Seller-Assigned Orders — orders the seller specifically assigned to this rider */}
      {assignedOrders.length > 0 && (
        <div className="px-5 pb-4">
          <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <UserCheck size={18} className="text-brand-600" />
            Para Sa'yo (Ini-assign ng Seller)
          </h2>
          <div className="space-y-2">
            {(() => {
              const groups = groupOrders(assignedOrders);
              return groups.map(group => {
                const isMulti = group.orders.length > 1;
                const first = group.orders[0];
                const totalFee = group.orders.reduce((s, o) => s + o.delivery_fee, 0);
                return (
                  <div key={group.key} className="bg-white rounded-2xl border-2 border-brand-300 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800">{first.buyer?.full_name || 'Buyer'}</p>
                        {isMulti && (
                          <span className="text-[10px] font-bold text-white bg-brand-500 px-2 py-0.5 rounded-full">MULTI-PICKUP</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">{new Date(first.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                    {isMulti ? (
                      <>
                        <div className="flex flex-wrap gap-1 mb-1">
                          {group.orders.map((o, i) => (
                            <span key={o.id} className="text-xs text-gray-600 font-medium">
                              {o.store.name}{i < group.orders.length - 1 ? ',' : ''}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                          <MapPin size={14} /><span>{first.store.barangay}, {first.store.city}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                          <StoreIcon size={14} /><span>{first.store.name}</span>
                          <MapPin size={14} /><span>{first.store.barangay}, {first.store.city}</span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                      <Navigation size={14} /><span>Deliver to: {first.delivery_barangay}, {first.delivery_city}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">Delivery fee</p>
                        <p className="font-bold text-blue-600">₱{totalFee.toFixed(0)}</p>
                      </div>
                      <button onClick={() => acceptOrder(first)} disabled={!canAct}
                        className="px-6 py-2.5 bg-brand-600 text-white rounded-xl font-semibold active:scale-95 transition disabled:opacity-50">
                        Tanggapin
                      </button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

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
              {(() => {
                const groups = groupOrders(availableOrders);
                return groups.map(group => {
                  const isMulti = group.orders.length > 1;
                  const first = group.orders[0];
                  const totalFee = group.orders.reduce((s, o) => s + o.delivery_fee, 0);
                  return (
                    <div key={group.key} className="bg-white rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800">{first.buyer?.full_name || 'Buyer'}</p>
                          {isMulti && (
                            <span className="text-[10px] font-bold text-white bg-brand-500 px-2 py-0.5 rounded-full">MULTI-PICKUP</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">{new Date(first.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</span>
                      </div>
                      {isMulti ? (
                        <>
                          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            <StoreIcon size={14} /><span>{group.orders.length} tindahan:</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mb-1">
                            {group.orders.map((o, i) => (
                              <span key={o.id} className="text-xs text-gray-600 font-medium">
                                {o.store.name}{i < group.orders.length - 1 ? ',' : ''}
                              </span>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                          <StoreIcon size={14} /><span>{first.store.name}</span>
                          <MapPin size={14} /><span>{first.store.barangay}, {first.store.city}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                        <Navigation size={14} /><span>Deliver to: {first.delivery_barangay}, {first.delivery_city}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-400">Delivery fee</p>
                          <p className="font-bold text-blue-600">₱{totalFee.toFixed(0)}</p>
                        </div>
                        <button onClick={() => acceptOrder(first)} disabled={!canAct}
                          className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold active:scale-95 transition disabled:opacity-50">
                          Tanggapin
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
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
  const [siblingOrders, setSiblingOrders] = useState<(Order & { store: Store })[]>([]);
  const [pickedUpStores, setPickedUpStores] = useState<Set<string>>(new Set());
  const [codRef, setCodRef] = useState(order.cod_payment_reference || '');
  const [showCodPayment, setShowCodPayment] = useState(false);
  const [navPhase, setNavPhase] = useState<NavPhase>('to_store');
  const [liveEarnings, setLiveEarnings] = useState<{ fee: number; distanceKm: number } | null>(null);
  const handleEarningsUpdate = useCallback((fee: number, distanceKm: number) => {
    setLiveEarnings(prev => {
      if (prev && prev.fee === fee && prev.distanceKm === distanceKm) return prev;
      return { fee, distanceKm };
    });
  }, []);

  useEffect(() => {
    supabase.from('order_items').select('*').eq('order_id', order.id).then(({ data }) => setItems(data || []));
    supabase.from('stores').select('*').eq('id', order.store_id).maybeSingle().then(({ data }) => setStore(data as Store | null));
    supabase.from('profiles').select('full_name, phone, avatar_url').eq('id', order.buyer_id).maybeSingle().then(({ data }) => setBuyer(data as any));

    if (order.delivery_group_id) {
      supabase.from('orders').select('*, store:stores(*)').eq('delivery_group_id', order.delivery_group_id)
        .then(({ data }) => { setSiblingOrders((data || []) as any); });
    }

    const sub = supabase.channel(`rider-order-${order.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` }, (payload: any) => {
        if (payload.new) setCurrentOrder(payload.new as Order);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [order.id, order.delivery_group_id]);

  useEffect(() => {
    if (currentOrder.status !== 'picked_up' || !profile) return;

    function startGps() {
      if (!navigator.geolocation) return;
      setGpsActive(true);
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (currentOrder.delivery_group_id) {
            supabase.from('orders').update({ rider_lat: lat, rider_lng: lng }).eq('delivery_group_id', currentOrder.delivery_group_id);
          } else {
            supabase.from('orders').update({ rider_lat: lat, rider_lng: lng }).eq('id', currentOrder.id);
          }
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
  }, [currentOrder.status, currentOrder.id, currentOrder.delivery_group_id, profile]);

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
    if (currentOrder.delivery_group_id) {
      const { error } = await supabase.from('orders').update({ status: 'delivered', rider_lat: null, rider_lng: null }).eq('delivery_group_id', currentOrder.delivery_group_id);
      setUpdating(false);
      if (error) { alert('Hindi ma-update ang status. Subukan ulit.'); return; }
    } else {
      const { error } = await supabase.from('orders').update({ status: 'delivered', rider_lat: null, rider_lng: null }).eq('id', currentOrder.id);
      setUpdating(false);
      if (error) { alert('Hindi ma-update ang status. Subukan ulit.'); return; }
    }
    setCurrentOrder(prev => ({ ...prev, status: 'delivered' }));
  }

  async function submitCodPayment() {
    if (!codRef.trim()) return;
    setUpdating(true);
    await supabase.from('orders').update({
      cod_payment_reference: codRef.trim(),
    }).eq('id', currentOrder.id);
    setCurrentOrder(prev => ({ ...prev, cod_payment_reference: codRef.trim() }));
    setUpdating(false);
    setShowCodPayment(false);
  }

  const isCancelled = currentOrder.status === 'cancelled';
  const isDelivered = currentOrder.status === 'delivered';
  const isCod = currentOrder.payment_method === 'cod';
  const codSubmitted = !!currentOrder.cod_payment_reference;
  const codAccepted = !!currentOrder.cod_payment_accepted_at;

  const allStores: { order: Order & { store: Store } }[] = [
    { order: { ...currentOrder, store: store! } },
    ...siblingOrders.map(s => ({ order: s })),
  ].filter(s => s.order.store);
  const allPickupStoreIds = allStores.map(s => s.order.store_id);
  const allPickedUp = allPickupStoreIds.every(id => pickedUpStores.has(id));
  const totalFee = allStores.reduce((s, o) => s + o.order.delivery_fee, 0);
  const totalAmount = allStores.reduce((s, o) => s + o.order.total + o.order.delivery_fee, 0);

  // Build rider-side step list
  const riderSteps: StepInfo[] = [
    { key: 'accept', label: 'Tanggapin ang Delivery', description: 'Tanggapin ang delivery order at pumunta sa pickup point (store) para kunin ang parcel.', status: 'completed' },
    { key: 'pickup', label: 'Pickup sa Store', description: 'Pumunta sa store at kunin ang order. Kumpirmahin ang pickup sa bawat store.', status: 'completed' },
    { key: 'on_the_way', label: 'On the Way sa Buyer', description: 'Nasa daan ka na papunta sa buyer. Ang GPS location mo ay live na nakikita ng buyer sa mapa.', status: 'completed' },
    { key: 'delivered', label: 'Na-deliver na!', description: 'Na-deliver mo na ang parcel sa buyer. Tapusin ang delivery.', status: 'completed' },
  ];

  let currentStepIndex = 0;
  if (currentOrder.status === 'ready_for_pickup') currentStepIndex = 0;
  else if (currentOrder.status === 'picked_up') {
    currentStepIndex = allPickedUp ? 2 : 1;
  }
  else if (currentOrder.status === 'delivered') currentStepIndex = 3;

  riderSteps.forEach((s, i) => {
    s.status = i < currentStepIndex ? 'completed' : i === currentStepIndex ? 'active' : 'pending';
  });

  // Add COD payment step if COD
  if (isCod) {
    riderSteps.push({
      key: 'cod_payment',
      label: 'Magpadala ng Payment sa Seller',
      description: codAccepted
        ? 'Na-tanggap na ng seller ang COD payment. Tapos na ang transaction!'
        : codSubmitted
          ? 'Nai-submit na ang reference number. Naghihintay ng confirmation ng seller.'
          : 'I-scan ang QR code ng seller, ipadala ang bayad, at i-submit ang reference number.',
      status: codAccepted ? 'completed' : codSubmitted ? 'active' : 'pending',
    });
    if (codAccepted) currentStepIndex = 4;
    else if (codSubmitted) currentStepIndex = 4;
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

      {/* Collapsible Step Tracker */}
      {!isCancelled && (
        <div className="mb-3">
          <OrderStepTracker steps={riderSteps} currentStepIndex={currentStepIndex} />
        </div>
      )}
      {isCancelled && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-3 text-center">
          <p className="text-sm font-semibold text-red-700">Nakansela ang order na ito.</p>
        </div>
      )}

      {/* Timer when picked up */}
      {currentOrder.status === 'picked_up' && currentOrder.picked_up_at && (
        <div className={`p-3 rounded-xl flex items-center gap-3 mb-3 ${isOverdue ? 'bg-red-50' : 'bg-blue-50'}`}>
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

      {/* COD Payment Section — shown after delivery */}
      {isDelivered && isCod && !codAccepted && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={20} className="text-amber-600" />
            <p className="font-semibold text-sm text-amber-800">COD Payment — Ipadala sa Seller</p>
          </div>
          {codSubmitted ? (
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700">Nai-submit na ang reference number. Naghihintay ng confirmation ng seller.</p>
            </div>
          ) : showCodPayment && store?.qr_code_url ? (
            <div>
              <p className="text-xs text-amber-700 mb-3">I-scan ang QR code ng seller sa GCash/Maya, ipadala ang <strong>₱{totalAmount.toFixed(2)}</strong>, at i-submit ang reference number.</p>
              <div className="bg-gray-50 rounded-xl p-4 flex justify-center mb-3">
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
                className="w-full mb-3 py-2.5 bg-brand-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
              >
                <Download size={16} /> I-download ang QR Code
              </button>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Reference Number</label>
              <input
                type="text"
                value={codRef}
                onChange={(e) => setCodRef(e.target.value)}
                placeholder="Hal. 1234567890 o Gcash Ref#"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500 transition mb-3"
              />
              <button
                onClick={submitCodPayment}
                disabled={updating || !codRef.trim()}
                className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
              >
                <Check size={18} /> {updating ? 'Nagse-send...' : 'I-submit ang Reference'}
              </button>
            </div>
          ) : !showCodPayment ? (
            <button
              onClick={() => setShowCodPayment(true)}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <QrCode size={18} /> Magbayad sa Seller
            </button>
          ) : (
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <p>Hindi nag-upload ang seller ng QR code. Makipag-ugnayan sa seller.</p>
            </div>
          )}
        </div>
      )}

      {/* COD accepted confirmation */}
      {isDelivered && isCod && codAccepted && (
        <div className="bg-green-50 border border-green-300 rounded-2xl p-4 mb-3 flex items-center gap-2">
          <Check size={18} className="text-green-600" />
          <p className="text-sm text-green-700 font-medium">Na-tanggap na ng seller ang COD payment. Tapos na ang transaction!</p>
        </div>
      )}

      {/* In-App Navigation Map */}
      {currentOrder.status === 'picked_up' && store && (() => {
        const sCoords = getStoreCoords(store);
        const bCoords = getDeliveryCoords({
          lat: currentOrder.delivery_lat,
          lng: currentOrder.delivery_lng,
          barangay: currentOrder.delivery_barangay,
          city: currentOrder.delivery_city,
          region: currentOrder.delivery_region,
        });
        if (!sCoords || !bCoords) {
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3">
              <p className="text-sm text-amber-700">Hindi available ang coordinates para sa navigation. Gumamit ng address sa ibaba.</p>
            </div>
          );
        }
        return (
          <div className="mb-3">
            <RiderNavigationMap
              phase={navPhase}
              storeCoords={sCoords}
              storeName={store.name}
              buyerCoords={bCoords}
              buyerName={buyer?.full_name || 'Buyer'}
              onPhaseChange={(p) => setNavPhase(p)}
              onEarningsUpdate={handleEarningsUpdate}
            />
          </div>
        );
      })()}

      {/* Route Info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <NavIcon size={18} className="text-blue-600" /> Route
          {siblingOrders.length > 0 && (
            <span className="text-[10px] font-bold text-white bg-brand-500 px-2 py-0.5 rounded-full">MULTI-PICKUP</span>
          )}
        </h3>
        {allStores.map((s, idx) => {
          const isPickedUp = pickedUpStores.has(s.order.store_id);
          const storeData = s.order.store;
          return (
            <div key={s.order.id}>
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isPickedUp ? 'bg-green-100' : 'bg-brand-100'}`}>
                  {isPickedUp ? <Check size={16} className="text-green-600" /> : <StoreIcon size={16} className="text-brand-600" />}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 font-medium">PICKUP {allStores.length > 1 ? `${idx + 1} ng ${allStores.length}` : ''}</p>
                  <p className="font-semibold text-sm text-gray-800">{storeData.name}</p>
                  <p className="text-sm text-gray-500">{storeData.barangay}, {storeData.city}, {storeData.region}</p>
                  {currentOrder.status === 'picked_up' && !isPickedUp && (
                    <button
                      onClick={() => {
                        setPickedUpStores(prev => new Set(prev).add(s.order.store_id));
                      }}
                      className="mt-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-semibold active:scale-95 transition"
                    >
                      Nakuha ko na dito
                    </button>
                  )}
                </div>
              </div>
              {idx < allStores.length - 1 && <div className="ml-4 w-0.5 h-6 bg-gray-200 mb-1" />}
            </div>
          );
        })}
        <div className="ml-4 w-0.5 h-6 bg-gray-200 mb-1" />
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <MapPinned size={16} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-medium">DROPOFF</p>
            <p className="font-semibold text-sm text-gray-800">{buyer?.full_name || 'Buyer'}</p>
            <p className="text-sm text-gray-500">{currentOrder.delivery_address}</p>
            <p className="text-sm text-gray-500">{currentOrder.delivery_barangay}, {currentOrder.delivery_city}, {currentOrder.delivery_region}</p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-around">
          <div className="text-center">
            <p className="text-xs text-gray-400">{liveEarnings ? 'Live Distance' : 'Estimated Distance'}</p>
            <p className="font-bold text-gray-800">{liveEarnings ? `${liveEarnings.distanceKm} km` : `~${estimatedKm} km`}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Estimated Time</p>
            <p className="font-bold text-gray-800">{sameCity ? '10-15 min' : '20-30 min'}</p>
          </div>
        </div>
      </div>

      {/* Contact Buyer */}
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
          {!isCancelled && (
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
        {siblingOrders.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-50">
            <p className="text-xs font-medium text-gray-400 mb-2">Iba pang tindahan sa order na ito:</p>
            {siblingOrders.map(sib => (
              <div key={sib.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <StoreIcon size={14} className="text-gray-400" />
                  <span className="text-sm text-gray-600">{sib.store.name}</span>
                </div>
                <span className="text-sm text-gray-500">₱{sib.total.toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="pt-2 border-t border-gray-100 mt-2">
          <div className="flex justify-between font-bold text-gray-800">
            <span>Total (incl. delivery)</span><span>₱{totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-blue-600 mt-1">
            <span>Iyong kita (delivery fee)</span>
            <span>₱{liveEarnings ? liveEarnings.fee.toFixed(2) : totalFee.toFixed(2)}</span>
          </div>
          {liveEarnings && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live na na-update base sa aktwal na ruta
            </p>
          )}
        </div>
      </div>

      {/* Payment Info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
        <h3 className="font-semibold text-gray-800 mb-2">Payment</h3>
        <p className="text-sm text-gray-600">
          {currentOrder.payment_method === 'qr_code' ? 'QR Code (GCash/Maya) — Paid by buyer' : 'Cash on Delivery'}
        </p>
        {isCod && (
          <p className="text-xs text-amber-600 mt-1">Kolektahin ang ₱{totalAmount.toFixed(2)} sa buyer, ipadala sa seller via QR code.</p>
        )}
      </div>

      {/* Mark as Delivered button */}
      {currentOrder.status === 'picked_up' && (
        allPickedUp ? (
          <button onClick={markDelivered} disabled={updating}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-blue-600/20 active:scale-[0.98] transition disabled:opacity-50 mb-3">
            {updating ? 'Nag-uupdate...' : 'Mark as Delivered'}
          </button>
        ) : (
          <div className="w-full py-4 bg-gray-100 text-gray-400 rounded-2xl font-semibold text-lg text-center mb-3">
            Kumpirmahin muna lahat ng pickup ({pickedUpStores.size}/{allPickupStoreIds.length})
          </div>
        )
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
  const [idUploading, setIdUploading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    rider_age: '',
    rider_family_status: '',
    rider_residence_address: '',
    rider_plate_number: '',
    rider_motor_model: '',
  });

  useEffect(() => {
    if (!profile) return;
    setFormData({
      rider_age: profile.rider_age?.toString() || '',
      rider_family_status: profile.rider_family_status || '',
      rider_residence_address: profile.rider_residence_address || '',
      rider_plate_number: profile.rider_plate_number || '',
      rider_motor_model: profile.rider_motor_model || '',
    });
  }, [profile]);

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

  const verificationFields = [
    { key: 'rider_age', label: 'Edad', value: profile?.rider_age },
    { key: 'rider_family_status', label: 'Pamilya', value: profile?.rider_family_status },
    { key: 'rider_residence_address', label: 'Totoong Address', value: profile?.rider_residence_address },
    { key: 'rider_plate_number', label: 'Plate Number', value: profile?.rider_plate_number },
    { key: 'rider_motor_model', label: 'Model ng Motor', value: profile?.rider_motor_model },
    { key: 'rider_valid_id_url', label: 'Valid ID', value: profile?.rider_valid_id_url },
  ];
  const filledCount = verificationFields.filter(f => f.value).length;
  const isVerified = filledCount === verificationFields.length;

  async function saveVerification() {
    if (!profile) return;
    setSaving(true);
    await supabase.from('profiles').update({
      rider_age: formData.rider_age ? parseInt(formData.rider_age) : null,
      rider_family_status: formData.rider_family_status || null,
      rider_residence_address: formData.rider_residence_address || null,
      rider_plate_number: formData.rider_plate_number || null,
      rider_motor_model: formData.rider_motor_model || null,
    }).eq('id', profile.id);
    await refreshProfile();
    setSaving(false);
    setEditMode(false);
  }

  return (
    <div className="px-5 py-4 pb-28">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Profile ko</h2>
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <Avatar src={profile?.avatar_url} name={profile?.full_name} size={64} className="!bg-blue-100 !text-blue-600" />
          <div>
            <p className="font-bold text-gray-800 text-lg">{profile?.full_name}</p>
            <p className="text-sm text-gray-400">{profile?.email}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-block text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Rider</span>
              {isVerified && (
                <span className="inline-flex items-center gap-0.5 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  <Shield size={10} /> Verified
                </span>
              )}
            </div>
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

      {/* Profile Picture Upload with face-match note */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <ImageUploadField
          label="Profile Picture"
          value={profile?.avatar_url || ''}
          bucket="profile-images"
          folder={`avatars/${profile?.id}`}
          aspectClass="h-32"
          hint="Mag-upload ng larawan para makilala ka ng buyers at sellers."
          onChange={async (url) => {
            if (!profile) return;
            setAvatarUploading(true);
            await supabase.from('profiles').update({ avatar_url: url || null }).eq('id', profile.id);
            await refreshProfile();
            setAvatarUploading(false);
          }}
        />
        {avatarUploading && <p className="text-xs text-blue-500 mt-1">Nag-a-upload...</p>}
        <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <Shield size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            <span className="font-semibold">Mahalaga:</span> Ang mukha mo sa profile picture ay dapat malinaw at tugma sa larawan sa Valid ID mo. Hindi pwedeng naka-shades, naka-mask, o malabo ang mukha.
          </p>
        </div>
      </div>

      {/* Identity Verification Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <UserCheck size={16} className="text-blue-600" /> Identity Verification
          </h3>
          <span className="text-xs text-gray-400">{filledCount}/{verificationFields.length} filled</span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isVerified ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${(filledCount / verificationFields.length) * 100}%` }}
          />
        </div>

        {!editMode ? (
          <>
            <div className="space-y-2.5">
              {verificationFields.map(field => (
                <div key={field.key} className="flex items-start justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    {field.value ? (
                      <Check size={14} className="text-green-500 flex-shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    )}
                    {field.label}
                  </span>
                  <span className={`text-right max-w-[60%] truncate ${field.value ? 'text-gray-700 font-medium' : 'text-gray-300 italic'}`}>
                    {field.key === 'rider_valid_id_url'
                      ? (field.value ? 'Na-upload na' : 'Wala pa')
                      : (field.value || 'Wala pa')}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setEditMode(true)}
              className="w-full mt-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl font-semibold text-sm active:scale-[0.98] transition"
            >
              {filledCount > 0 ? 'I-edit ang Details' : 'Mag-fill ng Details'}
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 font-medium">Edad</label>
              <input
                type="number"
                value={formData.rider_age}
                onChange={e => setFormData({ ...formData, rider_age: e.target.value })}
                placeholder="Hal. 28"
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Pamilya (mayroon ba?)</label>
              <input
                type="text"
                value={formData.rider_family_status}
                onChange={e => setFormData({ ...formData, rider_family_status: e.target.value })}
                placeholder="Hal. May asawa at 2 anak"
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Totoong Residence Address</label>
              <textarea
                value={formData.rider_residence_address}
                onChange={e => setFormData({ ...formData, rider_residence_address: e.target.value })}
                placeholder="Hal. 123 Rizal St, Brgy. San Roque, Davao City"
                rows={2}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Plate Number ng Motor</label>
              <input
                type="text"
                value={formData.rider_plate_number}
                onChange={e => setFormData({ ...formData, rider_plate_number: e.target.value })}
                placeholder="Hal. ABC 1234"
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Model ng Motor</label>
              <input
                type="text"
                value={formData.rider_motor_model}
                onChange={e => setFormData({ ...formData, rider_motor_model: e.target.value })}
                placeholder="Hal. Honda Beat 2023"
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditMode(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-semibold text-sm active:scale-[0.98] transition"
              >
                Cancel
              </button>
              <button
                onClick={saveVerification}
                disabled={saving}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition disabled:opacity-50"
              >
                {saving ? 'Nagsasave...' : 'I-save'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Valid ID Upload */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <ImageUploadField
          label="Valid ID (Driver's License, UMID, Passport, etc.)"
          value={profile?.rider_valid_id_url || ''}
          bucket="profile-images"
          folder={`valid-ids/${profile?.id}`}
          aspectClass="h-40"
          hint="I-upload ang litrato ng valid ID mo. Makikita ito ng buyers sa profile mo para sa kanilang safety."
          onChange={async (url) => {
            if (!profile) return;
            setIdUploading(true);
            await supabase.from('profiles').update({ rider_valid_id_url: url || null }).eq('id', profile.id);
            await refreshProfile();
            setIdUploading(false);
          }}
        />
        {idUploading && <p className="text-xs text-blue-500 mt-1">Nag-a-upload...</p>}
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
              onClick={() => navigate(`/u/${profile.slug}`)}
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

// ============= RIDER MESSAGES VIEW =============
function RiderMessagesView({ onOpenChat, adminConversations, onOpenAdminChat }: { onOpenChat: (convId: string, name: string, role: string) => void; adminConversations: AdminConversation[]; onOpenAdminChat: (convId: string, name: string) => void }) {
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
        .eq('rider_id', userId)
        .order('updated_at', { ascending: false });
      if (!convs) { setLoading(false); return; }

      const enriched = await Promise.all((convs as Conversation[]).map(async (conv) => {
        const { data: buyer } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', conv.buyer_id)
          .maybeSingle();
        const otherName = buyer?.full_name || 'Buyer';
        const otherRole = 'Buyer';
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
    const sub = supabase.channel('rider-messages-list')
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
    const sub = supabase.channel('rider-admin-msgs')
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
          <p className="text-sm">Wala pang messages. Makikipag-chat ka kapag may tinanggap ka nang order!</p>
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
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-100">
                <User size={20} className="text-brand-600" />
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
    { id: 'deliveries' as Tab, icon: Bike, label: 'Deliveries', badge: activeCount },
    { id: 'messages' as Tab, icon: MessageCircle, label: 'Messages', badge: unreadMessages },
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
            <button key={item.id} onClick={() => setTab(item.id)} className="flex flex-col items-center gap-0.5 py-1.5 px-3 relative">
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
