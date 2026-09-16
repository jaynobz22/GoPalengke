import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Review, ReviewType } from '@/lib/types';
import { Star, Loader2, X, Check, Share2, Facebook, MessageCircle, Copy } from 'lucide-react';

export function StarRating({ value, onChange, size = 28 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          className="transition active:scale-90 disabled:cursor-default"
        >
          <Star
            size={size}
            className={n <= (hover || value) ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}
          />
        </button>
      ))}
    </div>
  );
}

export function ReviewForm({
  orderId,
  revieweeId,
  reviewType,
  revieweeName,
  storeSlug,
  onSubmitted,
}: {
  orderId: string;
  revieweeId: string;
  reviewType: ReviewType;
  revieweeName: string;
  storeSlug?: string | null;
  onSubmitted: () => void;
}) {
  const { profile } = useAuth() as any;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = storeSlug ? `${window.location.origin}/s/${storeSlug}` : '';
  const shareText = `Napakagandang experience ko sa ${revieweeName} sa Pamalengke Online! ${rating > 0 ? `${'⭐'.repeat(rating)} ` : ''}Subukan nyo din!`;
  const encodedShareUrl = encodeURIComponent(shareUrl);
  const encodedShareText = encodeURIComponent(shareText);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) { setError('Pumili ng star rating.'); return; }
    if (!comment.trim()) { setError('Maglagay ng comment.'); return; }
    setSubmitting(true);
    setError(null);
    const { error: insError } = await supabase.from('reviews').insert({
      order_id: orderId,
      reviewer_id: profile.id,
      reviewee_id: revieweeId,
      review_type: reviewType,
      rating,
      comment: comment.trim(),
    });
    setSubmitting(false);
    if (insError) {
      setError(insError.message);
    } else {
      setSubmitted(true);
      onSubmitted();
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (submitted && reviewType === 'seller' && storeSlug) {
    return (
      <div className="bg-gradient-to-br from-brand-50 to-amber-50 rounded-2xl border border-brand-200 p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center">
            <Check size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-sm text-gray-800">Salamat sa iyong review!</p>
            <p className="text-xs text-gray-500">I-share ang magandang experience mo</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 mb-3 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Star size={14} className="fill-amber-400 text-amber-400" />
            <span className="text-xs font-medium text-gray-700">{revieweeName}</span>
          </div>
          <p className="text-sm text-gray-600 italic">"{comment}"</p>
        </div>

        <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1.5">
          <Share2 size={14} /> I-share sa social media:
        </p>
        <div className="grid grid-cols-3 gap-2">
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}&quote=${encodedShareText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 py-3 bg-[#1877F2] text-white rounded-xl font-semibold text-xs active:scale-95 transition"
          >
            <Facebook size={20} />
            Facebook
          </a>
          <a
            href={`fb-messenger://share?link=${encodedShareUrl}`}
            onClick={(e) => {
              const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
              if (!isMobile) {
                e.preventDefault();
                window.open(`https://www.facebook.com/dialog/send?app_id=140586622674355&link=${encodedShareUrl}&redirect_uri=${encodedShareUrl}`, '_blank', 'noopener,noreferrer');
              }
            }}
            className="flex flex-col items-center gap-1 py-3 bg-gradient-to-br from-[#00B2FF] to-[#006AFF] text-white rounded-xl font-semibold text-xs active:scale-95 transition"
          >
            <MessageCircle size={20} />
            Messenger
          </a>
          <button
            onClick={copyLink}
            className="flex flex-col items-center gap-1 py-3 bg-gray-700 text-white rounded-xl font-semibold text-xs active:scale-95 transition"
          >
            {copied ? <Check size={20} /> : <Copy size={20} />}
            {copied ? 'Nakopya!' : 'Kopyahin'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-gray-800">
          I-review ang {reviewType === 'seller' ? 'Tindahan' : 'Rider'}
        </h3>
        <span className="text-xs text-gray-400">{revieweeName}</span>
      </div>
      <div className="flex flex-col items-center py-3">
        <StarRating value={rating} onChange={setRating} />
        <p className="text-xs text-gray-400 mt-2">
          {rating === 0 ? 'Pumili ng rating' : ['', 'Hindi maganda', 'Okay lang', 'Maganda', 'Sobrang maganda', 'Perfect!'][rating]}
        </p>
      </div>
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Anong masasabi mo?"
        rows={3}
        maxLength={500}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:border-brand-500 outline-none resize-none text-sm"
      />
      {error && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg mt-2">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full mt-3 py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        {submitting ? 'Nagsusumite...' : 'I-submit ang Review'}
      </button>
    </form>
  );
}

export function ReviewSection({ userId }: { userId: string }) {
  const [reviews, setReviews] = useState<(Review & { reviewer: { full_name: string; avatar_url: string | null } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('reviews')
      .select('*, reviewer:profiles!reviews_reviewer_id_fkey(full_name, avatar_url)')
      .eq('reviewee_id', userId)
      .order('created_at', { ascending: false });
    setReviews((data || []) as any);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={20} className="animate-spin text-gray-300" />
      </div>
    );
  }

  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const visible = showAll ? reviews : reviews.slice(0, 3);

  return (
    <div>
      {reviews.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-6">Wala pang reviews.</p>
      ) : (
        <>
          {/* Summary */}
          <div className="flex items-center gap-3 mb-3 bg-amber-50 rounded-xl p-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{avgRating.toFixed(1)}</p>
              <div className="flex items-center gap-0.5 justify-center">
                {[1, 2, 3, 4, 5].map(n => (
                  <Star key={n} size={12} className={n <= Math.round(avgRating) ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'} />
                ))}
              </div>
            </div>
            <div className="text-xs text-gray-500">
              {reviews.length} review{reviews.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Reviews list */}
          <div className="space-y-2">
            {visible.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">{r.reviewer?.full_name || 'Buyer'}</span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star key={n} size={12} className={n <= r.rating ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'} />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-600">{r.comment}</p>
                <p className="text-xs text-gray-300 mt-1">
                  {new Date(r.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>

          {reviews.length > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full text-center text-sm text-brand-600 font-medium py-2 mt-2"
            >
              {showAll ? 'Itago ang iba' : `Tingnan ang lahat (${reviews.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
