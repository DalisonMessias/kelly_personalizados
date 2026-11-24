import React, { useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  variant?: 'primary' | 'danger' | 'warning';
  showCancelButton?: boolean;
}

export function CustomModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  variant = 'primary',
  showCancelButton = true,
}: CustomModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const confirmVariantClasses = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-500/20',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20',
  }[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-pink-100 w-full max-w-lg max-h-[92dvh] overflow-hidden flex flex-col transform transition-all animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            {variant === 'danger' && <AlertCircle className="w-5 h-5 text-rose-500" />}
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 text-slate-600 text-sm overflow-y-auto min-h-0">
          {description && <p className="mb-4 text-slate-600 leading-relaxed">{description}</p>}
          {children}
        </div>

        {/* Rodapé com botões de ação centralizados e elegantes */}
        <div className="flex items-stretch sm:items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 bg-pink-50/40 border-t border-pink-100 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4">
          {showCancelButton && (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-white hover:border-slate-300 transition-all text-sm shadow-sm active:scale-95"
            >
              {cancelText}
            </button>
          )}
          {onConfirm && (
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`px-5 py-2.5 rounded-xl font-medium transition-all text-sm shadow-md active:scale-95 ${confirmVariantClasses}`}
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
