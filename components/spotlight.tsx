'use client';
import type { PointerEvent, ReactNode } from 'react';

/** Hace que el brillo lila de las cajas (.feature / .course-card) siga al puntero. */
export function Spotlight({ className, children }: { className?: string; children: ReactNode }) {
  function onMove(e: PointerEvent<HTMLDivElement>) {
    const box = (e.target as HTMLElement).closest<HTMLElement>('.feature, .course-card');
    if (!box) return;
    const r = box.getBoundingClientRect();
    box.style.setProperty('--mx', `${e.clientX - r.left}px`);
    box.style.setProperty('--my', `${e.clientY - r.top}px`);
  }
  return <div className={className} onPointerMove={onMove}>{children}</div>;
}
