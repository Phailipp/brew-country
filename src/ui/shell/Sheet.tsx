import { useEffect, useId, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import './Sheet.css';

export type SheetSnap = 'half' | 'full';

interface Props {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  /** Optional element left of the title (e.g. back button). */
  leading?: ReactNode;
  initialSnap?: SheetSnap;
  children: ReactNode;
  /** Changing the key resets scroll + snap (e.g. when switching tabs). */
  contentKey?: string;
}

/**
 * Bottom sheet on phones (drag handle, half/full snap, swipe down to close),
 * floating side panel on wide screens. Pure CSS transforms, no animation lib.
 */
export function Sheet({ open, title, onClose, leading, initialSnap = 'half', children, contentKey }: Props) {
  const [snap, setSnap] = useState<SheetSnap>(initialSnap);
  const [dragY, setDragY] = useState<number | null>(null);
  const [lastKey, setLastKey] = useState(contentKey);
  const drag = useRef<{ startY: number; startTime: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  // Reset snap when the content changes (adjusting state during render)
  if (contentKey !== lastKey) {
    setLastKey(contentKey);
    setSnap(initialSnap);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [contentKey]);

  // Focus moves into the sheet when it opens and back to the trigger when it closes
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    titleRef.current?.focus({ preventScroll: true });
    return () => {
      if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const onPointerDown = (e: ReactPointerEvent) => {
    drag.current = { startY: e.clientY, startTime: performance.now() };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragY(0);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    setDragY(e.clientY - drag.current.startY);
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.startY;
    const velocity = dy / Math.max(1, performance.now() - drag.current.startTime);
    drag.current = null;
    setDragY(null);
    if (Math.abs(dy) < 6) {
      setSnap((s) => (s === 'half' ? 'full' : 'half'));
    } else if (dy > 120 || velocity > 0.8) {
      if (snap === 'full' && dy < 320) setSnap('half');
      else onClose();
    } else if (dy < -60 || velocity < -0.6) {
      setSnap('full');
    }
  };

  const style = dragY !== null
    ? { transform: `translateY(max(0px, calc(var(--sheet-offset) + ${dragY}px)))`, transition: 'none' }
    : undefined;

  return (
    <>
    <div className={`sheet-scrim${open && snap === 'full' ? ' visible' : ''}`} onClick={onClose} aria-hidden="true" />
    <section
      className={`sheet glass-panel sheet-${snap}${open ? ' open' : ''}`}
      style={style}
      role="dialog"
      aria-modal={snap === 'full' ? true : undefined}
      aria-labelledby={titleId}
      aria-hidden={!open}
      inert={!open}
    >
      <div
        className="sheet-grabber"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="button"
        tabIndex={0}
        aria-label={snap === 'half' ? 'Panel vergrößern' : 'Panel verkleinern'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setSnap((s) => (s === 'half' ? 'full' : 'half'));
          else if (e.key === 'ArrowUp') setSnap('full');
          else if (e.key === 'ArrowDown') setSnap('half');
        }}
      >
        <span />
      </div>
      <header className="sheet-header">
        {leading}
        <h2 key={contentKey} id={titleId} ref={titleRef} tabIndex={-1} className="sheet-title sheet-enter">{title}</h2>
        <button className="icon-btn sheet-close" onClick={onClose} aria-label="Schließen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>
      <div className="sheet-scroll" ref={scrollRef}>
        {/* Re-keyed per content: plays a cheap CSS enter animation (no full-page snapshot) */}
        <div key={contentKey} className="sheet-body sheet-enter">
          {children}
        </div>
      </div>
    </section>
    </>
  );
}
