declare global {
  interface Window {
    ZegoUIKitPrebuilt: any;
  }
}

const ZEGO_CDN_URLS = [
  'https://unpkg.com/@zegocloud/zego-uikit-prebuilt@2.18.4/zego-uikit-prebuilt.js',
  'https://www.unpkg.com/@zegocloud/zego-uikit-prebuilt@2.18.4/zego-uikit-prebuilt.js',
  'https://cdn.jsdelivr.net/npm/@zegocloud/zego-uikit-prebuilt@2.18.4/zego-uikit-prebuilt.js',
  'https://static.zegocloud.com/zego-uikit-prebuilt/zego-uikit-prebuilt.js',
];

let loadPromise: Promise<any> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(script);
  });
}

export function loadZegoSDK(): Promise<any> {
  if (typeof window !== 'undefined' && window.ZegoUIKitPrebuilt) {
    return Promise.resolve(window.ZegoUIKitPrebuilt);
  }
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    for (const url of ZEGO_CDN_URLS) {
      try {
        console.log('[ZEGO] Loading SDK from', url);
        await loadScript(url);
        if (window.ZegoUIKitPrebuilt) {
          console.log('[ZEGO] SDK loaded successfully from', url);
          return window.ZegoUIKitPrebuilt;
        }
      } catch (err) {
        console.warn('[ZEGO] Failed to load from', url, err);
      }
    }
    throw new Error('ZEGOCLOUD SDK failed to load from all CDN sources');
  })();

  return loadPromise;
}

export function isZegoLoaded(): boolean {
  return typeof window !== 'undefined' && !!window.ZegoUIKitPrebuilt;
}

export function getZegoUIKitPrebuilt(): any {
  if (typeof window === 'undefined') {
    throw new Error('ZEGOCLOUD SDK can only be used in the browser');
  }
  if (!window.ZegoUIKitPrebuilt) {
    throw new Error('ZEGOCLOUD SDK is not loaded yet');
  }
  return window.ZegoUIKitPrebuilt;
}
