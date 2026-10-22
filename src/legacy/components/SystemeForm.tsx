import { useEffect, useRef } from 'react';

const SCRIPT_ID = 'form-script-tag-25900714';
const SCRIPT_SRC = 'https://juls.systeme.io/public/remote/page/45965604df7fd16b3c536343209b9620f6389809.js';

/** Loads the systeme.io subscriber popup form once per page visit (client only). */
export function SystemeForm() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host || document.getElementById(SCRIPT_ID)) return;
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = SCRIPT_SRC;
    s.async = true;
    host.appendChild(s);
    return () => { s.remove(); };
  }, []);
  return <div ref={ref} />;
}
