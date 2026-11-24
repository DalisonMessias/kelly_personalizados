import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
}

interface CustomSelectProps {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function CustomSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Selecione uma opção',
  disabled = false,
  error,
  className = '',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative flex flex-col gap-1.5 ${className}`} ref={containerRef}>
      {label && <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">{label}</label>}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-white border rounded-xl text-sm transition-all shadow-sm ${
          isOpen ? 'border-brand-500 ring-2 ring-brand-100' : 'border-slate-200 hover:border-slate-300'
        } ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'text-slate-800'}`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption?.icon}
          <span className={selectedOption ? 'font-medium' : 'text-slate-400'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-brand-500' : ''}`}
        />
      </button>

      {/* Menu dropdown flutuante */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-slate-100 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1.5 animate-in fade-in zoom-in-95 duration-150">
          {options.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400 text-center">Nenhuma opção disponível</div>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2 text-sm text-left transition-colors ${
                    isSelected ? 'bg-brand-50 text-brand-800 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.icon}
                    <span>{opt.label}</span>
                    {opt.hint && <span className="text-xs text-slate-400 font-normal">({opt.hint})</span>}
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-brand-600 flex-shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}

      {error && <span className="text-xs text-rose-500 font-medium">{error}</span>}
    </div>
  );
}
