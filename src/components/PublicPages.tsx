import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Store, Product, Profile } from '@/lib/types';
import {
  MapPin, Star, ShoppingBag, Bike, Store as StoreIcon, ArrowLeft,
  Phone, Clock, Package, TrendingUp, Share2, Copy, Check, User,
  Shield, UserCheck, IdCard, Home as HomeIcon, Bike as BikeIcon,
} from 'lucide-react';

const SOCIAL_PLATFORMS = [
  { id: 'facebook', name: 'Facebook', color: '#1877F2', shareUrl: (url: string, text: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}` },
  { id: 'instagram', name: 'Instagram', color: '#E4405F', shareUrl: (url: string, text: string) => `https://www.instagram.com/` },
  { id: 'tiktok', name: 'TikTok', color: '#000000', shareUrl: (url: string, text: string) => `https://www.tiktok.com/` },
  { id: 'youtube', name: 'YouTube', color: '#FF0000', shareUrl: (url: string, text: string) => `https://www.youtube.com/` },
  { id: 'viber', name: 'Viber', color: '#7360F2', shareUrl: (url: string, text: string) => `viber://forward?text=${encodeURIComponent(text + ' ' + url)}` },
];

function SocialIcon({ platform, size = 16 }: { platform: string; size?: number }) {
  switch (platform) {
    case 'facebook':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      );
    case 'instagram':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
        </svg>
      );
    case 'tiktok':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.65 3.08-6 2.93-1.79-.09-3.51-.85-4.79-2.1-2.26-2.16-2.57-5.92-.7-8.42 1.17-1.58 3.05-2.56 5.01-2.53.02 1.48-.04 2.96-.06 4.44-.8-.26-1.72-.18-2.44.32-.81.53-1.29 1.5-1.23 2.46.06 1.1 1.02 2.04 2.1 2.18 1.2.17 2.45-.56 2.84-1.72.17-.55.16-1.13.17-1.7.01-3.36-.01-6.71.02-10.07z"/>
        </svg>
      );
    case 'youtube':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      );
    case 'viber':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.398.04C9.47.085 7.66.362 6.357.83c-.99.357-2.137 1.06-2.793 1.72C2.56 3.55 1.892 4.86 1.55 6.18c-.462 1.74-.563 3.49-.563 5.29 0 1.79.1 3.55.56 5.29.34 1.32 1.01 2.63 1.99 3.63.65.66 1.8 1.36 2.79 1.72 1.3.47 3.11.75 5.04.79 1.93-.04 3.74-.32 5.04-.79.99-.36 2.14-1.06 2.79-1.72.98-1 1.65-2.31 1.99-3.63.46-1.74.56-3.5.56-5.29 0-1.8-.1-3.55-.56-5.29-.34-1.32-1.01-2.63-1.99-3.63-.65-.66-1.8-1.363-2.79-1.72-1.3-.468-3.11-.745-5.04-.79zm-.02 2.06c1.66-.04 3.3.22 4.34.6.74.27 1.57.8 2.04 1.28.77.79 1.27 1.81 1.54 2.95.39 1.48.47 3 .47 4.6 0 1.59-.08 3.12-.47 4.6-.27 1.14-.77 2.16-1.54 2.95-.47.48-1.3 1.01-2.04 1.28-1.04.38-2.68.64-4.34.6-1.66.04-3.3-.22-4.34-.6-.74-.27-1.57-.8-2.04-1.28-.77-.79-1.27-1.81-1.54-2.95-.39-1.48-.47-3.01-.47-4.6 0-1.6.08-3.12.47-4.6.27-1.14.77-2.16 1.54-2.95.47-.48 1.3-1.01 2.04-1.28 1.04-.38 2.68-.64 4.34-.6zm-.93 3.42c-.4.02-.72.36-.72.78v3.6c0 .43.35.78.78.78h3.6c.43 0 .78-.35.78-.78 0-.43-.35-.78-.78-.78h-2.04V6.3c0-.43-.35-.78-.78-.78h-.84zm6.5 1.2c-.4 0-.72.32-.72.72v.06c0 .4.32.72.72.72h.06c.4 0 .72-.32.72-.72v-.06c0-.4-.32-.72-.72-.72h-.06zm-12 0c-.4 0-.72.32-.72.72v.06c0 .4.32.72.72.72h.06c.4 0 .72-.32.72-.72v-.06c0-.4-.32-.72-.72-.72h-.06zm12 3c-.4 0-.72.32-.72.72v.06c0 .4.32.72.72.72h.06c.4 0 .72-.32.72-.72v-.06c0-.4-.32-.72-.72-.72h-.06zm-12 0c-.4 0-.72.32-.72.72v.06c0 .4.32.72.72.72h.06c.4 0 .72-.32.72-.72v-.06c0-.4-.32-.72-.72-.72h-.06zm12 3c-.4 0-.72.32-.72.72v.06c0 .4.32.72.72.72h.06c.4 0 .72-.32.72-.72v-.06c0-.4-.32-.72-.72-.72h-.06zm-12 0c-.4 0-.72.32-.72.72v.06c0 .4.32.72.72.72h.06c.4 0 .72-.32.72-.72v-.06c0-.4-.32-.72-.72-.72h-.06z"/>
        </svg>
      );
    default:
      return null;
  }
}

