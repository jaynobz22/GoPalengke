import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Store, Product, ProductCatalog, Order, OrderItem, OrderStatus, Conversation } from '@/lib/types';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, CATALOG_CATEGORIES } from '@/lib/types';
import { getCityMarkets } from '@/lib/philippineLocations';
import { LocationSelector, type LocationData } from '@/components/LocationSelector';
import { compressImage } from '@/lib/imageCompress';
import { ImageUploadField } from '@/components/ImageUploadField';
import { ChatView, getOrCreateConversation } from '@/components/ChatView';
import {
  Store as StoreIcon, Package, Settings, Plus, ArrowLeft, Edit, Trash2, X,
  Star, MapPin, QrCode, Upload, Check, ShoppingBag, Bike, Phone, Clock,
  TrendingUp, DollarSign, Bell, Search, Camera, Loader2, MessageCircle,
  Share2, Copy, ExternalLink,
} from 'lucide-react';

type Tab = 'dashboard' | 'products' | 'orders' | 'settings';

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

  const loadStore = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('stores').select('*').eq('seller_id', profile.id).maybeSingle();
    setStore(data as Store | null);
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadStore(); }, [loadStore]);

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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative">
      <div className="flex-1 pb-20 overflow-y-auto">
        {tab === 'dashboard' && <SellerDashboard store={store} onEditStore={() => setShowStoreForm(true)} />}
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
        {tab === 'settings' && <SellerSettings store={store} onEditStore={() => setShowStoreForm(true)} onSignOut={signOut} />}

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

      <SellerBottomNav tab={tab} setTab={setTab} storeId={store.id} unreadMessages={unreadCount} />
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
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('gcash');
  const [palengkeName, setPalengkeName] = useState('');
  const [palengkeCustom, setPalengkeCustom] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cityMarkets = getCityMarkets(location.city);
  const finalPalengkeName = palengkeName === '__custom__' ? palengkeCustom.trim() : palengkeName;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setCreating(true);
    const { error } = await supabase.from('stores').insert({
      seller_id: profile.id,
      name, description,
      barangay: location.barangay, district: location.district, city: location.city, region: location.region,
      logo_url: logoUrl || null,
      banner_url: bannerUrl || null,
      payment_method: paymentMethod,
      palengke_name: finalPalengkeName || null,
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
        <div>
          <LocationSelector
            value={location}
            onChange={setLocation}
            label="Location ng tindahan"
            compact
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">Pangalan ng Palengke (opsyonal)</label>
          <p className="text-xs text-gray-400 mb-1.5">Kung may pwesto ka sa isang palengke, ilagay ang pangalan nito para puntahan din ng mga buyers.</p>
          <select value={palengkeName} onChange={e => setPalengkeName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-500 outline-none transition text-sm">
            <option value="">Walang pwesto sa palengke</option>
            {cityMarkets.map(m => <option key={m} value={m}>{m}</option>)}
            <option value="__custom__">Iba pa...</option>
          </select>
          {palengkeName === '__custom__' && (
            <input type="text" value={palengkeCustom} onChange={e => setPalengkeCustom(e.target.value)} placeholder="Ilagay ang pangalan ng palengke" autoFocus
              className="w-full px-4 py-3 mt-2 rounded-xl border border-gray-200 bg-white focus:border-brand-500 outline-none transition text-sm" />
          )}
        </div>
        <ImageUploadField
          label="Logo ng Tindahan"
          value={logoUrl}
          onChange={setLogoUrl}
          folder="logos"
          aspectClass="h-32"
          icon={<StoreIcon size={16} />}
        />
        <ImageUploadField
          label="Banner ng Tindahan"
          value={bannerUrl}
          onChange={setBannerUrl}
          folder="banners"
          aspectClass="h-40"
          icon={<StoreIcon size={16} />}
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
function SellerDashboard({ store, onEditStore }: { store: Store; onEditStore: () => void }) {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ totalOrders: 0, pendingOrders: 0, totalRevenue: 0, productCount: 0 });
  const [recentOrders, setRecentOrders] = useState<(Order & { buyer: { full_name: string } })[]>([]);

  useEffect(() => {
    async function load() {
      const [{ data: orders }, { data: products }, { count }] = await Promise.all([
        supabase.from('orders').select('*, buyer:profiles!orders_buyer_id_fkey(full_name)').eq('store_id', store.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('products').select('*').eq('store_id', store.id),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', store.id),
      ]);

      const allOrders = (orders || []) as any;
      const pending = allOrders.filter((o: any) => o.status === 'pending').length;
      const revenue = allOrders.filter((o: any) => o.status !== 'cancelled').reduce((s: number, o: any) => s + o.total, 0);

      setStats({
        totalOrders: count || 0,
        pendingOrders: pending,
        totalRevenue: revenue,
        productCount: products?.length || 0,
      });
      setRecentOrders(allOrders);
    }
    load();
  }, [store.id]);

  return (
    <div>
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-5 pt-12 pb-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <StoreIcon size={20} />
          <span className="text-lg font-bold">{store.name}</span>
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
          <div className={`text-xs px-3 py-1.5 rounded-full ${store.is_open ? 'bg-green-400/30' : 'bg-red-400/30'}`}>
            {store.is_open ? 'Bukas' : 'Sarado'}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 py-4 grid grid-cols-2 gap-3">
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
                  <p className="text-xs text-gray-400">₱{order.total.toFixed(0)} · {new Date(order.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border ${ORDER_STATUS_COLORS[order.status]}`}>
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============= PRODUCTS =============
function SellerProducts({ store, onAdd, onEdit }: { store: Store; onAdd: () => void; onEdit: (p: Product) => void }) {
  const [view, setView] = useState<'mine' | 'catalog'>('mine');
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
    await supabase.from('products').delete().eq('id', p.id);
    load();
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Mga Paninda</h2>
        {view === 'mine' && (
          <button onClick={onAdd} className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center active:scale-90 transition">
            <Plus size={22} className="text-white" />
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4 bg-gray-100 rounded-xl p-1">
        <button onClick={() => setView('mine')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${view === 'mine' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'}`}>
          Ang Paninda Ko
        </button>
        <button onClick={() => setView('catalog')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${view === 'catalog' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'}`}>
          Catalog Library
        </button>
      </div>

      {view === 'mine' ? (
        loading ? (
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
          <div className="space-y-2">
            {products.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                  {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 line-clamp-1">{p.name}</p>
                  <p className="text-brand-600 font-bold text-sm">₱{p.price}<span className="text-xs text-gray-400 font-normal">/{p.unit}</span></p>
                  <p className="text-xs text-gray-400">Stock: {p.stock}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => onEdit(p)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center active:scale-90 transition">
                    <Edit size={16} className="text-gray-600" />
                  </button>
                  <button onClick={() => toggleAvailable(p)} className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition ${p.is_available ? 'bg-green-50' : 'bg-gray-100'}`}>
                    <Check size={16} className={p.is_available ? 'text-green-600' : 'text-gray-400'} />
                  </button>
                  <button onClick={() => deleteProduct(p)} className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center active:scale-90 transition">
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <CatalogBrowser store={store} onAdded={load} />
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
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('categories').select('id, name_fil').order('sort_order').then(({ data }) => setCategories(data || []));
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
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
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
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
      is_available: true,
    };

    if (product) {
      const { error } = await supabase.from('products').update(payload).eq('id', product.id);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('products').insert(payload);
      if (error) { setError(error.message); setSaving(false); return; }
    }

    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end max-w-md mx-auto animate-fade-in">
      <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">{product ? 'I-edit ang Paninda' : 'Magdagdag ng Paninda'}</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={20} className="text-gray-600" />
          </button>
        </div>
        <form onSubmit={save} className="px-5 py-4 space-y-4 pb-8">
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Pangalan ng Paninda</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Galunggong" required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 outline-none transition" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Kategorya</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 outline-none transition">
              <option value="">Pumili...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name_fil}</option>)}
            </select>
          </div>
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
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
            {imageUrl ? (
              <div className="relative">
                <img src={imageUrl} alt="Preview" className="w-full h-40 rounded-xl object-cover" />
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="absolute bottom-2 right-2 bg-black/60 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
                  <Camera size={14} /> Palitan
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-full h-40 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 active:scale-[0.98] transition disabled:opacity-50">
                {uploading ? (
                  <><Loader2 size={28} className="animate-spin" /><span className="text-sm">Naka-compress at nag-uupload...</span></>
                ) : (
                  <><Camera size={28} /><span className="text-sm">Mag-upload ng larawan mula sa phone</span></>
                )}
              </button>
            )}
            <p className="text-xs text-gray-400 mt-1">Auto-compress ang larawan para maliit ang file size.</p>
          </div>
          {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
          <button type="submit" disabled={saving || uploading}
            className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg active:scale-[0.98] transition disabled:opacity-50">
            {saving ? 'Nagsasave...' : product ? 'I-save ang Pagbabago' : 'Magdagdag ng Paninda'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============= CATALOG BROWSER =============
function CatalogBrowser({ store, onAdded }: { store: Store; onAdded: () => void }) {
  const [catalog, setCatalog] = useState<ProductCatalog[]>([]);
  const [existingProducts, setExistingProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selected, setSelected] = useState<ProductCatalog | null>(null);

  const load = useCallback(async () => {
    const [{ data: cat }, { data: prods }] = await Promise.all([
      supabase.from('product_catalog').select('*').order('sort_order'),
      supabase.from('products').select('*').eq('store_id', store.id),
    ]);
    setCatalog(cat || []);
    setExistingProducts(prods || []);
    setLoading(false);
  }, [store.id]);

  useEffect(() => { load(); }, [load]);

  const existingCatalogIds = new Set(existingProducts.map(p => p.catalog_id).filter(Boolean));

  const filtered = catalog.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.name_fil.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'all' || c.category === activeCategory;
    return matchSearch && matchCat;
  });

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}</div>;
  }

  if (selected) {
    return (
      <CatalogProductForm
        catalog={selected}
        store={store}
        existingProduct={existingProducts.find(p => p.catalog_id === selected.id)}
        onBack={() => setSelected(null)}
        onSaved={() => { setSelected(null); load(); onAdded(); }}
      />
    );
  }

  return (
    <div>
      <div className="relative mb-3">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Hanapin ang produkto..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:border-brand-500 outline-none transition text-sm"
        />
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium flex-shrink-0 ${activeCategory === 'all' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
        >
          Lahat
        </button>
        {CATALOG_CATEGORIES.map(cat => (
          <button
            key={cat.slug}
            onClick={() => setActiveCategory(cat.slug)}
            className={`px-4 py-2 rounded-full text-sm font-medium flex-shrink-0 ${activeCategory === cat.slug ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
          >
            {cat.label_fil}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">Walang nahanap na produkto.</p>
        ) : (
          filtered.map(c => {
            const added = existingCatalogIds.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className={`w-full bg-white rounded-2xl border p-3 flex items-center gap-3 text-left active:scale-[0.98] transition ${added ? 'border-green-200' : 'border-gray-100'}`}
              >
                <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                  {c.image_url_1 && <img src={c.image_url_1} alt={c.name} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{c.category} · {c.default_unit}</p>
                </div>
                {added && (
                  <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full flex items-center gap-1">
                    <Check size={12} /> Nasa store
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============= CATALOG PRODUCT FORM =============
function CatalogProductForm({
  catalog, store, existingProduct, onBack, onSaved,
}: {
  catalog: ProductCatalog;
  store: Store;
  existingProduct: Product | undefined;
  onBack: () => void;
  onSaved: () => void;
}) {
  const images = [catalog.image_url_1, catalog.image_url_2, catalog.image_url_3].filter(Boolean) as string[];
  const [selectedImage, setSelectedImage] = useState(existingProduct?.selected_image_index || 1);
  const [price, setPrice] = useState(existingProduct?.price?.toString() || '');
  const [stock, setStock] = useState(existingProduct?.stock?.toString() || '0');
  const [unit, setUnit] = useState(existingProduct?.unit || catalog.default_unit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const selectedUrl = images[selectedImage - 1] || images[0] || null;

    if (existingProduct) {
      const { error } = await supabase.from('products').update({
        selected_image_index: selectedImage,
        price: parseFloat(price),
        unit,
        stock: parseInt(stock) || 0,
        image_url: selectedUrl,
      }).eq('id', existingProduct.id);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('products').insert({
        store_id: store.id,
        catalog_id: catalog.id,
        selected_image_index: selectedImage,
        name: catalog.name,
        description: null,
        price: parseFloat(price),
        unit,
        stock: parseInt(stock) || 0,
        image_url: selectedUrl,
        is_available: true,
      });
      if (error) { setError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h3 className="text-lg font-bold text-gray-800">{catalog.name}</h3>
      </div>

      <div className="mb-4">
        <p className="text-sm font-medium text-gray-600 mb-2">Piliin ang larawan</p>
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedImage(idx + 1)}
              className={`relative rounded-xl overflow-hidden aspect-square transition ${selectedImage === idx + 1 ? 'ring-2 ring-brand-600' : 'ring-1 ring-gray-200'}`}
            >
              <img src={img} alt={`${catalog.name} ${idx + 1}`} className="w-full h-full object-cover" />
              {selectedImage === idx + 1 && (
                <div className="absolute top-1 right-1 w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
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
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-600 mb-1 block">Stock</label>
        <input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="50" required
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 outline-none transition" />
      </div>

      {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg mb-3">{error}</p>}

      <button onClick={save} disabled={saving || !price}
        className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg active:scale-[0.98] transition disabled:opacity-50">
        {saving ? 'Nagsasave...' : existingProduct ? 'I-update' : 'Idagdag sa Store'}
      </button>
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
  const [logoUrl, setLogoUrl] = useState(store.logo_url || '');
  const [bannerUrl, setBannerUrl] = useState(store.banner_url || '');
  const [qrCodeUrl, setQrCodeUrl] = useState(store.qr_code_url || '');
  const [palengkeName, setPalengkeName] = useState(store.palengke_name || '');
  const [palengkeCustom, setPalengkeCustom] = useState('');
  const [isOpen, setIsOpen] = useState(store.is_open);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cityMarkets = getCityMarkets(location.city);
  const finalPalengkeName = palengkeName === '__custom__' ? palengkeCustom.trim() : palengkeName;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('stores').update({
      name, description, barangay: location.barangay, district: location.district, city: location.city, region: location.region,
      logo_url: logoUrl || null, banner_url: bannerUrl || null,
      qr_code_url: qrCodeUrl || null, is_open: isOpen,
      palengke_name: finalPalengkeName || null,
    }).eq('id', store.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end max-w-md mx-auto animate-fade-in">
      <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">I-edit ang Tindahan</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={20} className="text-gray-600" />
          </button>
        </div>
        <form onSubmit={save} className="px-5 py-4 space-y-4 pb-8">
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
            <label className="text-sm font-medium text-gray-600 mb-1 block">Pangalan ng Palengke (opsyonal)</label>
            <p className="text-xs text-gray-400 mb-1.5">Kung may pwesto ka sa isang palengke, ilagay ang pangalan nito.</p>
            <select value={palengkeName} onChange={e => setPalengkeName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-500 outline-none transition text-sm">
              <option value="">Walang pwesto sa palengke</option>
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
          <ImageUploadField
            label="Logo ng Tindahan"
            value={logoUrl}
            onChange={setLogoUrl}
            folder="logos"
            aspectClass="h-32"
            icon={<StoreIcon size={16} />}
          />
          <ImageUploadField
            label="Banner ng Tindahan"
            value={bannerUrl}
            onChange={setBannerUrl}
            folder="banners"
            aspectClass="h-40"
            icon={<StoreIcon size={16} />}
          />
          <ImageUploadField
            label="QR Code (para sa GCash payment)"
            value={qrCodeUrl}
            onChange={setQrCodeUrl}
            folder="qr-codes"
            aspectClass="h-48"
            icon={<QrCode size={16} />}
            hint="I-screenshot ang QR code mo sa GCash app, tapos i-upload dito."
          />
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isOpen} onChange={e => setIsOpen(e.target.checked)} className="w-5 h-5 rounded accent-brand-600" />
              <span className="text-sm font-medium text-gray-700">Bukas ang tindahan</span>
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
    let q = supabase.from('orders').select('*, buyer:profiles!orders_buyer_id_fkey(full_name, phone)').eq('store_id', store.id).order('created_at', { ascending: false });
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
          {orders.map(order => (
            <button key={order.id} onClick={() => onOrderClick(order)}
              className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left active:scale-[0.98] transition">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm text-gray-800">{order.buyer?.full_name || 'Buyer'}</p>
                  <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border ${ORDER_STATUS_COLORS[order.status]}`}>
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">₱{(order.total + order.delivery_fee).toFixed(0)}</span>
                <span className="text-xs text-gray-400">{order.payment_method === 'qr_code' ? 'QR Code' : 'COD'}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============= SELLER ORDER DETAIL =============
function SellerOrderDetail({ order, store, onBack, onOpenChat }: { order: Order; store: Store; onBack: () => void; onOpenChat: (order: Order, buyerName: string) => void }) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [buyer, setBuyer] = useState<{ full_name: string; phone: string | null } | null>(null);
  const [currentOrder, setCurrentOrder] = useState(order);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    supabase.from('order_items').select('*').eq('order_id', order.id).then(({ data }) => setItems(data || []));
    supabase.from('profiles').select('full_name, phone').eq('id', order.buyer_id).maybeSingle().then(({ data }) => setBuyer(data as any));

    const sub = supabase.channel(`seller-order-${order.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` }, (payload: any) => {
        if (payload.new) setCurrentOrder(payload.new as Order);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [order.id]);

  async function updateStatus(status: OrderStatus) {
    setUpdating(true);
    await supabase.from('orders').update({ status }).eq('id', currentOrder.id);
    setCurrentOrder(prev => ({ ...prev, status }));
    setUpdating(false);
  }

  const statusFlow: { status: OrderStatus; label: string }[] = [
    { status: 'accepted', label: 'I-confirm Order' },
    { status: 'preparing', label: 'Simulang Ihanda' },
    { status: 'ready_for_pickup', label: 'Ready for Pickup' },
    { status: 'delivered', label: 'Na-deliver na' },
  ];
  const currentStepIndex = statusFlow.findIndex(s => s.status === currentOrder.status);

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-800">Order Details</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm px-3 py-1 rounded-full border ${ORDER_STATUS_COLORS[currentOrder.status]}`}>
            {ORDER_STATUS_LABELS[currentOrder.status]}
          </span>
          <span className="text-sm text-gray-400">#{order.id.slice(0, 8)}</span>
        </div>
        <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString('en-PH')}</p>
      </div>

      {/* Buyer Info */}
      {buyer && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
          <h3 className="font-semibold text-gray-800 mb-2">Buyer</h3>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{buyer.full_name}</span>
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
          {currentOrder.status !== 'cancelled' && (
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
              {item.product_image && <img src={item.product_image} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{item.product_name}</p>
              <p className="text-xs text-gray-400">{item.quantity} × ₱{item.price}</p>
            </div>
            <p className="font-semibold text-sm text-gray-700">₱{(item.price * item.quantity).toFixed(0)}</p>
          </div>
        ))}
        <div className="pt-2 border-t border-gray-100 mt-2 space-y-1">
          <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>₱{currentOrder.total.toFixed(2)}</span></div>
          <div className="flex justify-between text-sm text-gray-500"><span>Delivery fee</span><span>₱{currentOrder.delivery_fee.toFixed(2)}</span></div>
          <div className="flex justify-between font-bold text-gray-800"><span>Total</span><span>₱{(currentOrder.total + currentOrder.delivery_fee).toFixed(2)}</span></div>
        </div>
      </div>

      {/* Payment QR Code */}
      {currentOrder.payment_method === 'qr_code' && store.qr_code_url && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3 text-center">
          <h3 className="font-semibold text-gray-800 mb-2">QR Code para sa Payment</h3>
          <img src={store.qr_code_url} alt="QR Code" className="w-40 h-40 rounded-xl object-contain mx-auto" />
          <p className="text-sm text-gray-400 mt-2">I-scan ng buyer para mag-bayad</p>
        </div>
      )}

      {/* Action Buttons */}
      {currentOrder.status !== 'delivered' && currentOrder.status !== 'cancelled' && (
        <div className="space-y-2">
          {currentOrder.status === 'pending' && (
            <button onClick={() => updateStatus('accepted')} disabled={updating}
              className="w-full py-3 bg-brand-600 text-white rounded-2xl font-semibold active:scale-[0.98] transition disabled:opacity-50">
              I-confirm ang Order
            </button>
          )}
          {currentStepIndex >= 0 && currentOrder.status !== 'pending' && currentStepIndex < statusFlow.length - 1 && (
            <button onClick={() => updateStatus(statusFlow[currentStepIndex + 1].status)} disabled={updating}
              className="w-full py-3 bg-brand-600 text-white rounded-2xl font-semibold active:scale-[0.98] transition disabled:opacity-50">
              {statusFlow[currentStepIndex + 1].label}
            </button>
          )}
          <button onClick={() => updateStatus('cancelled')} disabled={updating}
              className="w-full py-3 bg-white text-red-500 border border-red-200 rounded-2xl font-semibold active:scale-[0.98] transition disabled:opacity-50">
              Kanselahin ang Order
            </button>
        </div>
      )}
    </div>
  );
}

// ============= SELLER SETTINGS =============
function SellerSettings({ store, onEditStore, onSignOut }: { store: Store; onEditStore: () => void; onSignOut: () => void }) {
  const { profile } = useAuth();
  return (
    <div className="px-5 py-4">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Settings</h2>
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center text-2xl font-bold text-brand-600">
            {profile?.full_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="font-bold text-gray-800">{profile?.full_name}</p>
            <p className="text-sm text-gray-400">{profile?.email}</p>
            <span className="inline-block mt-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Tindera/Tindero</span>
          </div>
        </div>
      </div>

      <button onClick={onEditStore} className="w-full bg-white rounded-2xl border border-gray-100 p-4 mb-2 flex items-center justify-between active:scale-[0.98] transition">
        <div className="flex items-center gap-3">
          <StoreIcon size={20} className="text-gray-500" />
          <span className="font-medium text-gray-700">I-edit ang Tindahan</span>
        </div>
        <ArrowLeft size={18} className="text-gray-300 rotate-180" />
      </button>

      {/* Shareable Store URL */}
      {store.slug && (
        <ShareableLinkSection
          label="Link ng Tindahan"
          url={`${window.location.origin}${window.location.pathname}#/s/${store.slug}`}
          onOpen={() => { window.location.hash = `/s/${store.slug}`; }}
        />
      )}
      {profile?.slug && (
        <ShareableLinkSection
          label="Link ng Profile"
          url={`${window.location.origin}${window.location.pathname}#/u/${profile.slug}`}
          onOpen={() => { window.location.hash = `/u/${profile.slug}`; }}
        />
      )}

      <button onClick={onSignOut} className="w-full bg-white text-red-500 border border-red-200 rounded-2xl font-semibold py-4 active:scale-[0.98] transition mt-4">
        Mag-sign Out
      </button>
    </div>
  );
}

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

// ============= SELLER BOTTOM NAV =============
function SellerBottomNav({ tab, setTab, storeId, unreadMessages }: { tab: Tab; setTab: (t: Tab) => void; storeId: string; unreadMessages: number }) {
  const [newOrders, setNewOrders] = useState(0);

  useEffect(() => {
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', storeId).eq('status', 'pending')
      .then(({ count }) => setNewOrders(count || 0));

    const sub = supabase.channel('seller-nav')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` }, () => {
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', storeId).eq('status', 'pending')
          .then(({ count }) => setNewOrders(count || 0));
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [storeId]);

  const items: { id: Tab; icon: typeof TrendingUp; label: string; badge?: number }[] = [
    { id: 'dashboard', icon: TrendingUp, label: 'Dashboard', badge: unreadMessages },
    { id: 'products', icon: Package, label: 'Paninda' },
    { id: 'orders', icon: ShoppingBag, label: 'Orders', badge: newOrders },
    { id: 'settings', icon: Settings, label: 'Settings' },
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
                <Icon size={22} className={active ? 'text-brand-600' : 'text-gray-400'} />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px]">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-xs ${active ? 'text-brand-600 font-medium' : 'text-gray-400'}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
