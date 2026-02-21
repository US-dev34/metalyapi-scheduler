import React from 'react';
import { Check, X, AlertCircle, Loader2 } from 'lucide-react';
import type { ChatParseResponse, ParsedAction } from '@/types';
import { cn } from '@/lib/utils';

interface ParsedPreviewProps {
  parsed: ChatParseResponse;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming: boolean;
}

export const ParsedPreview: React.FC<ParsedPreviewProps> = ({
  parsed,
  onConfirm,
  onCancel,
  isConfirming,
}) => {
  if (parsed.confidence < 0.5 && parsed.actions.length === 0) {
    return (
      <div className="border-t border-gray-200 bg-red-50 px-4 py-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <div>
            <p className="text-xs font-medium text-red-700">Mesaj anlasilamadi</p>
            <p className="mt-0.5 text-xs text-red-600">{parsed.summary}</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="mt-2 text-xs font-medium text-red-600 hover:text-red-800"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 bg-amber-50 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-amber-800">
          Preview ({parsed.actions.length} action{parsed.actions.length !== 1 ? 's' : ''})
        </span>
        <span className={cn(
          'rounded-full px-2 py-0.5 text-[10px] font-medium',
          parsed.confidence >= 0.8 ? 'bg-green-200 text-green-800' :
          parsed.confidence >= 0.6 ? 'bg-amber-200 text-amber-800' :
          'bg-red-200 text-red-800',
        )}>
          {(parsed.confidence * 100).toFixed(0)}% confidence
        </span>
      </div>

      <div className="max-h-48 space-y-1.5 overflow-y-auto">
        {parsed.actions.map((action, index) => (
          <ActionCard key={index} action={action} />
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onConfirm}
          disabled={isConfirming}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:bg-green-400"
        >
          {isConfirming ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Applying...</>
          ) : (
            <><Check className="h-3.5 w-3.5" /> Confirm & Apply</>
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={isConfirming}
          className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
};

const ActionCard: React.FC<{ action: ParsedAction }> = ({ action }) => (
  <div className="rounded-md border border-green-200 bg-white px-3 py-2">
    <div className="flex items-center justify-between">
      <span className="font-mono text-xs font-medium text-gray-700">{action.wbs_code}</span>
      <span className="text-[10px] text-gray-500">{action.date}</span>
    </div>
    <div className="mt-1 flex items-baseline gap-3">
      <span className="text-sm font-semibold text-gray-900">{action.actual_manpower} adam</span>
      <span className="text-xs text-gray-600">{action.qty_done} unite</span>
    </div>
    {action.note && (
      <p className="mt-0.5 truncate text-xs text-gray-500">{action.note}</p>
    )}
  </div>
);