function ProductShareBar({ url, text }: { url: string; text: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-1.5 px-1 border-t border-gray-50">
      {SOCIAL_PLATFORMS.map(p => (
        <a
          key={p.id}
          href={p.shareUrl(url, text)}
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition"
          style={{ backgroundColor: p.color, color: 'white' }}
          aria-label={`Share to ${p.name}`}
        >
          <SocialIcon platform={p.id} size={14} />
        </a>
      ))}
    </div>
  );
}

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

  const fullUrl = `${window.location.origin}/#/s/${store.slug}`;

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
                  {store.is_open ? 'Store Open' : 'Store Closed'}
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
          <h2 className="font-bold text-gray-800">Mga Paninda ({store.is_open ? products.length : 0})</h2>
        </div>
        {!store.is_open ? (
          <div className="text-center py-12 text-gray-400">
            <StoreIcon size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-gray-500">Sarado ang tindahan ngayon.</p>
            <p className="text-xs mt-1">Balikan mo mamaya para makita ang paninda!</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Wala pang available na paninda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map(p => {
              const productUrl = `${window.location.origin}/#/s/${store.slug}`;
              const shareText = `${p.name} - ₱${p.price}/${p.unit} sa ${store.name} | GoPalengke`;
              return (
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
                <ProductShareBar url={productUrl} text={shareText} />
              </div>
              );
            })}
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

  const fullUrl = `${window.location.origin}/#/u/${profile.slug}`;
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

        {/* Rider Verification Details */}
        {profile.role === 'rider' && (
          <div className="mt-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <UserCheck size={18} className="text-blue-600" />
              <h2 className="font-bold text-gray-800 text-sm">Identity Verification</h2>
              {(() => {
                const fields = [profile.rider_age, profile.rider_family_status, profile.rider_residence_address, profile.rider_plate_number, profile.rider_motor_model, profile.rider_valid_id_url];
                const filled = fields.filter(Boolean).length;
                const allFilled = filled === fields.length;
                return allFilled ? (
                  <span className="inline-flex items-center gap-0.5 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-auto">
                    <Shield size={10} /> Verified
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 ml-auto">{filled}/{fields.length} filled</span>
                );
              })()}
            </div>
            <div className="space-y-2.5 text-sm">
              {profile.rider_age && (
                <div className="flex items-center gap-2 text-gray-600">
                  <User size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-gray-400 w-24">Edad</span>
                  <span className="font-medium text-gray-700">{profile.rider_age} taong gulang</span>
                </div>
              )}
              {profile.rider_family_status && (
                <div className="flex items-center gap-2 text-gray-600">
                  <UserCheck size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-gray-400 w-24">Pamilya</span>
                  <span className="font-medium text-gray-700">{profile.rider_family_status}</span>
                </div>
              )}
              {profile.rider_residence_address && (
                <div className="flex items-start gap-2 text-gray-600">
                  <HomeIcon size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-400 w-24">Address</span>
                  <span className="font-medium text-gray-700">{profile.rider_residence_address}</span>
                </div>
              )}
              {profile.rider_plate_number && (
                <div className="flex items-center gap-2 text-gray-600">
                  <BikeIcon size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-gray-400 w-24">Plate No.</span>
                  <span className="font-medium text-gray-700">{profile.rider_plate_number}</span>
                </div>
              )}
              {profile.rider_motor_model && (
                <div className="flex items-center gap-2 text-gray-600">
                  <BikeIcon size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-gray-400 w-24">Motor</span>
                  <span className="font-medium text-gray-700">{profile.rider_motor_model}</span>
                </div>
              )}
              {profile.rider_valid_id_url && (
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <IdCard size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="text-gray-400 text-sm">Valid ID</span>
                  </div>
                  <img
                    src={profile.rider_valid_id_url}
                    alt="Valid ID"
                    className="w-full rounded-xl border border-gray-200 max-h-64 object-contain"
                  />
                </div>
              )}
              {!profile.rider_age && !profile.rider_family_status && !profile.rider_residence_address && !profile.rider_plate_number && !profile.rider_motor_model && !profile.rider_valid_id_url && (
                <p className="text-sm text-gray-400 italic">Hindi pa na-verify ang rider na ito.</p>
              )}
            </div>
          </div>
        )}

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
            <img src="/images/Copilot_20260907_183703.png" alt="GoPalengke" className="w-12 h-12 rounded-xl object-cover mx-auto mb-2" />
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
