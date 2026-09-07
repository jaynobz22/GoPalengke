import { useState } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { OrderStatus } from '@/lib/types';

export interface StepInfo {
  key: string;
  label: string;
  description: string;
  status: 'completed' | 'active' | 'pending';
}

interface OrderStepTrackerProps {
  steps: StepInfo[];
  currentStepIndex: number;
}

export function OrderStepTracker({ steps, currentStepIndex }: OrderStepTrackerProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  function toggleStep(key: string) {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const completedSteps = steps.slice(0, currentStepIndex);
  const activeStep = steps[currentStepIndex];
  const pendingSteps = steps.slice(currentStepIndex + 1);

  return (
    <div className="space-y-2">
      {/* Completed steps — collapsed by default, expandable */}
      {completedSteps.map((step) => {
        const isExpanded = expandedSteps.has(step.key);
        return (
          <div key={step.key} className="bg-green-50/50 border border-green-200 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleStep(step.key)}
              className="w-full flex items-center gap-3 p-3 text-left active:scale-[0.98] transition"
            >
              <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <Check size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-800 truncate">{step.label}</p>
                {!isExpanded && (
                  <p className="text-xs text-green-600 truncate">{step.description}</p>
                )}
              </div>
              {isExpanded
                ? <ChevronUp size={16} className="text-green-500 flex-shrink-0" />
                : <ChevronDown size={16} className="text-green-500 flex-shrink-0" />
              }
            </button>
            {isExpanded && (
              <div className="px-3 pb-3 pl-12">
                <p className="text-sm text-green-700 leading-relaxed">{step.description}</p>
              </div>
            )}
          </div>
        );
      })}

      {/* Active step — always expanded */}
      {activeStep && (
        <div className="bg-brand-50 border-2 border-brand-400 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0 animate-pulse">
              <span className="text-white font-bold text-sm">{currentStepIndex + 1}</span>
            </div>
            <div className="flex-1">
              <p className="font-bold text-brand-800">{activeStep.label}</p>
            </div>
            <span className="text-[10px] font-bold text-white bg-brand-500 px-2 py-0.5 rounded-full">
              KASALUKUYAN
            </span>
          </div>
          <p className="text-sm text-brand-700 leading-relaxed pl-11">{activeStep.description}</p>
        </div>
      )}

      {/* Pending steps — collapsed, dimmed */}
      {pendingSteps.map((step, i) => (
        <div key={step.key} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3 opacity-60">
          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            <span className="text-gray-400 font-bold text-xs">{currentStepIndex + 2 + i}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-500 truncate">{step.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
