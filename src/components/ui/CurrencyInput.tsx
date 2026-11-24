import React from 'react';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function centsToReais(cents: number): number {
  return Math.max(0, Number((cents / 100).toFixed(2)));
}

export function reaisToCents(reais: number): number {
  return Math.max(0, Math.round((reais || 0) * 100));
}

export function formatBrazilianCurrencyInput(value: number): string {
  const cents = reaisToCents(value);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centsToReais(cents));
}

export function parseBrazilianDigits(rawValue: string): number {
  const digits = rawValue.replace(/\D/g, '');
  if (!digits) return 0;
  return Number(digits) / 100;
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = 'R$ 0,00',
  className = 'input-base',
  disabled = false,
  ariaLabel,
}: CurrencyInputProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (!raw.replace(/\D/g, '')) {
      onChange(0);
      return;
    }

    const parsed = parseBrazilianDigits(raw);
    onChange(parsed);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={formatBrazilianCurrencyInput(value)}
      onChange={handleChange}
      onFocus={(event) => event.currentTarget.select()}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      aria-label={ariaLabel}
    />
  );
}
