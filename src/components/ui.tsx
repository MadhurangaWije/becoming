import { Minus, Plus } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export const haptic = () => {
  try {
    navigator.vibrate?.(10);
  } catch {
    /* unsupported */
  }
};

type Variant = 'primary' | 'secondary' | 'text' | 'danger' | 'dark';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-green text-black font-semibold hover:brightness-95',
  secondary: 'bg-white text-text border border-border hover:bg-surface font-medium',
  text: 'bg-transparent text-blue font-medium hover:bg-blue-soft',
  danger: 'bg-white text-red border border-red/40 hover:bg-red-soft font-medium',
  dark: 'bg-black text-white font-semibold',
};

export function Button({ variant = 'secondary', className = '', children, onClick, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      onClick={(e) => {
        haptic();
        onClick?.(e);
      }}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 text-body transition duration-150 ease-out active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Chip({ selected, onClick, children, className = '', ...rest }: { selected?: boolean; onClick?: () => void; children: ReactNode; className?: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => {
        haptic();
        onClick?.();
      }}
      {...rest}
      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-[15px] font-medium transition duration-150 ease-out active:scale-[0.97] ${
        selected ? 'border-blue bg-blue-soft text-blue' : 'border-border bg-white text-text hover:bg-surface'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function ChipGroup<T extends string>({ value, options, onChange, label }: { value: T | undefined; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o.value} selected={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Chip selected={checked} onClick={() => onChange(!checked)} role="switch" aria-checked={checked}>
      <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${checked ? 'bg-blue' : 'bg-border'}`} />
      {label}
    </Chip>
  );
}

export function Stepper({ value, onChange, step = 5, min = 1, max = 300, unit, label }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; unit?: string; label: string }) {
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, value - step))} className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white active:scale-95">
        <Minus size={20} strokeWidth={1.5} />
      </button>
      <span className="tabular min-w-[80px] text-center text-card" aria-live="polite">
        {value}
        {unit && <span className="ml-1 text-caption text-muted">{unit}</span>}
      </span>
      <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(Math.min(max, value + step))} className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white active:scale-95">
        <Plus size={20} strokeWidth={1.5} />
      </button>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-caption text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-caption text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full min-h-[48px] rounded-xl border border-border bg-surface px-4 py-3 text-body text-text placeholder:text-muted focus:border-blue focus:bg-white focus:outline-none';

export function Card({ children, className = '', ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={`rounded-card border border-border bg-white p-4 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-6 flex items-center justify-between">
      <h2 className="text-card">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-card bg-surface px-4 py-6 text-center text-muted">{children}</p>;
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-full bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-[44px] min-w-0 flex-1 truncate whitespace-nowrap rounded-full px-1.5 text-[14px] font-medium transition duration-150 min-[480px]:px-3 min-[480px]:text-[15px] ${value === o.value ? 'bg-white text-text shadow-sm' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const money = (n: number, currency = 'LKR') => `${currency} ${Math.round(n).toLocaleString('en-US')}`;
