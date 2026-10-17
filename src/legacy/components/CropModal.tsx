// @ts-nocheck
import { useCallback, useState, useRef, useEffect } from 'react';
import ReactCrop, { convertToPixelCrop, type Crop, type PixelCrop } from 'react-image-crop';
import { makeCrop } from '../lib/imageCrop';
import { Button } from '@/components/ui/button';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';

interface CropModalProps {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void;
  defaultAspect?: number;
  originalFile?: File;
}

export function CropModal({ imageSrc, onCancel, onConfirm, defaultAspect, originalFile }: CropModalProps) {
  const [crop, setCrop] = useState<Crop>();
  const [zoom, setZoom] = useState(1);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [processing, setProcessing] = useState(false);
  const [aspect, setAspect] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    setImgSize({ w: natW, h: natH });
    setCrop(makeCrop(natW, natH));
  }, []);

  function applyAspect(next: number | undefined) {
    setAspect(next);
    setCrop(makeCrop(imgSize.w, imgSize.h, next));
  }

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
    const img = imgRef.current;
    if (!crop || !img) return;
    setProcessing(true);
    setError(null);
    try {
      const file = await cropImage(img, convertToPixelCrop(crop, img.width, img.height));
      onConfirm(file);
    } catch {
      setError('Hindi ma-process ang larawan. Subukan muli.');
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-foreground text-primary-foreground flex flex-col">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Button variant="ghost"
          onClick={onCancel}
          disabled={processing}
          className="flex items-center gap-1.5 text-sm font-medium active:scale-95 transition disabled:opacity-50"
        >
          <X size={20} /> Kanselahin
        </Button>
        <span className="order-first w-full text-center text-sm font-semibold sm:order-none sm:w-auto">Ayusin ang Larawan</span>
        <Button
          onClick={handleConfirm}
          disabled={processing || !imgSize.w}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg active:scale-95 transition disabled:opacity-50"
        >
          {processing ? (
            <span className="animate-pulse">Nagpro-proseso...</span>
          ) : (
            <>
              <Check size={18} /> I-upload
            </>
          )}
        </Button>
      </div>

      {originalFile && (
        <div className="flex justify-center px-4 pb-3">
          <Button type="button" disabled={processing} onClick={() => { setProcessing(true); onConfirm(originalFile); }}>
            <Check /> I-upload nang walang crop
          </Button>
        </div>
      )}
      {error && <p role="alert" className="px-4 text-center text-destructive">{error}</p>}

      {/* Mga preset na sukat */}
      <div className="flex items-center justify-center gap-2 px-4 pb-2">
        <Button variant={aspect === 16 / 9 ? 'default' : 'secondary'} size="sm"
          type="button"
          onClick={() => applyAspect(16 / 9)}
        >
          Pahiga (banner)
        </Button>
        <Button variant={aspect === 1 ? 'default' : 'secondary'} size="sm"
          type="button"
          onClick={() => applyAspect(1)}
        >
          Parisukat
        </Button>
        <Button variant={aspect === undefined ? 'default' : 'secondary'} size="sm"
          type="button"
          onClick={() => applyAspect(undefined)}
        >
          Libreng sukat
        </Button>
      </div>

      {/* Crop area */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden flex items-center justify-center px-4"
      >
        {displaySize.w > 0 && (
          <div style={{ width: displaySize.w, height: displaySize.h }} className="relative">
            <ReactCrop
              style={{ maxWidth: 'none' }}
              crop={crop}
              aspect={aspect}
              onChange={(_, percent) => setCrop(percent)}
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
                className="select-none pointer-events-none !max-w-none"
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
      <div className="bg-foreground px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <ZoomOut size={20} className="opacity-70 flex-shrink-0" />
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="min-w-0 flex-1 accent-primary"
          />
          <ZoomIn size={20} className="opacity-70 flex-shrink-0" />
          <Button variant="secondary" size="sm"
            onClick={() => setZoom(1)}
          >
            Reset
          </Button>
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
