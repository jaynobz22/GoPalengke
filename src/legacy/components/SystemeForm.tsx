import { useEffect, useRef } from 'react';

const SCRIPT_ID = 'form-script-tag-25900714';
const SCRIPT_SRC = 'https://juls.systeme.io/public/remote/page/45965604df7fd16b3c536343209b9620f6389809.js';

/** Loads the systeme.io subscriber popup form once per page visit (client only). */
export function SystemeForm() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    const w = window as unknown as { __systemeLoaded?: boolean };
    if (!host || w.__systemeLoaded || document.getElementById(SCRIPT_ID)) return;
    w.__systemeLoaded = true;
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = SCRIPT_SRC;
    s.async = true;
    // Systeme waits for window.onload, which already fired in this app (page opened via in-app navigation
    // or loaded before the script) — so trigger it manually once the script is ready. Fixes phones.
    s.onload = () => {
      if (document.readyState === 'complete' && typeof window.onload === 'function') {
        window.onload.call(window, new Event('load'));
      }
    };
    host.appendChild(s);
    return () => { s.remove(); w.__systemeLoaded = false; };
  }, []);
  return <div ref={ref} />;
}
