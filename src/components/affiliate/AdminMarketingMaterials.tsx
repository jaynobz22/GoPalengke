import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ImageUploadField } from '@/components/ImageUploadField';
import {
  Plus, Trash2, Loader2, Megaphone, Image as ImageIcon, Youtube,
  FileText, Power, ChevronUp, ChevronDown, X, Check,
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
  created_at: string;
}

const TYPE_OPTIONS = [
  { id: 'banner' as const, label: 'Banner', icon: Megaphone },
  { id: 'image' as const, label: 'Image', icon: ImageIcon },
  { id: 'video' as const, label: 'YouTube Video', icon: Youtube },
  { id: 'text_post' as const, label: 'Text Post', icon: FileText },
];

export function AdminMarketingMaterials() {
  const [materials, setMaterials] = useState<MarketingMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [type, setType] = useState<MarketingMaterial['type']>('banner');
  const [mediaUrl, setMediaUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [caption, setCaption] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('affiliate_marketing_materials')
      .select('*')
      .order('sort_order', { ascending: true });
    setMaterials((data || []) as MarketingMaterial[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setTitle('');
    setType('banner');
    setMediaUrl('');
    setYoutubeUrl('');
    setCaption('');
  }

  async function handleCreate() {
    if (!title.trim()) return;
    if (type === 'video' && !youtubeUrl.trim()) return;
    if ((type === 'banner' || type === 'image') && !mediaUrl) return;
    setSaving(true);
    const { error } = await supabase.from('affiliate_marketing_materials').insert({
      title: title.trim(),
      type,
      media_url: mediaUrl || null,
      youtube_url: youtubeUrl.trim() || null,
      caption: caption.trim() || null,
      is_active: true,
      sort_order: materials.length,
    });
    setSaving(false);
    if (error) {
      alert('Error: ' + error.message);
      return;
    }
    resetForm();
    setShowCreate(false);
    load();
  }

  async function toggleActive(mat: MarketingMaterial) {
    await supabase
      .from('affiliate_marketing_materials')
      .update({ is_active: !mat.is_active, updated_at: new Date().toISOString() })
      .eq('id', mat.id);
    load();
  }

  async function deleteMaterial(mat: MarketingMaterial) {
    if (!confirm(`Sigurado ka bang burahin ang "${mat.title}"?`)) return;
    if (mat.media_url) {
      const path = mat.media_url.split('/affiliate-marketing/').pop();
      if (path) {
        await supabase.storage.from('affiliate-marketing').remove([path]);
      }
    }
    await supabase.from('affiliate_marketing_materials').delete().eq('id', mat.id);
    load();
  }

  async function moveOrder(mat: MarketingMaterial, direction: 'up' | 'down') {
    const sorted = [...materials].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex(m => m.id === mat.id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sorted.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const swapMat = sorted[swapIdx];
    await Promise.all([
      supabase.from('affiliate_marketing_materials')
        .update({ sort_order: swapMat.sort_order, updated_at: new Date().toISOString() })
        .eq('id', mat.id),
      supabase.from('affiliate_marketing_materials')
        .update({ sort_order: mat.sort_order, updated_at: new Date().toISOString() })
        .eq('id', swapMat.id),
    ]);
    load();
  }

  function getYouTubeEmbed(url: string): string {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : url;
  }

  function getYouTubeThumb(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Marketing Materials</h2>
          <p className="text-xs text-gray-400">Mag-upload ng banners, images, at YouTube videos para sa affiliates.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition"
        >
          <Plus size={16} /> Bagong Material
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-brand-500" />
        </div>
      ) : materials.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Megaphone size={28} className="text-gray-300" />
          </div>
          <p className="text-gray-400 text-sm">Wala pang marketing materials.</p>
          <p className="text-gray-400 text-xs mt-1">Mag-upload ng banners o videos para magamit ng affiliates sa pag-promote.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {materials.map((mat) => (
            <div key={mat.id} className={`bg-white rounded-2xl border p-4 ${mat.is_active ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      mat.type === 'banner' ? 'bg-orange-100 text-orange-700' :
                      mat.type === 'image' ? 'bg-green-100 text-green-700' :
                      mat.type === 'video' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {mat.type === 'banner' ? 'Banner' : mat.type === 'image' ? 'Image' : mat.type === 'video' ? 'Video' : 'Text Post'}
                    </span>
                    {!mat.is_active && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
                    )}
                  </div>
                  <p className="font-semibold text-sm text-gray-800">{mat.title}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => moveOrder(mat, 'up')}
                    className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center active:scale-90"
                  >
                    <ChevronUp size={14} className="text-gray-500" />
                  </button>
                  <button
                    onClick={() => moveOrder(mat, 'down')}
                    className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center active:scale-90"
                  >
                    <ChevronDown size={14} className="text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Preview */}
              {mat.type === 'video' && mat.youtube_url ? (
                <div className="mb-2 rounded-xl overflow-hidden bg-gray-100 max-w-md">
                  <img
                    src={getYouTubeThumb(mat.youtube_url) || ''}
                    alt={mat.title}
                    className="w-full h-32 object-cover"
                  />
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-red-50">
                    <Youtube size={14} className="text-red-600 flex-shrink-0" />
                    <a
                      href={mat.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-red-600 truncate hover:underline"
                    >
                      {mat.youtube_url}
                    </a>
                  </div>
                </div>
              ) : mat.media_url ? (
                <img
                  src={mat.media_url}
                  alt={mat.title}
                  className="max-w-md w-full h-32 object-cover rounded-xl mb-2"
                />
              ) : mat.caption ? (
                <div className="bg-gray-50 rounded-xl p-3 mb-2">
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{mat.caption}</p>
                </div>
              ) : null}

              {mat.caption && mat.type !== 'text_post' && (
                <div className="bg-gray-50 rounded-xl p-2.5 mb-2">
                  <p className="text-[10px] text-gray-400 mb-0.5">Caption:</p>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap line-clamp-2">{mat.caption}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => toggleActive(mat)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition active:scale-95 ${
                    mat.is_active
                      ? 'bg-amber-50 text-amber-600 border border-amber-200'
                      : 'bg-green-50 text-green-600 border border-green-200'
                  }`}
                >
                  <Power size={14} />
                  {mat.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => deleteMaterial(mat)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-red-50 text-red-500 border border-red-200 active:scale-95 transition"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center px-5" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Bagong Marketing Material</h3>
              <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Type Selector */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">Uri ng Material</label>
                <div className="grid grid-cols-4 gap-2">
                  {TYPE_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setType(opt.id)}
                        className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-medium transition ${
                          type === opt.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <Icon size={18} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Pamagat</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Hal. Pasko Promo Banner"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500"
                />
              </div>

              {/* Media Upload (for banner/image) */}
              {(type === 'banner' || type === 'image') && (
                <ImageUploadField
                  label="Banner/Image"
                  value={mediaUrl}
                  onChange={setMediaUrl}
                  bucket="affiliate-marketing"
                  folder="marketing"
                  aspectClass="h-32"
                  cropAspect={4 / 3}
                />
              )}

              {/* YouTube URL (for video) */}
              {type === 'video' && (
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">YouTube Video URL</label>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={e => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500"
                  />
                </div>
              )}

              {/* Caption / Promotional Text */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">
                  {type === 'text_post' ? 'Promotional Text' : 'Caption (optional)'}
                </label>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder={
                    type === 'text_post'
                      ? "Isulat ang promotional text dito. Maglagay ng [REF_LINK] kung saan gusto mong lumabas ang referral link ng affiliate."
                      : "Optional caption na kasama ng banner/video kapag i-share ng affiliate."
                  }
                  rows={type === 'text_post' ? 6 : 3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none text-sm focus:border-brand-500 resize-none"
                />
                {type === 'text_post' && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Gamitin ang <code className="bg-gray-100 px-1 rounded">[REF_LINK]</code> bilang placeholder — awtomatikong papalitan ng referral link ng affiliate.
                  </p>
                )}
              </div>

              <button
                onClick={handleCreate}
                disabled={saving || !title.trim() || ((type === 'banner' || type === 'image') && !mediaUrl) || (type === 'video' && !youtubeUrl.trim()) || (type === 'text_post' && !caption.trim())}
                className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {saving ? 'Nagsasave...' : 'I-save ang Material'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
