import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Standard page frame: consistent max width, side padding and vertical rhythm. */
export function Page({ children, wide = false, className }: { children: ReactNode; wide?: boolean; className?: string }) {
  return (
    <main
      className={cn('mx-auto w-full px-4 pb-20 pt-7 sm:px-6', className)}
      style={{ maxWidth: wide ? 'var(--page-max)' : '1360px' }}
    >
      {children}
    </main>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line pb-5', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-3">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-fg">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-fg-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
