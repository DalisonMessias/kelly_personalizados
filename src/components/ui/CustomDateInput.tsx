import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface CustomDateInputProps {
  label?: string;
  value: string; // ISO string ou YYYY-MM-DD
  onChange: (date: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CustomDateInput({
  label,
  value,
  onChange,
  placeholder = 'Selecione a data',
  disabled = false,
  className = '',
}: CustomDateInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse da data selecionada
  const initialDate = value ? new Date(value) : new Date();
  const validInitialDate = isNaN(initialDate.getTime()) ? new Date() : initialDate;

  const [viewYear, setViewYear] = useState(validInitialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(validInitialDate.getMonth());

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Dias do mês
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const selected = new Date(viewYear, viewMonth, day);
    // Formato YYYY-MM-DD
    const isoString = selected.toISOString().split('T')[0];
    onChange(isoString);
    setIsOpen(false);
  };

  // Formatação para exibição no input (DD/MM/AAAA)
  const displayFormattedDate = () => {
    if (!value) return '';
    try {
      const parts = value.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('pt-BR');
      }
    } catch {
      return value;
    }
    return value;
  };

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
        <span className={value ? 'font-medium text-slate-800' : 'text-slate-400'}>
          {value ? displayFormattedDate() : placeholder}
        </span>
        <CalendarIcon className="w-4 h-4 text-brand-600 flex-shrink-0" />
      </button>

      {/* Popover do Calendário customizado */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-40 bg-white border border-slate-100 rounded-2xl shadow-2xl p-4 w-72 animate-in fade-in zoom-in-95 duration-150">
          {/* Navegação do mês/ano */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-slate-800">
              {monthNames[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Dias da semana */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {daysOfWeek.map((day) => (
              <span key={day} className="text-[11px] font-semibold text-slate-400">
                {day}
              </span>
            ))}
          </div>

          {/* Grade dos dias */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="w-8 h-8" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateObj = new Date(viewYear, viewMonth, day);
              const iso = dateObj.toISOString().split('T')[0];
              const isSelected = value?.startsWith(iso);
              const isToday = new Date().toISOString().split('T')[0] === iso;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-brand-600 text-white font-bold shadow-md shadow-brand-500/20'
                      : isToday
                      ? 'border border-brand-300 text-brand-700 bg-brand-50 font-semibold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Atalho rápido */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                const todayIso = new Date().toISOString().split('T')[0];
                onChange(todayIso);
                setIsOpen(false);
              }}
              className="text-brand-600 font-semibold hover:underline"
            >
              Hoje
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
