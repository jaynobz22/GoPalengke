// @ts-nocheck
import { useState } from 'react';
import { Award, Check, Crown, Flame, Lock, Sparkles, Sprout, Star, Store, X } from 'lucide-react';

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

export function SellerRankMilestonesModal({ totalSales, onClose }: { totalSales: number; onClose: () => void }) {
  const safeSales = Math.max(0, Number(totalSales) || 0);
  const { current } = getSellerRankProgress(safeSales);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Lahat ng seller milestones">
      <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-gray-800">Seller Milestones</h3>
            <p className="text-xs text-gray-500">Ang mga pagkilalang maabot mo habang lumalaki ang benta mo sa GoPalengke.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Isara">
            <X size={18} />
          </button>
        </div>

        <ul className="space-y-2">
          {SELLER_RANKS.map(rank => {
            const Icon = rank.icon;
            const reached = safeSales >= rank.minimum;
            const isCurrent = rank.key === current.key;
            const needed = Math.max(0, rank.minimum - safeSales);
            return (
              <li key={rank.key} className={`flex items-center gap-3 rounded-xl border p-3 ${isCurrent ? 'border-emerald-300 bg-emerald-50' : reached ? 'border-gray-100 bg-gray-50' : 'border-gray-100 bg-white'}`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${rank.badgeClass}`}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-800">{rank.name}</p>
                  <p className="text-[11px] text-gray-500">
                    {rank.minimum === 0 ? 'Simula ng bawat tindahan' : `₱${rank.minimum.toLocaleString('en-PH')} na benta`}
                  </p>
                  {!reached && (
                    <p className="text-[11px] font-semibold text-amber-600">₱{needed.toLocaleString('en-PH')} pa bago maabot</p>
                  )}
                </div>
                {isCurrent ? (
                  <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">Kasalukuyan</span>
                ) : reached ? (
                  <Check size={18} className="shrink-0 text-emerald-600" aria-label="Naabot na" />
                ) : (
                  <Lock size={15} className="shrink-0 text-gray-300" aria-label="Hindi pa naabot" />
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-center text-[11px] text-gray-400">Kabuuang benta mo: ₱{safeSales.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</p>
      </div>
    </div>
  );
}

export function SellerRankProgress({ totalSales }: { totalSales: number }) {
  const { current, next, progress, remaining } = getSellerRankProgress(totalSales);
  const CurrentIcon = current.icon;
  const [showMilestones, setShowMilestones] = useState(false);

  return (
    <>
    <section
      className="mx-5 mb-1 cursor-pointer rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow"
      aria-label="Seller milestone — i-click para makita ang lahat ng milestones"
      role="button"
      tabIndex={0}
      onClick={() => setShowMilestones(true)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowMilestones(true); } }}
    >
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
      <p className="mt-2 text-center text-[10px] font-semibold text-emerald-600">I-click para makita ang lahat ng milestones 👆</p>
    </section>
    {showMilestones && <SellerRankMilestonesModal totalSales={totalSales} onClose={() => setShowMilestones(false)} />}
    </>
  );
}