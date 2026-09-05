const MAX_WIDTH = 800;
const MAX_HEIGHT = 800;
const QUALITY = 0.7;
const TARGET_MAX_BYTES = 200_000;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Hindi ito larawan.');
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(MAX_WIDTH / bitmap.width, MAX_HEIGHT / bitmap.height, 1);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Hindi ma-process ang larawan.');
  ctx.drawImage(bitmap, 0, 0, w, h);

  let quality = QUALITY;
  let blob = await canvasToBlob(canvas, 'image/webp', quality);

  while (blob && blob.size > TARGET_MAX_BYTES && quality > 0.3) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, 'image/webp', quality);
  }

  if (!blob) throw new Error('Hindi ma-compress ang larawan.');
  const ext = blob.type.split('/')[1] || 'webp';
  return new File([blob], `product.${ext}`, { type: blob.type });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}
