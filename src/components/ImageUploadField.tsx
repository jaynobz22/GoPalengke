import { useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/imageCompress';

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  bucket?: string;
  folder?: string;
  aspectClass?: string;
  icon?: React.ReactNode;
  hint?: string;
}

export function ImageUploadField({
  label,
  value,
  onChange,
  bucket = 'store-images',
  folder = 'store',
  aspectClass = 'h-40',
  icon,
  hint = 'Auto-compress ang larawan para maliit ang file size.',
}: ImageUploadFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      const ext = compressed.name.split('.').pop() || 'webp';
      const fileName = `${folder}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, compressed);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
      onChange(publicUrl);
    } catch (err: any) {
      setError(err.message || 'Hindi ma-upload ang larawan.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div>
      <label className="text-sm font-medium text-gray-600 mb-1 block flex items-center gap-1">
        {icon}
        {label}
      </label>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
      {value ? (
        <div className="relative">
          <img src={value} alt="Preview" className={`w-full ${aspectClass} rounded-xl object-cover`} />
          <div className="absolute bottom-2 right-2 flex gap-1.5">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="bg-black/60 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
              <Camera size={14} /> Palitan
            </button>
            <button type="button" onClick={() => onChange('')}
              className="bg-black/60 text-white px-2 py-1.5 rounded-lg text-xs flex items-center gap-1">
              <X size={14} /> Alisin
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className={`w-full ${aspectClass} rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 active:scale-[0.98] transition disabled:opacity-50`}>
          {uploading ? (
            <><Loader2 size={28} className="animate-spin" /><span className="text-sm">Naka-compress at nag-uupload...</span></>
          ) : (
            <><Camera size={28} /><span className="text-sm">Mag-upload ng larawan mula sa phone</span></>
          )}
        </button>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      <p className="text-xs text-gray-400 mt-1">{hint}</p>
    </div>
  );
}
