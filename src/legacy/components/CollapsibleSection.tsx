import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/** Itinatago ang detalye ng order by default; i-tap para ipakita/itago. */
export function CollapsibleSection({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-semibold text-gray-700 active:scale-[0.98] transition"
      >
        <span>{open ? '▾ Itago' : '▸ Ipakita'}: {title}</span>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
