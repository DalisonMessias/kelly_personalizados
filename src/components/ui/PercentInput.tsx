import React from 'react';

interface PercentInputProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  min?: number;
  max?: number;
  allowEmpty?: boolean;
}

export function PercentInput({
  value,
  onChange,
  placeholder = '0%',
  className = 'input-base pr-10',
  disabled = false,
  ariaLabel,
  min = 0,
  max = 100,
  allowEmpty = false,
}: PercentInputProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
    if (!digits) {
      onChange(allowEmpty ? undefined : 0);
      return;
    }

    const parsed = Number(digits);
    if (!Number.isFinite(parsed)) return;
    onChange(Math.max(min, Math.min(max, parsed)));
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={value === undefined ? '' : String(value)}
        onChange={handleChange}
        onFocus={(event) => event.currentTarget.select()}
        placeholder={placeholder.replace('%', '')}
        className={className}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">%</span>
    </div>
  );
}
