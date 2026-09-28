// @ts-nocheck
import { Award, Crown, Flame, Sparkles, Sprout, Star, Store } from 'lucide-react';

export const SELLER_RANKS = [
  { key: 'rising_merchant', name: 'Rising Merchant', minimum: 0, icon: Sprout, badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700', barClass: 'bg-emerald-500' },
  { key: 'customer_favorite', name: 'Customer Favorite', minimum: 25_000, icon: Sparkles, badgeClass: 'border-sky-200 bg-sky-50 text-sky-700', barClass: 'bg-sky-500' },
  { key: 'market_star', name: 'Market Star', minimum: 100_000, icon: Star, badgeClass: 'border-amber-200 bg-amber-50 text-amber-700', barClass: 'bg-amber-500' },
  { key: 'market_champion', name: 'Market Champion', minimum: 300_000, icon: Crown, badgeClass: 'border-orange-200 bg-orange-50 text-orange-700', barClass: 'bg-orange-500' },
  { key: 'elite_merchant', name: 'Elite Merchant', minimum: 750_000, icon: Award, badgeClass: 'border-rose-200 bg-rose-50 text-rose-700', barClass: 'bg-rose-500' },
  { key: 'market_legend', name: 'Market Legend', minimum: 1_500_000, icon: Flame, badgeClass: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700', barClass: 'bg-fuchsia-500' },
  { key: 'grand_market_icon', name: 'Grand Market Icon', minimum: 3_000_000, icon: Store, badgeClass: 'border-teal-200 bg-teal-50 text-teal-700', barClass: 'bg-teal-600' },
] as const;

export type SellerRankKey = typeof SELLER_RANKS[number]['key'];

export function getSellerRank(totalSales: number) {
  const safeSales = Math.max(0, Number(totalSales) || 0);
  return [...SELLER_RANKS].reverse().find(rank => safeSales >= rank.minimum) || SELLER_RANKS[0];
}

export function getSellerRankByKey(key?: string | null) {
  return SELLER_RANKS.find(rank => rank.key === key) || SELLER_RANKS[0];
}

export function getSellerRankProgress(totalSales: number) {
  const safeSales = Math.max(0, Number(totalSales) || 0);
  const current = getSellerRank(safeSales);
  const currentIndex = SELLER_RANKS.findIndex(rank => rank.key === current.key);
  const next = SELLER_RANKS[currentIndex + 1] || null;
  const progress = next
    ? Math.min(100, Math.max(0, ((safeSales - current.minimum) / (next.minimum - current.minimum)) * 100))
    : 100;
  return { current, next, progress, remaining: next ? Math.max(0, next.minimum - safeSales) : 0 };
}

export function SellerRankBadge({ rankKey, totalSales, compact = false }: { rankKey?: string | null; totalSales?: number; compact?: boolean }) {
  const rank = totalSales == null ? getSellerRankByKey(rankKey) : getSellerRank(totalSales);
  const Icon = rank.icon;

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border font-bold ${rank.badgeClass} ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}`}
      aria-label={`Seller rank: ${rank.name}`}
    >
      <Icon size={compact ? 11 : 13} className="shrink-0" />
      <span className="truncate">{rank.name}</span>
    </span>
  );
}

export function SellerRankProgress({ totalSales }: { totalSales: number }) {
  const { current, next, progress, remaining } = getSellerRankProgress(totalSales);
  const CurrentIcon = current.icon;

  return (
    <section className="mx-5 mb-1 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm" aria-label="Seller milestone">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${current.badgeClass}`}>
            <CurrentIcon size={23} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase text-gray-400">Seller Milestone</p>
            <p className="truncate font-display text-lg font-bold text-gray-800">{current.name}</p>
          </div>
        </div>
        <p className="shrink-0 text-right text-sm font-bold text-gray-800">₱{totalSales.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</p>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full transition-all duration-700 ${current.barClass}`} style={{ width: `${progress}%` }} />
      </div>

      {next ? (
        <div className="mt-2 flex items-start justify-between gap-3 text-xs">
          <p className="text-gray-500">₱{remaining.toLocaleString('en-PH', { maximumFractionDigits: 0 })} pa para umangat</p>
          <p className="shrink-0 font-semibold text-gray-700">Susunod: {next.name}</p>
        </div>
      ) : (
        <p className="mt-2 text-xs font-semibold text-teal-700">Pinakamataas na pagkilala sa GoPalengke—ipagpatuloy ang husay!</p>
      )}
    </section>
  );
}