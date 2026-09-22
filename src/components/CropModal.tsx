import { useCallback, useState, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';

interface CropModalProps {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void;
  defaultAspect?: number;
}

export function CropModal({ imageSrc, onCancel, onConfirm, defaultAspect }: CropModalProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [zoom, setZoom] = useState(1);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [processing, setProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    setImgSize({ w: natW, h: natH });

    // Default crop = full image (no forced aspect ratio)
    const c: Crop = {
      unit: '%',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    };
    setCrop(c);
  }, []);

  // Fit image within viewport and track display size
  useEffect(() => {
    function fit() {
      if (!containerRef.current || imgSize.w === 0) return;
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      const scale = Math.min(cw / imgSize.w, ch / imgSize.h, 1) * zoom;
      setDisplaySize({ w: imgSize.w * scale, h: imgSize.h * scale });
    }
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [imgSize, zoom]);

  async function handleConfirm() {
    if (!completedCrop || !imgRef.current) return;
    setProcessing(true);
    try {
      const file = await cropImage(imgRef.current, completedCrop);
      onConfirm(file);
    } catch {
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button
          onClick={onCancel}
          disabled={processing}
          className="flex items-center gap-1.5 text-sm font-medium active:scale-95 transition disabled:opacity-50"
        >
          <X size={20} /> Kanselahin
        </button>
        <span className="text-sm font-semibold">I-crop ang Larawan</span>
        <button
          onClick={handleConfirm}
          disabled={processing}
          className="flex items-center gap-1.5 text-sm font-medium bg-green-600 px-3 py-1.5 rounded-lg active:scale-95 transition disabled:opacity-50"
        >
          {processing ? (
            <span className="animate-pulse">Nagpro-proseso...</span>
          ) : (
            <>
              <Check size={18} /> I-upload
            </>
          )}
        </button>
      </div>

      {/* Hint */}
      <div className="px-4 pb-1 text-center">
        <p className="text-xs text-white/50">
          I-drag ang mga gilid o sulok ng kahon para ayusin ang crop. Free-form — walang fixed na sukat.
        </p>
      </div>

      {/* Crop area */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden flex items-center justify-center px-4"
      >
        {displaySize.w > 0 && (
          <div style={{ width: displaySize.w, height: displaySize.h }} className="relative">
            <ReactCrop
              crop={crop}
              onChange={(_, percent) => setCrop(percent)}
              onComplete={(c) => setCompletedCrop(c)}
              minWidth={5}
              minHeight={5}
              keepSelection
              ruleOfThirds
            >
              <img
                ref={imgRef}
                src={imageSrc}
                onLoad={onImageLoad}
                alt="I-crop"
                style={{ width: displaySize.w, height: displaySize.h }}
                className="select-none pointer-events-none"
              />
            </ReactCrop>
          </div>
        )}
        {displaySize.w === 0 && (
          <img
            src={imageSrc}
            onLoad={onImageLoad}
            alt="Loading"
            className="max-w-full max-h-full opacity-0"
          />
        )}
      </div>

      {/* Zoom control */}
      <div className="bg-black px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <ZoomOut size={20} className="text-white/70 flex-shrink-0" />
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-green-500"
          />
          <ZoomIn size={20} className="text-white/70 flex-shrink-0" />
          <button
            onClick={() => setZoom(1)}
            className="ml-1 text-xs text-white/60 px-2 py-1 rounded-lg bg-white/10 active:scale-95"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

async function cropImage(
  image: HTMLImageElement,
  crop: PixelCrop,
): Promise<File> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  canvas.width = Math.round(crop.width * scaleX);
  canvas.height = Math.round(crop.height * scaleY);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Hindi ma-process ang larawan.');

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.85),
  );
  if (!blob) throw new Error('Hindi ma-crop ang larawan.');
  return new File([blob], 'cropped.webp', { type: 'image/webp' });
}
