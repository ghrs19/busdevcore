import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'note' | 'brand' | 'plum';

const toneText: Record<Tone, string> = {
  neutral: 'text-fg',
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
  note: 'text-note',
  brand: 'text-brand-fg',
  plum: 'text-plum',
};

const toneChip: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-fg-3',
  ok: 'bg-[var(--color-success-bg)] text-ok',
  warn: 'bg-[var(--color-warning-bg)] text-warn',
  bad: 'bg-[var(--color-danger-bg)] text-bad',
  note: 'bg-[var(--color-info-bg)] text-note',
  brand: 'bg-[var(--accent-light)] text-brand-fg',
  plum: 'bg-[var(--color-violet-bg)] text-plum',
};

/** Card surface. Padding is explicit so dense and roomy cards share one component. */
export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <section className={cn('linear-card', padded && 'p-5', className)}>{children}</section>;
}

/**
 * KPI tile. Colour carries meaning only: the value stays neutral unless `tone` flags a state
 * (overdue = bad, collected = ok); the icon chip is the only decorative accent.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  valueTone,
  badge,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  valueTone?: Tone;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[12px] font-medium leading-snug text-fg-3">{label}</span>
        {badge ? (
          badge
        ) : Icon ? (
          <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', toneChip[tone])}>
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <div className={cn('font-mono-numbers text-[24px] font-semibold leading-none tracking-[-0.02em]', toneText[valueTone ?? 'neutral'])}>{value}</div>
      {hint && <div className="text-[12px] leading-snug text-fg-3">{hint}</div>}
    </Card>
  );
}

/** Wrapper for charts / breakdowns: title, optional legend + period slot, loading and empty states. */
export function ChartCard({
  title,
  description,
  icon: Icon,
  actions,
  legend,
  loading,
  empty,
  emptyText = 'Belum ada data untuk ditampilkan.',
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  legend?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyText?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card padded={false} className={cn('flex min-w-0 flex-col', className)}>
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />}
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold leading-tight text-fg">{title}</h3>
            {description && <p className="mt-1 text-[12px] leading-snug text-fg-3">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className={cn('min-h-[120px] flex-1 p-5', bodyClassName)}>
        {loading ? (
          <div className="space-y-3" aria-busy="true">
            <div className="h-3 w-1/3 animate-pulse rounded bg-surface-2" />
            <div className="h-24 animate-pulse rounded bg-surface-2" />
          </div>
        ) : empty ? (
          <div className="grid h-full min-h-[96px] place-items-center text-center text-[13px] text-fg-3">{emptyText}</div>
        ) : (
          children
        )}
      </div>
      {legend && <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line px-5 py-3 text-[12px] text-fg-3">{legend}</div>}
    </Card>
  );
}

/** Legend entry for ChartCard. */
export function LegendDot({ tone = 'brand', children }: { tone?: Tone; children: ReactNode }) {
  const dot: Record<Tone, string> = {
    neutral: 'bg-fg-3',
    ok: 'bg-ok',
    warn: 'bg-warn',
    bad: 'bg-bad',
    note: 'bg-note',
    brand: 'bg-brand',
    plum: 'bg-plum',
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-2 rounded-full', dot[tone])} aria-hidden />
      {children}
    </span>
  );
}

/** Horizontal share bar, used for pipeline / status breakdowns. */
export function MeterRow({ label, value, total, tone = 'brand', right }: { label: ReactNode; value: number; total: number; tone?: Tone; right?: ReactNode }) {
  const pct = total > 0 ? Math.max(value > 0 ? 3 : 0, Math.round((value / total) * 100)) : 0;
  const fill: Record<Tone, string> = {
    neutral: 'bg-fg-3',
    ok: 'bg-ok',
    warn: 'bg-warn',
    bad: 'bg-bad',
    note: 'bg-note',
    brand: 'bg-brand',
    plum: 'bg-plum',
  };
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
        <span className="min-w-0 truncate text-fg-2">{label}</span>
        <span className="font-mono-numbers shrink-0 font-semibold text-fg">{right ?? value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${pct}%`}>
        <div className={cn('h-full rounded-full', fill[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
