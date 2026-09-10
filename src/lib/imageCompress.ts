const MAX_WIDTH = 800;
const MAX_HEIGHT = 800;
const QUALITY = 0.7;
const TARGET_MAX_BYTES = 200_000;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Not an image file.');
  }

  // HEIC/HEIF files from iPhone cannot be decoded by canvas in most browsers.
  // Skip compression and return the original file — the storage layer handles it.
  if (file.type === 'image/heic' || file.type === 'image/heif' || file.type === 'image/heic-sequence') {
    return file;
  }

  const canvas = await fileToCanvas(file);
  if (!canvas) throw new Error('Could not process image.');

  let blob = await tryCompress(canvas, 'image/webp', QUALITY, TARGET_MAX_BYTES)
    || await tryCompress(canvas, 'image/jpeg', QUALITY, TARGET_MAX_BYTES);

  if (!blob) throw new Error('Could not compress image.');
  const ext = blob.type.split('/')[1] || 'jpg';
  return new File([blob], `chat.${ext}`, { type: blob.type });
}

async function fileToCanvas(file: File): Promise<HTMLCanvasElement | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return bitmapToCanvas(bitmap);
    } catch { /* fall through to <img> approach */ }
  }

  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(imgToCanvas(img));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function bitmapToCanvas(bitmap: ImageBitmap): HTMLCanvasElement {
  const scale = Math.min(MAX_WIDTH / bitmap.width, MAX_HEIGHT / bitmap.height, 1);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Hindi ma-process ang larawan.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
}

function imgToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const scale = Math.min(MAX_WIDTH / img.naturalWidth, MAX_HEIGHT / img.naturalHeight, 1);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Hindi ma-process ang larawan.');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

async function tryCompress(
  canvas: HTMLCanvasElement,
  type: string,
  initialQuality: number,
  targetMaxBytes: number,
): Promise<Blob | null> {
  let quality = initialQuality;
  let blob = await canvasToBlob(canvas, type, quality);

  while (blob && blob.size > targetMaxBytes && quality > 0.3) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, type, quality);
  }

  return blob;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}
