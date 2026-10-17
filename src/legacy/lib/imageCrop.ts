import type { Crop } from 'react-image-crop';

export function makeCrop(natW: number, natH: number, aspect?: number): Crop {
  if (!aspect || !natW || !natH) return { unit: '%', x: 0, y: 0, width: 100, height: 100 };
  const imgAspect = natW / natH;
  if (imgAspect > aspect) {
    const width = (aspect / imgAspect) * 100;
    return { unit: '%', x: (100 - width) / 2, y: 0, width, height: 100 };
  }
  const height = (imgAspect / aspect) * 100;
  return { unit: '%', x: 0, y: (100 - height) / 2, width: 100, height };
}