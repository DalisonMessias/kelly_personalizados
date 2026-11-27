import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface CustomNumberInputProps {
  value: number | undefined;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  unit?: string;
  allowEmpty?: boolean;
  ariaLabel?: string;
}

export function CustomNumberInput({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  placeholder,
  className = '',
  disabled = false,
  unit,
  allowEmpty = false,
  ariaLabel,
}: CustomNumberInputProps) {
  const currentValue = value === undefined ? (allowEmpty ? undefined : min) : value;

  const handleStep = (direction: 'up' | 'down') => {
    if (disabled) return;
    const base = currentValue ?? min;
    const next = direction === 'up' ? base + step : base - step;
    const clamped = Math.max(min, max !== undefined ? Math.min(max, next) : next);
    onChange(Number(clamped.toFixed(4)));
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.replace(/[^0-9.,-]/g, '').replace(',', '.');
    if (!raw) {
      if (allowEmpty) {
        onChange(min);
      } else {
        onChange(min);
      }
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(min, max !== undefined ? Math.min(max, parsed) : parsed);
    onChange(clamped);
  };

  return (
    <div className={`relative flex items-center rounded-xl border border-slate-200 bg-white transition-all focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 ${disabled ? 'opacity-60 bg-slate-50 cursor-not-allowed' : ''} ${className}`}>
      <button
        type="button"
        tabIndex={-1}
        onClick={() => handleStep('down')}
        disabled={disabled || (currentValue !== undefined && currentValue <= min)}
        aria-label="Diminuir valor"
        className="flex h-10 w-9 shrink-0 items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 rounded-l-xl transition"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>

      <input
        type="text"
        inputMode="decimal"
        value={currentValue === undefined ? '' : String(currentValue)}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        className="w-full min-w-0 bg-transparent text-center font-bold text-slate-800 text-sm focus:outline-none py-2"
      />

      {unit && (
        <span className="text-xs font-semibold text-slate-400 pr-2 pointer-events-none shrink-0">
          {unit}
        </span>
      )}

      <button
        type="button"
        tabIndex={-1}
        onClick={() => handleStep('up')}
        disabled={disabled || (max !== undefined && currentValue !== undefined && currentValue >= max)}
        aria-label="Aumentar valor"
        className="flex h-10 w-9 shrink-0 items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 rounded-r-xl transition"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
