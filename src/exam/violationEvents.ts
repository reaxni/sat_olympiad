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

export function shortcutViolation(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'repeat'>): ViolationReport['kind'] | null {
  if (event.repeat) return null;
  const key = event.key.toLowerCase();
  const modifier = event.ctrlKey || event.metaKey;
  if (event.key === 'F12' || (modifier && key === 'u')
    || (((modifier && event.shiftKey) || (event.metaKey && event.altKey)) && ['i', 'j', 'c', 'k'].includes(key))) return 'developer-shortcut';
  if (modifier && !event.altKey && !event.shiftKey) return ({ c: 'copy', x: 'cut', v: 'paste', p: 'print' } as const)[key as 'c' | 'x' | 'v' | 'p'] ?? null;
  return null;
}
