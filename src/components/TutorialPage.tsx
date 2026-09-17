import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import { ArrowLeft, PlayCircle, Loader2, BookOpen } from 'lucide-react';

type TutorialVideo = {
  id: string;
  youtube_url: string;
  youtube_id: string;
  title: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

function extractYouTubeId(url: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return '';
}

export function TutorialPage() {
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('tutorial_videos')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      setVideos((data || []) as TutorialVideo[]);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 relative overflow-hidden">
        <div className="absolute top-4 left-4 w-32 h-32 bg-brand-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-4 right-4 w-40 h-40 bg-brand-300/10 rounded-full blur-3xl" />

        <div className="relative px-5 pt-6 pb-8 max-w-3xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium mb-4 transition"
          >
            <ArrowLeft size={18} /> Bumalik
          </button>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <BookOpen size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Mga Tutorial Video</h1>
              <p className="text-brand-100 text-sm mt-0.5">Paano gamitin ang GoPalengke — panoorin ang mga video</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-6 max-w-3xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-brand-500" />
            <p className="text-gray-400 text-sm mt-3">Naglo-load ng mga video...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <PlayCircle size={28} className="text-gray-300" />
            </div>
            <p className="text-gray-400 text-sm">Wala pang available na tutorial videos.</p>
            <p className="text-gray-400 text-xs mt-1">Balik mamaya para sa mga bagong tutorial.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {videos.map((video, idx) => (
              <div key={video.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                {/* Video */}
                <div className="relative aspect-video bg-black">
                  {playingId === video.id ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${video.youtube_id}?autoplay=1`}
                      title={video.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <button
                      onClick={() => setPlayingId(video.id)}
                      className="w-full h-full flex items-center justify-center relative group"
                    >
                      <img
                        src={`https://img.youtube.com/vi/${video.youtube_id}/hqdefault.jpg`}
                        alt={video.title}
                        className="w-full h-full object-cover"
                        loading={idx < 2 ? 'eager' : 'lazy'}
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 group-hover:bg-white transition shadow-lg">
                          <PlayCircle size={36} className="text-brand-600" />
                        </div>
                      </div>
                    </button>
                  )}
                </div>

                {/* Title + Description */}
                <div className="p-4">
                  <div className="flex items-start gap-2 mb-1">
                    <span className="text-xs font-bold text-brand-600 bg-brand-50 rounded-lg px-2 py-0.5 flex-shrink-0">
                      Video {idx + 1}
                    </span>
                    <h2 className="font-bold text-gray-800 text-base leading-snug">{video.title}</h2>
                  </div>
                  {video.description && (
                    <p className="text-gray-500 text-sm mt-2 leading-relaxed whitespace-pre-line">
                      {video.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
