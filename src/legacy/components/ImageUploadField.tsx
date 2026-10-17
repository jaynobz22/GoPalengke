// @ts-nocheck
import { useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/imageCompress';
import { CropModal } from '../components/CropModal';
import { Button } from '@/components/ui/button';

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void | Promise<void>;
  bucket?: string;
  folder?: string;
  aspectClass?: string;
  icon?: React.ReactNode;
  hint?: string;
  cropAspect?: number;
  objectFit?: 'cover' | 'contain';
}

export function ImageUploadField({
  label,
  value,
  onChange,
  bucket = 'store-images',
  folder = 'store',
  aspectClass = 'h-40',
  icon,
  hint = '',
  cropAspect,
  objectFit = 'cover',
}: ImageUploadFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | undefined>();

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setOriginalFile(file);
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.onerror = () => setError('Hindi mabasa ang larawan.');
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleCropConfirm(croppedFile: File) {
    setCropSrc(null);
    setUploading(true);
    setError(null);
    try {
      const compressed = await compressImage(croppedFile);
      const ext = compressed.name.split('.').pop() || 'webp';
      const fileName = `${folder}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, compressed);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
      await onChange(publicUrl);
    } catch (err: any) {
      setError(err.message || 'Hindi ma-upload ang larawan.');
    } finally {
      setUploading(false);
    }
  }

  async function removeImage() {
    setUploading(true);
    setError(null);
    try { await onChange(''); }
    catch (err: any) { setError(err.message || 'Hindi maalis ang larawan.'); }
    finally { setUploading(false); }
  }

  return (
    <div>
      <label className="text-sm font-medium text-gray-600 mb-1 block flex items-center gap-1">
        {icon}
        {label}
      </label>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
      {value ? (
        <div className={`relative w-full ${aspectClass}`}>
          <img
            src={value}
            alt="Preview"
            className={`w-full h-full rounded-xl ${objectFit === 'contain' ? 'object-contain bg-gray-50' : 'object-cover'}`}
          />
          <div className="absolute bottom-2 right-2 flex gap-1.5">
            <Button type="button" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Camera size={14} /> Palitan
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled={uploading} onClick={removeImage}>
              <X size={14} /> Alisin
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}
          className={`w-full ${aspectClass} h-auto whitespace-normal rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground transition disabled:opacity-50`}>
          {uploading ? (
            <><Loader2 size={28} className="animate-spin" /><span className="text-sm">Nagco-compress at nag-uupload...</span></>
          ) : (
            <><Camera size={28} /><span className="text-sm">Mag-upload ng larawan mula sa gallery o camera</span></>
          )}
        </Button>
      )}
      {uploading && value && <p role="status" className="mt-1 text-xs text-muted-foreground">Sine-save ang larawan...</p>}
      {error && <p role="alert" className="text-destructive text-xs mt-1">{error}</p>}
      <p className="text-xs text-gray-400 mt-1">{hint}</p>

      {cropSrc && (
        <CropModal
          imageSrc={cropSrc}
          originalFile={originalFile}
          onCancel={() => setCropSrc(null)}
          onConfirm={handleCropConfirm}
          defaultAspect={cropAspect}
        />
      )}
    </div>
  );
}
