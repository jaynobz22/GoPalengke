import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Store, Product, Category, Announcement } from '@/lib/types';
import {
  MapPin, Star, Plus, ArrowRight, ShoppingBag, Bike, Store as StoreIcon,
  Truck, Shield, Clock, ChevronRight, Sparkles, TrendingUp, Megaphone,
} from 'lucide-react';

export function LandingPage({ onGetStarted }: { onGetStarted?: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<(Product & { store: Store })[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: cats }, { data: prods }, { data: strs }] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('products').select('*, store:stores(*)').eq('is_available', true).order('created_at', { ascending: false }).limit(12),
        supabase.from('stores').select('*').eq('is_verified', true).eq('is_open', true).order('rating', { ascending: false }).limit(10),
      ]);
      setCategories(cats || []);
      setProducts(((prods || []) as any).filter((p: any) => p.store?.is_verified && p.store?.is_open));
      setStores(strs || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <HeroSection onGetStarted={onGetStarted} />
      <StatsBar storeCount={stores.length} productCount={products.length} />
      <CategorySection categories={categories} />
      <FeaturedStores stores={stores} loading={loading} onGetStarted={onGetStarted} />
      <FreshProducts products={products} loading={loading} onGetStarted={onGetStarted} />
      <HowItWorks />
      <WhySection />
      <CTASection onGetStarted={onGetStarted} />
      <Footer />
    </div>
  );
}

