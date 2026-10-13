'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Rows3, Rows4 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Density = 'comfortable' | 'compact';

interface DataGridProps {
  children: ReactNode;
  /** Optional heading rendered in the toolbar (left). */
  title?: ReactNode;
  /** Extra toolbar content (filters, search, actions) rendered on the right. */
  actions?: ReactNode;
  /** Pin the first column while scrolling horizontally (default true). */
  stickyFirst?: boolean;
  /** Pin the last column (e.g. row actions) while scrolling horizontally. */
  stickyLast?: boolean;
  /** Max height of the scroll area; enables sticky header while scrolling vertically. */
  maxHeight?: number | string;
  /** Show the comfortable/compact toggle (default true). */
  densityToggle?: boolean;
  /** Stretch the table to 100% width instead of sizing to content. */
  fill?: boolean;
  className?: string;
}

/**
 * Wide-table wrapper. The wrapper is the only scroll container, so sticky header /
 * sticky first column work, edge shadows show when content continues sideways,
 * and the page itself never scrolls horizontally.
 */
export default function DataGrid({
  children,
  title,
  actions,
  stickyFirst = true,
  stickyLast = false,
  maxHeight,
  densityToggle = true,
  fill = true,
  className,
}: DataGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [density, setDensity] = useState<Density>('comfortable');

  useEffect(() => {
    const stored = window.localStorage.getItem('busdevcore-grid-density');
    if (stored === 'compact' || stored === 'comfortable') setDensity(stored);
  }, []);

  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    const root = rootRef.current;
    if (!el || !root) return;
    root.dataset.moreLeft = String(el.scrollLeft > 2);
    root.dataset.moreRight = String(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateEdges();
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    const table = el.firstElementChild;
    if (table) ro.observe(table);
    return () => ro.disconnect();
  }, [updateEdges, children]);

  const changeDensity = (next: Density) => {
    setDensity(next);
    window.localStorage.setItem('busdevcore-grid-density', next);
  };

  const hasToolbar = Boolean(title || actions || densityToggle);

  return (
    <div ref={rootRef} className={cn('dg', className)} data-density={density} data-more-left="false" data-more-right="false">
      {hasToolbar && (
        <div className="dg-toolbar">
          <div className="min-w-0 text-[13px] font-semibold text-fg">{title}</div>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {densityToggle && (
              <div className="inline-flex rounded-full border border-line bg-surface-2 p-0.5" role="group" aria-label="Kepadatan tabel">
                <button
                  type="button"
                  onClick={() => changeDensity('comfortable')}
                  aria-pressed={density === 'comfortable'}
                  title="Nyaman"
                  className={cn('grid size-7 place-items-center rounded-full text-fg-3 transition-colors hover:bg-[var(--accent-hover)] hover:text-white', density === 'comfortable' && 'bg-brand text-white')}
                >
                  <Rows3 className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => changeDensity('compact')}
                  aria-pressed={density === 'compact'}
                  title="Ringkas"
                  className={cn('grid size-7 place-items-center rounded-full text-fg-3 transition-colors hover:bg-[var(--accent-hover)] hover:text-white', density === 'compact' && 'bg-brand text-white')}
                >
                  <Rows4 className="size-4" aria-hidden />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="relative">
        <span className="dg-edge dg-edge-l" aria-hidden />
        <span className="dg-edge dg-edge-r" aria-hidden />
        <div
          ref={scrollRef}
          onScroll={updateEdges}
          className={cn('dg-scroll', stickyFirst && 'dg-sticky-first', stickyLast && 'dg-sticky-last')}
          data-fill={fill ? 'true' : 'false'}
          style={maxHeight ? { maxHeight } : undefined}
          tabIndex={0}
          role="region"
          aria-label={typeof title === 'string' ? title : 'Tabel data'}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
