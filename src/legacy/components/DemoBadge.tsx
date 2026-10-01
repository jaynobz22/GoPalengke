// @ts-nocheck
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Built-in demo stores (always labeled). More can be marked via stores.is_demo.
const BUILTIN = [1, 2, 3, 4, 5].map(n => `a0000001-0000-0000-0000-00000000000${n}`);
let demoIds = new Set<string>(BUILTIN);
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load() {
  if (!loaded) {
    loaded = (async () => {
      const { data, error } = await supabase.from('stores').select('id').eq('is_demo', true);
      if (!error && data) {
        demoIds = new Set([...BUILTIN, ...data.map((s: any) => s.id)]);
        listeners.forEach(l => l());
      }
    })();
  }
  return loaded;
}

export function refreshDemoStores() { loaded = null; return load(); }

export function useIsDemoStore(storeId?: string | null) {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick(t => t + 1);
    listeners.add(l);
    load();
    return () => { listeners.delete(l); };
  }, []);
  return !!storeId && demoIds.has(storeId);
}

export function DemoBadge({ storeId, size = 'sm' }: { storeId?: string | null; size?: 'xs' | 'sm' | 'lg' }) {
  const isDemo = useIsDemoStore(storeId);
  if (!isDemo) return null;
  if (size === 'lg') {
    return (
      <div className="absolute inset-x-0 bottom-0 z-10 bg-amber-500/95 text-white text-center text-xs font-bold py-1.5 px-2">
        🧪 DEMO LANG — Para sa testing, hindi totoong paninda
      </div>
    );
  }
  return (
    <span className={`absolute bottom-1.5 left-1.5 z-10 bg-amber-500 text-white font-bold rounded-full shadow ${size === 'xs' ? 'text-[8px] px-1 py-0' : 'text-[10px] px-2 py-0.5'}`}>
      🧪 DEMO
    </span>
  );
}
