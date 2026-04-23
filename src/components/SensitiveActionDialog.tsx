import React from 'react';
import { AlertCircle, Loader2, ShieldAlert } from 'lucide-react';

interface SensitiveActionDialogProps {
  open: boolean;
  title: string;
  description: string;
  guidanceText?: string;
  implications?: string[];
  tone?: 'danger' | 'warning';
  typedLabel?: string;
  typedValue?: string;
  typedPlaceholder?: string;
  onTypedValueChange?: (value: string) => void;
  confirmLabel: string;
  cancelLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
  confirmDisabled?: boolean;
  error?: string | null;
  successMessage?: string | null;
  footerNote?: string;
}

export default function SensitiveActionDialog({
  open,
  title,
  description,
  guidanceText,
  implications = [],
  tone = 'danger',
  typedLabel,
  typedValue = '',
  typedPlaceholder,
  onTypedValueChange,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onClose,
  onConfirm,
  busy = false,
  confirmDisabled = false,
  error,
  successMessage,
  footerNote,
}: SensitiveActionDialogProps) {
  if (!open) return null;

  const isDanger = tone === 'danger';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className={`flex items-center gap-3 mb-4 ${isDanger ? 'text-red-600' : 'text-amber-600'}`}>
          {isDanger ? <ShieldAlert size={28} /> : <AlertCircle size={24} />}
          <h3 className="text-2xl font-black uppercase tracking-tight">{title}</h3>
        </div>

        <div className="space-y-5">
          <div className={`p-4 rounded-xl border ${isDanger ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
            <p className={`text-sm font-bold mb-2 ${isDanger ? 'text-red-800' : 'text-amber-900'}`}>
              ATENÇÃO: AÇÃO SENSÍVEL
            </p>
            <p className={`text-sm leading-relaxed ${isDanger ? 'text-red-700' : 'text-amber-800'}`}>
              {description}
            </p>
          </div>

          {guidanceText ? (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">
                Orientação de segurança
              </p>
              <p className="text-xs text-blue-700 leading-relaxed whitespace-pre-wrap">{guidanceText}</p>
            </div>
          ) : null}

          {implications.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Implicações desta ação
              </p>
              <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
                {implications.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {typedLabel ? (
            <div className="space-y-3">
              <label className="block text-sm font-bold text-gray-700">
                Para confirmar, digite{' '}
                <span className={isDanger ? 'text-red-600 font-black' : 'text-amber-700 font-black'}>
                  {typedLabel}
                </span>
                :
              </label>
              <input
                type="text"
                value={typedValue}
                onChange={(e) => onTypedValueChange?.(e.target.value)}
                placeholder={typedPlaceholder || 'Digite a confirmação aqui'}
                className={`w-full px-4 py-3 border-2 rounded-xl outline-none font-bold transition-colors ${
                  isDanger
                    ? 'border-red-100 focus:border-red-500'
                    : 'border-amber-100 focus:border-amber-500'
                }`}
              />
            </div>
          ) : null}

          {footerNote ? (
            <p className="text-xs text-gray-500 leading-relaxed">{footerNote}</p>
          ) : null}

          {error ? (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg font-medium flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          ) : null}

          {successMessage ? (
            <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg font-medium">
              {successMessage}
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-3 border rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
            className={`flex-1 py-3 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-100'
                : 'bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-100'
            }`}
          >
            {busy ? <Loader2 className="animate-spin h-5 w-5" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
