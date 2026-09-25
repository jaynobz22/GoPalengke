// @ts-nocheck
import { useState } from 'react';
import type { Affiliate } from '../../lib/affiliateAuth';
import { CheckCheck, Copy, ExternalLink, Share2, Store, Bike, ShoppingBasket } from 'lucide-react';

const PAGES = [
  {
    id: 'seller',
    title: 'Para sa Sellers',
    description: 'Para sa palengke vendors, farmers, home-based food sellers, at iba pang may panindang kaugnay sa palengke.',
    path: '/para-sa-seller',
    image: '/images/gopalengke-seller-marketing.jpg',
    icon: Store,
    accent: 'text-orange-700',
    button: 'bg-orange-600',
  },
  {
    id: 'rider',
    title: 'Para sa Riders',
    description: 'Para sa may motorsiklo, tricycle o bao-bao, o minivan na gustong kumita sa deliveries.',
    path: '/para-sa-rider',
    image: '/images/gopalengke-rider-marketing.jpg',
    icon: Bike,
    accent: 'text-blue-700',
    button: 'bg-blue-600',
  },
  {
    id: 'buyer',
    title: 'Para sa Buyers',
    description: 'Para sa gustong mamili ng sariwang paninda mula sa verified sellers at magpa-deliver sa bahay.',
    path: '/para-sa-buyer',
    image: '/images/gopalengke-buyer-marketing.jpg',
    icon: ShoppingBasket,
    accent: 'text-brand-700',
    button: 'bg-brand-600',
  },
] as const;

export function TargetedMarketingPages({ affiliate }: { affiliate: Affiliate }) {
  const [copied, setCopied] = useState<string | null>(null);

  function getLink(path: string) {
    return `${window.location.origin}${path}?ref=${encodeURIComponent(affiliate.referral_code)}`;
  }

  function copyLink(id: string, link: string) {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(id);
      window.setTimeout(() => setCopied(null), 2000);
    });
  }

  function shareFacebook(link: string) {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, '_blank', 'width=640,height=540');
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-5">
        <p className="text-xs font-bold uppercase text-brand-600">Ready-to-share pages</p>
        <h2 className="mt-1 text-lg font-bold text-gray-900">Piliin kung sino ang iimbitahan</h2>
        <p className="mt-1 text-xs leading-5 text-gray-500">Awtomatikong nakakabit ang referral code mo sa bawat link. Ang Facebook preview at click ay diretso sa napiling page, hindi sa homepage.</p>
      </div>

      <div className="grid gap-px bg-gray-100 md:grid-cols-3">
        {PAGES.map((page) => {
          const Icon = page.icon;
          const link = getLink(page.path);
          return (
            <article key={page.id} className="min-w-0 bg-white p-4">
              <img src={page.image} alt={page.title} width={1200} height={630} loading="lazy" className="aspect-[1.91/1] w-full rounded-lg object-cover" />
              <div className="mt-3 flex items-center gap-2">
                <Icon size={18} className={page.accent} />
                <h3 className="font-bold text-gray-900">{page.title}</h3>
              </div>
              <p className="mt-2 min-h-[3.75rem] text-xs leading-5 text-gray-500">{page.description}</p>
              <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="truncate font-mono text-[10px] text-gray-500">{link}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => shareFacebook(link)} className={`col-span-2 flex h-10 items-center justify-center gap-2 rounded-xl ${page.button} text-xs font-bold text-white active:scale-95`}>
                  <Share2 size={15} /> Share sa Facebook
                </button>
                <button type="button" onClick={() => copyLink(page.id, link)} className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gray-100 text-xs font-semibold text-gray-700 active:scale-95">
                  {copied === page.id ? <CheckCheck size={15} /> : <Copy size={15} />}
                  {copied === page.id ? 'Na-copy' : 'Copy Link'}
                </button>
                <button type="button" onClick={() => window.open(link, '_blank')} className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 active:scale-95">
                  <ExternalLink size={15} /> Buksan
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}