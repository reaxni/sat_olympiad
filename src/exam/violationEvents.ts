import type { ViolationReport } from '../domain/exam';

/** Group related focus signals without discarding distinct browser actions. */
export function createViolationDeduper(windowMs = 2200) {
  const lastByGroup = new Map<string, number>();
  return (kind: ViolationReport['kind'], time = performance.now()): ViolationReport | null => {
    const group = ['tab-hidden', 'window-blurred', 'fullscreen-exited', 'page-exit'].includes(kind) ? 'focus' : kind;
    const last = lastByGroup.get(group) ?? -Infinity;
    if (time - last < (group === 'focus' ? windowMs : 500)) return null;
    lastByGroup.set(group, time);
    return { eventId: crypto.randomUUID(), kind, observedAt: new Date().toISOString() };
  };
}
