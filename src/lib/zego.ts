declare global {
  interface Window {
    ZegoUIKitPrebuilt: any;
  }
}

export function getZegoUIKitPrebuilt(): any {
  if (typeof window === 'undefined') {
    throw new Error('ZEGOCLOUD SDK can only be used in the browser');
  }
  if (!window.ZegoUIKitPrebuilt) {
    throw new Error('ZEGOCLOUD SDK is still loading. Please try again in a moment.');
  }
  return window.ZegoUIKitPrebuilt;
}
