import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

/** Pointer and keyboard movement for temporary exam tools. */
export function useDragOffset() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const start = useRef<{ x: number; y: number; offset: { x: number; y: number }; bounds: DOMRect } | null>(null);
  useEffect(() => {
    const resetPosition = () => { start.current = null; setOffset({ x: 0, y: 0 }); };
    window.addEventListener('resize', resetPosition);
    return () => window.removeEventListener('resize', resetPosition);
  }, []);
  const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
  const handle = {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      const bounds = event.currentTarget.closest<HTMLElement>('.movable-panel')?.getBoundingClientRect();
      if (!bounds) return;
      start.current = { x: event.clientX, y: event.clientY, offset, bounds };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      const value = start.current; if (!value) return;
      const dx = event.clientX - value.x; const dy = event.clientY - value.y;
      setOffset({ x: value.offset.x + clamp(dx, 8 - value.bounds.left, window.innerWidth - 8 - value.bounds.right), y: value.offset.y + clamp(dy, 8 - value.bounds.top, window.innerHeight - 8 - value.bounds.bottom) });
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => { start.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); },
    onPointerCancel: () => { start.current = null; },
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      const movement = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[event.key] as [number, number] | undefined;
      if (!movement) return; event.preventDefault();
      const bounds = event.currentTarget.closest<HTMLElement>('.movable-panel')?.getBoundingClientRect();
      if (!bounds) return;
      setOffset((old) => ({ x: old.x + clamp(movement[0], 8 - bounds.left, window.innerWidth - 8 - bounds.right), y: old.y + clamp(movement[1], 8 - bounds.top, window.innerHeight - 8 - bounds.bottom) }));
    },
  };
  return { style: { transform: `translate(${offset.x}px, ${offset.y}px)` }, handle };
}
