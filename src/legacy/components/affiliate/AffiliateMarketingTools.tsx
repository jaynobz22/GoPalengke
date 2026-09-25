// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Affiliate } from '../../lib/affiliateAuth';
import {
  Megaphone, Image as ImageIcon, Youtube, FileText, Copy, CheckCheck,
  Loader2, Share2, Download, ExternalLink,
} from 'lucide-react';

interface MarketingMaterial {
  id: string;
  title: string;
  type: 'banner' | 'image' | 'video' | 'text_post';
  media_url: string | null;
  youtube_url: string | null;
  caption: string | null;
  is_active: boolean;
  sort_order: number;
}

export function AffiliateMarketingTools({ affiliate }: { affiliate: Affiliate }) {
  const [materials, setMaterials] = useState<MarketingMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const referralLink = `${window.location.origin}/?ref=${affiliate.referral_code}`;
  const affiliateLink = `${window.location.origin}/affiliate?aff_ref=${affiliate.referral_code}`;

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('affiliate_marketing_materials')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    setMaterials((data || []) as MarketingMaterial[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function getProcessedCaption(caption: string): string {
    return caption.replace(/\[REF_LINK\]/g, referralLink);
  }

  function getYouTubeThumb(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
  }

  function shareToFacebook(shareUrl: string) {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      '_blank',
      'width=600,height=400'
    );
  }

  async function downloadImage(url: string, title: string) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-brand-500" />
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
        <Megaphone size={32} className="text-gray-300 mx-auto mb-2" />
        <p className="text-gray-400 text-sm">Wala pang marketing materials available.</p>
        <p className="text-gray-400 text-xs mt-1">Balik na lang mamaya.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick Reference: Referral Links */}
      <div className="bg-gradient-to-br from-brand-50 to-emerald-50 rounded-2xl border border-brand-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Share2 size={18} className="text-brand-600" />
          <h3 className="font-bold text-gray-800 text-sm">Iyong Mga Referral Links</h3>
        </div>
        <div className="space-y-2">
          {/* Seller/Rider Referral Link */}
          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <p className="text-[10px] text-gray-400 mb-1 font-medium">Para sa Sellers & Riders</p>
            <div className="flex items-center gap-2">
              <p className="flex-1 text-xs text-gray-600 font-mono truncate">{referralLink}</p>
              <button
                onClick={() => copyToClipboard(referralLink, 'ref_link')}
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center active:scale-90 transition"
              >
                {copiedId === 'ref_link' ? <CheckCheck size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
          {/* Affiliate Invite Link */}
          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <p className="text-[10px] text-gray-400 mb-1 font-medium">Para sa Pag-invite ng Affiliates (Tier 2)</p>
            <div className="flex items-center gap-2">
              <p className="flex-1 text-xs text-gray-600 font-mono truncate">{affiliateLink}</p>
              <button
                onClick={() => copyToClipboard(affiliateLink, 'aff_link')}
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center active:scale-90 transition"
              >
                {copiedId === 'aff_link' ? <CheckCheck size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Marketing Materials */}
      {materials.map((mat) => {
        const processedCaption = mat.caption ? getProcessedCaption(mat.caption) : '';
        const shareText = `${mat.title}\n\n${processedCaption}`;
        const shareId = `mat_${mat.id}`;
        const fbShareUrl = mat.type === 'video' && mat.youtube_url
          ? mat.youtube_url
          : mat.media_url || referralLink;

        return (
          <div key={mat.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Type Badge */}
            <div className="flex items-center gap-2 px-4 pt-3">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                mat.type === 'banner' ? 'bg-orange-100 text-orange-700' :
                mat.type === 'image' ? 'bg-green-100 text-green-700' :
                mat.type === 'video' ? 'bg-red-100 text-red-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {mat.type === 'banner' && <Megaphone size={10} />}
                {mat.type === 'image' && <ImageIcon size={10} />}
                {mat.type === 'video' && <Youtube size={10} />}
                {mat.type === 'text_post' && <FileText size={10} />}
                {mat.type === 'banner' ? 'Banner' : mat.type === 'image' ? 'Image' : mat.type === 'video' ? 'Video' : 'Text Post'}
              </span>
              <p className="text-sm font-semibold text-gray-800 truncate">{mat.title}</p>
            </div>

            {/* Media Preview */}
            {mat.type === 'video' && mat.youtube_url && (
              <div className="mt-3 mx-4 rounded-xl overflow-hidden bg-gray-100">
                <a href={mat.youtube_url} target="_blank" rel="noopener noreferrer" className="block relative">
                  <img
                    src={getYouTubeThumb(mat.youtube_url) || ''}
                    alt={mat.title}
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center">
                      <Youtube size={24} className="text-white" />
                    </div>
                  </div>
                </a>
              </div>
            )}

            {mat.type === 'banner' && mat.media_url && (
              <div className="mt-3 mx-4 rounded-xl overflow-hidden bg-gray-100">
                <img src={mat.media_url} alt={mat.title} className="w-full h-40 object-cover" />
              </div>
            )}

            {mat.type === 'image' && mat.media_url && (
              <div className="mt-3 mx-4 rounded-xl overflow-hidden bg-gray-100">
                <img src={mat.media_url} alt={mat.title} className="w-full h-40 object-cover" />
              </div>
            )}

            {/* Caption / Text Post */}
            {mat.type === 'text_post' && mat.caption && (
              <div className="mt-3 mx-4 bg-gray-50 rounded-xl p-3">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{processedCaption}</p>
              </div>
            )}

            {/* Caption for non-text types */}
            {mat.caption && mat.type !== 'text_post' && (
              <div className="mt-3 mx-4 bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 mb-1">Caption:</p>
                <p className="text-xs text-gray-600 whitespace-pre-wrap">{processedCaption}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="p-4 space-y-2">
              {/* Copy Caption/Text */}
              {mat.caption && (
                <button
                  onClick={() => copyToClipboard(shareText, `caption_${mat.id}`)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition"
                >
                  {copiedId === `caption_${mat.id}` ? <CheckCheck size={16} /> : <Copy size={16} />}
                  {copiedId === `caption_${mat.id}` ? 'Na-copy na!' : 'Copy Caption + Referral Link'}
                </button>
              )}

              <div className="flex gap-2">
                {/* Share to Facebook */}
                <button
                  onClick={() => shareToFacebook(fbShareUrl)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition"
                >
                  <Share2 size={14} /> Share sa Facebook
                </button>

                {/* Download Image */}
                {mat.media_url && (
                  <button
                    onClick={() => downloadImage(mat.media_url!, mat.title)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold active:scale-95 transition"
                  >
                    <Download size={14} />
                  </button>
                )}

                {/* Open YouTube */}
                {mat.type === 'video' && mat.youtube_url && (
                  <a
                    href={mat.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold active:scale-95 transition"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>

              {/* Copy Referral Link */}
              {!mat.caption && (
                <button
                  onClick={() => copyToClipboard(referralLink, shareId)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition"
                >
                  {copiedId === shareId ? <CheckCheck size={16} /> : <Copy size={16} />}
                  {copiedId === shareId ? 'Na-copy na!' : 'Copy Referral Link'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
