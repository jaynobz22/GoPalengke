// @ts-nocheck
import { useEffect, useState, type ReactNode } from 'react';
import { Check, Lock, ChevronDown, ChevronUp } from 'lucide-react';

export interface StepInfo {
  key: string;
  label: string;
  description: string;
  status: 'completed' | 'active' | 'pending';
  /** Label na lalabas kapag tapos na ang step (hal. "Na-check na ang details"). */
  doneLabel?: string;
}

interface OrderStepTrackerProps {
  steps: StepInfo[];
  currentStepIndex: number;
  /** Ang totoong action buttons ng kasalukuyang step — ilalagay sa loob ng active step. */
  children?: ReactNode;
  /** Ipakita lang ang children (hal. kapag cancelled). */
  hidden?: boolean;
}

/**
 * Step ladder: lahat ng step ay mukhang button. Tapos na = gray + ✓ (deactivated),
 * kasalukuyan = berde at kumikislap (dito lang ang pwedeng i-click),
 * susunod pa = gray + 🔒 (locked hanggang matapos ang naunang step).
 */
export function OrderStepTracker({ steps, currentStepIndex, children, hidden }: OrderStepTrackerProps) {
  const [showDone, setShowDone] = useState(false);
  const hasChildren = children != null;

  useEffect(() => {
    const t = window.setTimeout(() => {
      const btn = document.querySelector('.next-action:not(:disabled)') as HTMLElement | null;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 400);
    return () => window.clearTimeout(t);
  }, [currentStepIndex, steps[currentStepIndex]?.description]);

  if (hidden) return <>{children}</>;

  const done = steps.slice(0, currentStepIndex);
  const active = steps[currentStepIndex];
  const pending = steps.slice(currentStepIndex + 1);
  const allDone = currentStepIndex >= steps.length;
  const visibleDone = showDone || done.length <= 2 ? done : done.slice(-1);

  return (
    <div className="space-y-2 mb-3">
      {done.length > 2 && (
        <button type="button" onClick={() => setShowDone(s => !s)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-gray-500">
          <span>{showDone ? 'Itago' : 'Ipakita'} ang {done.length} tapos na hakbang</span>
          {showDone ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}
      {visibleDone.map((s) => {
        const i = steps.indexOf(s);
        return (
          <button key={s.key} type="button" disabled aria-disabled
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-100 border border-gray-200 text-left cursor-not-allowed">
            <span className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <Check size={14} className="text-white" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[10px] font-bold text-gray-400">STEP {i + 1} · TAPOS NA</span>
              <span className="block text-sm font-semibold text-gray-500 truncate">{s.doneLabel || s.label}</span>
            </span>
          </button>
        );
      })}

      {active && !allDone && (
        <div className="rounded-2xl border-2 border-brand-500 bg-brand-50 p-3 shadow-lg shadow-green-600/10">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0 animate-pulse">
              <span className="text-white font-bold text-sm">{currentStepIndex + 1}</span>
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-brand-600">STEP {currentStepIndex + 1} NG {steps.length} · GAWIN NGAYON</p>
              <p className="font-bold text-brand-800 leading-tight">{active.label}</p>
            </div>
          </div>
          <p className="text-xs text-brand-700 leading-relaxed mb-2">{active.description}</p>
          {hasChildren
            ? <div>{children}</div>
            : <p className="text-xs font-semibold text-brand-800">👉 I-click ang kumikislap na berdeng button sa ibaba.</p>}
        </div>
      )}

      {!hasChildren && pending.length > 0 && (
        <p className="px-3 text-[11px] font-semibold text-gray-400">🔒 {pending.length} hakbang pa ang naka-lock: {pending.map(p => p.label).join(' → ')}</p>
      )}
      {hasChildren && pending.map((s, j) => (
        <button key={s.key} type="button" disabled aria-disabled
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-50 border border-dashed border-gray-200 text-left opacity-70 cursor-not-allowed">
          <span className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            <Lock size={12} className="text-gray-400" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[10px] font-bold text-gray-400">STEP {currentStepIndex + 2 + j} · NAKA-LOCK PA</span>
            <span className="block text-sm font-medium text-gray-400 truncate">{s.label}</span>
          </span>
        </button>
      ))}

      {allDone && hasChildren && <div>{children}</div>}
    </div>
  );
}