// ============= HERO =============
function HeroSection({ onGetStarted }: { onGetStarted?: () => void }) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const slides = [
    { src: '/images/Copilot_20260906_113445.png', alt: 'Tindera ng sariwang seafood sa palengke' },
    { src: '/images/Copilot_20260906_114051.png', alt: 'Tindero ng sariwang isda sa palengke' },
    { src: '/images/Copilot_20260906_115019.png', alt: 'Tindero ng sariwang karne sa palengke' },
    { src: '/images/Copilot_20260906_115256.png', alt: 'Tindera ng sariwang gulay at karne sa palengke' },
    { src: '/images/Copilot_20260906_115828.png', alt: 'Tindera ng sariwang prutas at grocery products sa palengke' },
  ];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 7500);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  useEffect(() => {
    async function loadAnnouncement() {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setAnnouncement(data as Announcement | null);
    }
    loadAnnouncement();

    const sub = supabase
      .channel('announcements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, loadAnnouncement)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800">
      <div className="absolute top-10 left-10 w-40 h-40 bg-brand-400/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-10 right-10 w-56 h-56 bg-brand-300/10 rounded-full blur-3xl animate-float-slow" />

      {/* Desktop nav bar */}
      <nav className="hidden md:flex relative max-w-6xl mx-auto px-6 pt-6 pb-2 items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          <img src="/images/Copilot_20260907_183703.png" alt="GoPalengke" className="w-10 h-10 rounded-xl object-cover" />
          <span className="text-xl font-bold text-white tracking-tight">GoPalengke</span>
        </div>
        {/* Announcement bar — same level as logo and sign-in/sign-up */}
        {announcement && (
          <div className="flex-1 max-w-md bg-amber-400/90 backdrop-blur-sm rounded-full overflow-hidden flex items-center gap-2 px-4 py-1.5">
            <Megaphone size={14} className="text-amber-900 flex-shrink-0" />
            <div className="overflow-hidden flex-1">
              <div className="animate-marquee whitespace-nowrap text-xs font-medium text-amber-900">
                {announcement.message}
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={onGetStarted} className="px-5 py-2 text-white/90 text-sm font-medium hover:text-white transition">
            Mag-sign In
          </button>
          <button onClick={onGetStarted} className="px-5 py-2.5 bg-white text-brand-700 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl active:scale-95 transition flex items-center gap-1.5">
            <ShoppingBag size={16} /> Mag-sign Up
          </button>
        </div>
      </nav>

      {/* Mobile logo + announcement */}
      <div className="md:hidden relative px-5 pt-14 pb-2 flex items-center gap-2 animate-slide-in-left">
        <img src="/images/Copilot_20260907_183703.png" alt="GoPalengke" className="w-11 h-11 rounded-2xl object-cover flex-shrink-0" />
        <span className="text-2xl font-bold text-white tracking-tight flex-shrink-0">GoPalengke</span>
        {announcement && (
          <div className="flex-1 bg-amber-400/90 backdrop-blur-sm rounded-full overflow-hidden flex items-center gap-1.5 px-3 py-1">
            <Megaphone size={12} className="text-amber-900 flex-shrink-0" />
            <div className="overflow-hidden flex-1">
              <div className="animate-marquee whitespace-nowrap text-[10px] font-medium text-amber-900">
                {announcement.message}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="relative w-full px-5 md:px-8 lg:px-10 pb-10 md:pb-14 pt-4 md:pt-8">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center max-w-[1440px] mx-auto">
          <div className="order-1 animate-fade-in">
            <div className="relative h-56 sm:h-72 md:h-[360px] lg:h-[430px] overflow-hidden rounded-2xl md:rounded-none border border-brand-300/40 shadow-2xl">
              {slides.map((slide, index) => (
                <img
                  key={slide.src}
                  src={slide.src}
                  alt={slide.alt}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${index === activeSlide ? 'opacity-100' : 'opacity-0'}`}
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
              ))}
              <div className="absolute inset-0 bg-gradient-to-t from-brand-900/35 via-transparent to-brand-900/10" />
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                {slides.map((slide, index) => (
                  <button
                    key={slide.src}
                    type="button"
                    aria-label={`Ipakita ang larawan ${index + 1}`}
                    onClick={() => setActiveSlide(index)}
                    className={`h-1.5 rounded-full transition-all ${index === activeSlide ? 'w-6 bg-white' : 'w-1.5 bg-white/60'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="order-2 text-center md:text-left">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.08] mb-4 animate-slide-in-up" style={{ animationDelay: '0.1s' }}>
              The First
              <br />
              <span className="text-yellow-300">Online Wet</span>
              <br />
              <span className="text-yellow-300">Market</span> in the
              <br />
              Philippines
            </h1>
            <p className="text-brand-100 text-base md:text-lg max-w-xl animate-slide-in-up" style={{ animationDelay: '0.2s' }}>
              Sariwang Isda, Karne, Gulay, Prutas at marami pang iba, galing sa Palengke na pinaka malapit, i-deliver sa bahay nyo!
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8 md:mt-10 animate-slide-in-up" style={{ animationDelay: '0.3s' }}>
          <button
            onClick={onGetStarted}
            className="w-full sm:w-auto min-w-64 px-8 py-4 bg-white text-brand-700 rounded-2xl font-bold text-base shadow-xl active:scale-[0.98] transition flex items-center justify-center gap-2 animate-pulse-glow"
          >
            <ShoppingBag size={20} />
            Magsimula — Mag-sign Up
            <ArrowRight size={18} />
          </button>
          <button
            onClick={onGetStarted}
            className="w-full sm:w-auto min-w-64 px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-2xl font-semibold text-base border border-white/20 active:scale-[0.98] transition"
          >
            May account na? Mag-sign In
          </button>
        </div>

        <div className="flex items-center justify-center gap-4 md:gap-6 mt-6 animate-slide-in-up" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center gap-1.5 text-brand-100 text-xs md:text-sm">
            <Shield size={14} /> Safe & Secure
          </div>
          <div className="flex items-center gap-1.5 text-brand-100 text-xs md:text-sm">
            <Bike size={14} /> Fast Delivery
          </div>
          <div className="flex items-center gap-1.5 text-brand-100 text-xs md:text-sm">
            <Sparkles size={14} /> Fresh Daily
          </div>
        </div>
      </div>

      {/* Wave bottom */}
      <div className="relative">
        <svg viewBox="0 0 375 40" className="w-full block" preserveAspectRatio="none">
          <path d="M0,20 C60,40 120,0 187.5,20 C255,40 315,0 375,20 L375,40 L0,40 Z" fill="#f9fafb" />
        </svg>
      </div>
    </div>
  );
}

// ============= STATS BAR =============
function StatsBar({ storeCount, productCount }: { storeCount: number; productCount: number }) {
  const stats = [
    { icon: StoreIcon, label: 'Mga Tindahan', value: storeCount || '—', suffix: '' },
    { icon: ShoppingBag, label: 'Paninda', value: productCount || '—', suffix: '' },
    { icon: Bike, label: 'Riders', value: '24/7', suffix: '' },
    { icon: MapPin, label: 'Palengke', value: 'NCR', suffix: '+' },
  ];

  return (
    <div className="px-5 md:px-6 py-5 -mt-2 max-w-6xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 grid grid-cols-4 divide-x divide-gray-100 max-w-2xl md:max-w-3xl mx-auto">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="flex flex-col items-center py-3 md:py-4 animate-scale-pop" style={{ animationDelay: `${0.5 + i * 0.1}s` }}>
              <Icon size={20} className="text-brand-600 mb-1" />
              <span className="text-base md:text-lg font-bold text-gray-800">{s.value}{s.suffix}</span>
              <span className="text-[10px] md:text-xs text-gray-400">{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============= CATEGORIES =============
function CategorySection({ categories }: { categories: Category[] }) {
  return (
    <div className="py-4 max-w-6xl mx-auto">
      {/* Trust Headline */}
      <div className="px-5 md:px-6 mb-4">
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-2xl px-4 py-3 shadow-sm">
          <p className="text-white font-bold text-base md:text-lg leading-snug text-center">
            All vendors are verified via video call kaya sure na legit at safe ka!
          </p>
        </div>
      </div>

      {/* Scrolling category marquee */}
      <div className="overflow-hidden">
        <div className="flex gap-3 animate-marquee-slow w-max px-5 md:px-6">
          {[...categories, ...categories].map((cat, i) => (
            <div
              key={`${cat.id}-${i}`}
              className="bg-white rounded-2xl border border-gray-100 p-3 md:p-4 flex flex-col items-center gap-2 flex-shrink-0 w-20 md:w-24"
            >
              <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center text-2xl">
                <CategoryEmoji slug={cat.slug} />
              </div>
              <span className="text-xs font-medium text-gray-600 text-center leading-tight">{cat.name_fil}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryEmoji({ slug }: { slug: string }) {
  switch (slug) {
    case 'fish-seafood': return <span>🐟</span>;
    case 'meat': return <span>🥩</span>;
    case 'vegetables': return <span>🥬</span>;
    case 'fruits': return <span>🍎</span>;
    case 'poultry': return <span>🥚</span>;
    case 'rice-grains': return <span>🌾</span>;
    case 'condiments-spices': return <span>🧂</span>;
    case 'dried-goods': return <span>🐟</span>;
    case 'noodles-pasta': return <span>🍜</span>;
    case 'eggs': return <span>🥚</span>;
    case 'frozen-goods': return <span>🧊</span>;
    case 'bakery': return <span>🍞</span>;
    case 'beverages': return <span>🥤</span>;
    case 'snacks-sweets': return <span>🍪</span>;
    case 'household-items': return <span>🧴</span>;
    case 'general-merchandise': return <span>📦</span>;
    default: return <span>📦</span>;
  }
}

// ============= FEATURED STORES =============
function FeaturedStores({ stores, loading, onGetStarted }: { stores: Store[]; loading: boolean; onGetStarted?: () => void }) {
  if (loading) {
    return (
      <div className="px-5 md:px-6 py-4 max-w-6xl mx-auto">
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map(i => <div key={i} className="w-40 h-36 bg-gray-100 rounded-2xl animate-pulse flex-shrink-0" />)}
        </div>
      </div>
    );
  }

  if (stores.length === 0) return null;

  return (
    <div className="py-4 max-w-6xl mx-auto">
      <div className="px-5 md:px-6 flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StoreIcon size={18} className="text-brand-600" />
          <h2 className="text-lg md:text-2xl font-bold text-gray-800">Mga Tindahan</h2>
        </div>
        <button onClick={onGetStarted} className="text-xs text-brand-600 font-medium flex items-center gap-0.5">
          Lahat <ChevronRight size={14} />
        </button>
      </div>

      {/* Mobile: horizontal scroll; Desktop: grid */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar px-5 md:px-6 pb-2 md:grid md:grid-cols-3 lg:grid-cols-5 md:overflow-visible">
        {stores.map((store, i) => (
          <button
            key={store.id}
            onClick={onGetStarted}
            className="flex-shrink-0 w-40 md:w-auto bg-white rounded-2xl overflow-hidden border border-gray-100 active:scale-[0.98] transition animate-slide-in-right hover:shadow-md"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="h-20 bg-gradient-to-br from-brand-100 to-brand-50 relative">
              {store.banner_url ? (
                <img src={store.banner_url} alt={store.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl opacity-50">🏪</div>
              )}
              <div className="absolute top-1.5 right-1.5 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-0.5">
                <Star size={10} className="fill-amber-400 text-amber-400" />
                <span className="text-[10px] font-bold text-gray-700">{store.rating}</span>
              </div>
            </div>
            <div className="p-2.5">
              <p className="font-semibold text-sm text-gray-800 line-clamp-1">{store.name}</p>
              {store.palengke_name && (
                <p className="text-[10px] text-brand-600 line-clamp-1 flex items-center gap-0.5 mt-0.5">
                  <MapPin size={9} />
                  {store.palengke_name}
                </p>
              )}
              <div className="flex items-center gap-1 mt-1">
                <MapPin size={10} className="text-gray-400" />
                <span className="text-[10px] text-gray-500 line-clamp-1">{store.barangay}, {store.city}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============= FRESH PRODUCTS =============
function FreshProducts({ products, loading, onGetStarted }: { products: (Product & { store: Store })[]; loading: boolean; onGetStarted?: () => void }) {
  if (loading) {
    return (
      <div className="px-5 md:px-6 py-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <div className="px-5 md:px-6 py-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-brand-600" />
          <h2 className="text-lg md:text-2xl font-bold text-gray-800">Sariwang Paninda</h2>
        </div>
        <button onClick={onGetStarted} className="text-xs text-brand-600 font-medium flex items-center gap-0.5">
          Lahat <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {products.slice(0, 8).map((p, i) => (
          <button
            key={p.id}
            onClick={onGetStarted}
            className="bg-white rounded-2xl overflow-hidden border border-gray-100 text-left active:scale-[0.98] transition animate-slide-in-up hover:shadow-md"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="h-28 md:h-32 bg-gray-100 relative">
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
              <p className="text-[10px] text-gray-400 line-clamp-1 mb-1">{p.store.name}</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-bold text-brand-600">₱{p.price}</p>
                  <p className="text-[10px] text-gray-400">per {p.unit}</p>
                </div>
                <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center">
                  <Plus size={14} className="text-white" />
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============= HOW IT WORKS =============
function HowItWorks() {
  const steps = [
    { icon: ShoppingBag, title: '1. Pumili', desc: 'Mag-browse ng sariwang paninda mula sa iba\'t ibang tindahan sa palengke.', color: 'bg-brand-100 text-brand-700' },
    { icon: StoreIcon, title: '2. Mag-order', desc: 'Idagdag sa cart at mag-checkout. Piliin ang payment method — QR o COD.', color: 'bg-amber-100 text-amber-700' },
    { icon: Bike, title: '3. I-deliver', desc: 'Ang aming rider ay maghahatid ng sariwang paninda diretso sa inyong bahay.', color: 'bg-blue-100 text-blue-700' },
  ];

  return (
    <div className="px-5 md:px-6 py-6 md:py-10 max-w-6xl mx-auto">
      <h2 className="text-lg md:text-2xl font-bold text-gray-800 mb-4 md:mb-6 text-center">Paano Gumagana?</h2>
      <div className="grid md:grid-cols-3 gap-3 md:gap-6">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 flex flex-col md:flex-row items-center gap-4 animate-slide-in-left hover:shadow-md transition"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              <div className={`w-14 h-14 rounded-2xl ${step.color} flex items-center justify-center flex-shrink-0`}>
                <Icon size={26} />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="font-bold text-gray-800 text-sm md:text-base">{step.title}</h3>
                <p className="text-xs md:text-sm text-gray-500 mt-0.5">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============= WHY GoPalengke =============
function WhySection() {
  const features = [
    { icon: Sparkles, title: 'Sariwa araw-araw', desc: 'Diretso galing sa palengke, hindi frozen o tagal na sa storage.' },
    { icon: Bike, title: 'Mabilis na delivery', desc: 'Ang aming mga rider ay naka-standby para maihatid agad ang order mo.' },
    { icon: Shield, title: 'Ligtas na payment', desc: 'Bayad via QR Code (GCash/Maya) o Cash on Delivery — ikaw ang pipili.' },
    { icon: StoreIcon, title: 'Totoong tindahan', desc: 'Mga seller na may pwesto sa palengke — alam mo kung saan galing.' },
  ];

  return (
    <div className="bg-white px-5 md:px-6 py-6 md:py-10">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-lg md:text-2xl font-bold text-gray-800 mb-4 md:mb-6 text-center">Bakit GoPalengke?</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="bg-brand-50 rounded-2xl p-4 md:p-6 flex flex-col items-center text-center gap-2 animate-scale-pop hover:bg-brand-100 transition"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
                  <Icon size={24} className="text-brand-600" />
                </div>
                <h3 className="font-bold text-sm md:text-base text-gray-800">{f.title}</h3>
                <p className="text-[11px] md:text-sm text-gray-500 leading-snug">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============= CTA =============
function CTASection({ onGetStarted }: { onGetStarted?: () => void }) {
  return (
    <div className="px-5 md:px-6 py-8 md:py-12 max-w-6xl mx-auto">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 to-brand-800 rounded-3xl p-6 md:p-12 text-center">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-float" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full blur-2xl animate-float-slow" />

        <div className="relative max-w-2xl mx-auto">
          <div className="text-4xl mb-3 animate-bounce-subtle">🛒</div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-2">Ready ka na ba?</h2>
          <p className="text-brand-100 text-sm md:text-base mb-5">
            Kahit wala kang pwesto sa palengke, pwede kang magtinda dito online. Kung ikaw naman ay may bilhin sa palengke, hindi mo na kailangan umalis ng bahay.
          </p>
          <button
            onClick={onGetStarted}
            className="w-full sm:w-auto px-8 py-4 bg-white text-brand-700 rounded-2xl font-bold text-base shadow-xl active:scale-[0.98] transition inline-flex items-center justify-center gap-2 animate-pulse-glow"
          >
            <ShoppingBag size={20} />
            Magsimula Ngayon
            <ArrowRight size={18} />
          </button>
          <div className="flex items-center justify-center gap-4 md:gap-6 mt-4 text-brand-100 text-xs md:text-sm">
            <div className="flex items-center gap-1">
              <Clock size={12} /> Fast Delivery
            </div>
            <div className="flex items-center gap-1">
              <Truck size={12} /> Province-wide
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============= FOOTER =============
function Footer() {
  const legalLinks = [
    { label: 'Terms and Conditions', hash: '#/legal/terms' },
    { label: 'Disclaimer', hash: '#/legal/disclaimer' },
    { label: 'Privacy Policy', hash: '#/legal/privacy' },
    { label: 'FAQ', hash: '#/legal/faq' },
  ];

  return (
    <footer className="bg-gray-900 text-gray-400 px-5 py-8 md:py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-4">
          <img src="/images/Copilot_20260907_183703.png" alt="GoPalengke" className="w-7 h-7 rounded-lg object-cover" />
          <span className="text-lg font-bold text-white">GoPalengke</span>
        </div>
        <p className="text-sm text-center mb-5">The First Online Wet Market in the Philippines</p>

        {/* Legal links */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-5">
          {legalLinks.map((link) => (
            <button
              key={link.hash}
              onClick={() => { window.location.hash = link.hash; }}
              className="text-xs md:text-sm text-gray-400 hover:text-white transition"
            >
              {link.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-center text-gray-500">© 2026 GoPalengke. All rights reserved.</p>
      </div>
    </footer>
  );
}
