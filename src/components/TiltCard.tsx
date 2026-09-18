'use client';

import { useRef } from 'react';

/**
 * Pointer-driven 3D tilt — real perspective rotation via CSS transforms, not a fake
 * box-shadow trick. This is the site's recurring "this has physical depth" motif, used
 * anywhere a card benefits from feeling tactile (feature cards, concept nodes, orbit chips).
 * Deliberately CSS-only (no three.js/WebGL): cheaper, more accessible, and plenty for a
 * hover/tap accent — a whole 3D engine would be the wrong tool for this job.
 */
export function TiltCard({
  children,
  className = '',
  maxTilt = 10
}: {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform =
      `perspective(900px) rotateX(${(-py * maxTilt).toFixed(2)}deg) ` +
      `rotateY(${(px * maxTilt).toFixed(2)}deg) translateZ(8px)`;
  }

  function handleLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={'transition-transform duration-200 ease-out will-change-transform ' + className}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {children}
    </div>
  );
}
