import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Store, Product, Profile } from '@/lib/types';
import {
  Fish, MapPin, Star, ShoppingBag, Bike, Store as StoreIcon, ArrowLeft,
  Phone, Clock, Package, TrendingUp, Share2, Copy, Check, User,
} from 'lucide-react';

function useHashRoute() {
  const [route, setRoute] = useState<{ type: string; slug: string } | null>(null);

  useEffect(() => {
    function parse() {
      const hash = window.location.hash.replace(/^#/, '');
      const parts = hash.split('/');
      if (parts.length >= 3 && parts[0] === '' && (parts[1] === 's' || parts[1] === 'u')) {
        setRoute({ type: parts[1], slug: decodeURIComponent(parts[2]) });
      } else {
        setRoute(null);
      }
    }
    parse();
    window.addEventListener('hashchange', parse);
    return () => window.removeEventListener('hashchange', parse);
  }, []);

  return route;
}

export function PublicPages() {
  const route = useHashRoute();

  if (!route) return null;
  if (route.type === 's') return <PublicStorePage slug={route.slug} />;
  if (route.type === 'u') return <PublicUserPage slug={route.slug} />;
  return null;
}

function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  function share() {
    if (navigator.share) {
      navigator.share({ url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={share}
      className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center active:scale-95 transition"
    >
      {copied ? <Check size={20} className="text-green-300" /> : <Share2 size={20} className="text-white" />}
    </button>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-2 w-full px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-600 active:scale-[0.98] transition border border-gray-100"
    >
      {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-gray-400" />}
      <span className="flex-1 text-left truncate">{url}</span>
    </button>
  );
}

// ============= PUBLIC STORE PAGE =============
function PublicStorePage({ slug }: { slug: string }) {
  const { session } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: s } = await supabase.from('stores').select('*').eq('slug', slug).maybeSingle();
      if (!s) { setLoading(false); return; }
      setStore(s as Store);
      const { data: prods } = await supabase.from('products').select('*').eq('store_id', s.id).eq('is_available', true).order('created_at', { ascending: false });
      setProducts(prods || []);
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-5">
        <StoreIcon size={48} className="text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">Hindi nahanap ang tindahan</p>
        <button onClick={() => { window.location.hash = ''; }} className="mt-4 px-6 py-3 bg-brand-600 text-white rounded-xl font-medium">
          Bumalik sa GoPalengke
        </button>
      </div>
    );
  }

  const fullUrl = `${window.location.origin}${window.location.pathname}#/s/${store.slug}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner */}
      <div className="relative h-44 bg-gradient-to-br from-brand-500 to-brand-700">
        {store.banner_url && (
          <img src={store.banner_url} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute top-3 left-3">
          <button onClick={() => { window.location.hash = ''; }} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center active:scale-95 transition">
            <ArrowLeft size={20} className="text-white" />
          </button>
        </div>
        <div className="absolute top-3 right-3">
          <ShareButton url={fullUrl} />
        </div>
      </div>

      {/* Store Info */}
      <div className="px-5 -mt-12 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
          <div className="flex items-start gap-3">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-brand-100 flex-shrink-0">
              {store.logo_url ? (
                <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">🏪</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-800">{store.name}</h1>
              {store.palengke_name && (
                <p className="text-sm text-brand-600 flex items-center gap-1 mt-0.5">
                  <MapPin size={12} /> {store.palengke_name}
                </p>
              )}
              <div className="flex items-center gap-1 mt-1">
                <Star size={14} className="fill-amber-400 text-amber-400" />
                <span className="text-sm font-medium text-gray-700">{store.rating}</span>
                <span className="text-xs text-gray-300">·</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${store.is_open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {store.is_open ? 'Bukas' : 'Sarado'}
                </span>
              </div>
            </div>
          </div>
          {store.description && (
            <p className="text-sm text-gray-500 mt-3">{store.description}</p>
          )}
          <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
            <MapPin size={14} />
            <span>{store.barangay}, {store.city}, {store.region}</span>
          </div>
          <div className="mt-4">
            <CopyLink url={fullUrl} />
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Package size={18} className="text-brand-600" />
          <h2 className="font-bold text-gray-800">Mga Paninda ({products.length})</h2>
        </div>
        {products.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Wala pang available na paninda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="h-28 bg-gray-100 relative">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl opacity-40">📦</div>
                  )}
                  {p.stock <= 5 && p.stock > 0 && (
                    <span className="absolute top-1.5 left-1.5 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">Lang {p.stock} na</span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="font-semibold text-sm text-gray-800 line-clamp-1">{p.name}</p>
                  <p className="font-bold text-brand-600 mt-1">₱{p.price}<span className="text-[10px] text-gray-400 font-normal">/{p.unit}</span></p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      {!session && (
        <div className="px-5 py-6">
          <div className="bg-gradient-to-br from-brand-600 to-brand-700 rounded-2xl p-5 text-center">
            <ShoppingBag size={28} className="text-white mx-auto mb-2" />
            <p className="text-white font-bold">Gusto mo bang umorder dito?</p>
            <p className="text-brand-100 text-sm mt-1">Mag-sign up para makapag-order sa {store.name}!</p>
            <button
              onClick={() => { window.location.hash = ''; }}
              className="mt-3 px-6 py-3 bg-white text-brand-700 rounded-xl font-bold active:scale-95 transition"
            >
              Mag-sign Up
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============= PUBLIC USER PAGE =============
function PublicUserPage({ slug }: { slug: string }) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: p } = await supabase.from('profiles').select('*').eq('slug', slug).maybeSingle();
      if (!p) { setLoading(false); return; }
      setProfile(p as Profile);
      if ((p as Profile).role === 'seller') {
        const { data: s } = await supabase.from('stores').select('*').eq('seller_id', (p as Profile).id).maybeSingle();
        setStore(s as Store | null);
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-5">
        <User size={48} className="text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">Hindi nahanap ang profile</p>
        <button onClick={() => { window.location.hash = ''; }} className="mt-4 px-6 py-3 bg-brand-600 text-white rounded-xl font-medium">
          Bumalik sa GoPalengke
        </button>
      </div>
    );
  }

  const fullUrl = `${window.location.origin}${window.location.pathname}#/u/${profile.slug}`;
  const roleLabel = profile.role === 'buyer' ? 'Mamimili' : profile.role === 'seller' ? 'Tindera/Tindero' : 'Rider';
  const roleIcon = profile.role === 'rider' ? Bike : profile.role === 'seller' ? StoreIcon : ShoppingBag;
  const RoleIcon = roleIcon;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-brand-600 to-brand-700 px-5 pt-12 pb-6 text-white">
        <div className="absolute top-3 left-3">
          <button onClick={() => { window.location.hash = ''; }} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center active:scale-95 transition">
            <ArrowLeft size={20} className="text-white" />
          </button>
        </div>
        <div className="absolute top-3 right-3">
          <ShareButton url={fullUrl} />
        </div>
        <div className="flex flex-col items-center text-center mt-4">
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl font-bold text-white border-2 border-white/30">
            {profile.full_name?.[0]?.toUpperCase() || '?'}
          </div>
          <h1 className="text-xl font-bold mt-3">{profile.full_name}</h1>
          <div className="flex items-center gap-1.5 mt-1">
            <RoleIcon size={14} className="text-brand-200" />
            <span className="text-sm text-brand-100">{roleLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-brand-200">
            <MapPin size={12} />
            <span>{profile.barangay || 'N/A'}, {profile.city || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="px-5 py-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Phone size={16} className="text-gray-400" />
              <span>{profile.phone || 'Walang numero'}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin size={16} className="text-gray-400" />
              <span>{profile.barangay}, {profile.city}, {profile.region}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Clock size={16} className="text-gray-400" />
              <span>Member since {new Date(profile.created_at).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
          <div className="mt-4">
            <CopyLink url={fullUrl} />
          </div>
        </div>

        {/* If seller, link to store */}
        {profile.role === 'seller' && store && (
          <button
            onClick={() => { window.location.hash = `/s/${store.slug}`; }}
            className="w-full mt-3 bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 active:scale-[0.98] transition text-left"
          >
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-brand-100 flex-shrink-0">
              {store.logo_url ? (
                <img src={store.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl">🏪</div>
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-gray-800">{store.name}</p>
              <p className="text-xs text-gray-400">View store page</p>
            </div>
            <ArrowLeft size={18} className="text-gray-300 rotate-180" />
          </button>
        )}

        {/* CTA */}
        {!session && (
          <div className="mt-4 bg-gradient-to-br from-brand-600 to-brand-700 rounded-2xl p-5 text-center">
            <Fish size={28} className="text-white mx-auto mb-2" />
            <p className="text-white font-bold">Sali na ang GoPalengke!</p>
            <p className="text-brand-100 text-sm mt-1">Mag-sign up para makapag-order o magtinda.</p>
            <button
              onClick={() => { window.location.hash = ''; }}
              className="mt-3 px-6 py-3 bg-white text-brand-700 rounded-xl font-bold active:scale-95 transition"
            >
              Mag-sign Up
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
