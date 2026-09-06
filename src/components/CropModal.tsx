import { useCallback, useState, useRef } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';

interface CropModalProps {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void;
}

export function CropModal({ imageSrc, onCancel, onConfirm }: CropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const file = await cropImage(imageSrc, croppedAreaPixels);
      onConfirm(file);
    } catch {
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button onClick={onCancel} disabled={processing}
          className="flex items-center gap-1.5 text-sm font-medium active:scale-95 transition disabled:opacity-50">
          <X size={20} /> Kanselahin
        </button>
        <span className="text-sm font-semibold">I-crop ang Larawan</span>
        <button onClick={handleConfirm} disabled={processing}
          className="flex items-center gap-1.5 text-sm font-medium bg-green-600 px-3 py-1.5 rounded-lg active:scale-95 transition disabled:opacity-50">
          {processing ? (
            <span className="animate-pulse">Nagpro-proseso...</span>
          ) : (
            <><Check size={18} /> I-upload</>
          )}
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          cropShape="rect"
          showGrid
          restrictPosition={false}
        />
      </div>

      <div className="bg-black px-4 py-4 flex items-center gap-3">
        <ZoomOut size={20} className="text-white/70 flex-shrink-0" />
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          className="flex-1 accent-blue-500"
        />
        <ZoomIn size={20} className="text-white/70 flex-shrink-0" />
      </div>

      <img ref={imgRef} src={imageSrc} alt="" className="hidden" />
    </div>
  );
}

async function cropImage(imageSrc: string, pixels: Area): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Hindi ma-process ang larawan.');

  ctx.drawImage(
    image,
    pixels.x, pixels.y, pixels.width, pixels.height,
    0, 0, pixels.width, pixels.height,
  );

  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/webp', 0.85),
  );
  if (!blob) throw new Error('Hindi ma-crop ang larawan.');
  return new File([blob], 'cropped.webp', { type: 'image/webp' });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
