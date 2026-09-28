import type { ViolationReport } from '../domain/exam';

const prefix = '1609:pending-events:';
const kinds = new Set<ViolationReport['kind']>([
  'tab-hidden', 'window-blurred', 'fullscreen-exited', 'page-exit', 'copy', 'cut', 'paste',
  'print', 'context-menu', 'developer-shortcut', 'connection-lost', 'connection-restored', 'window-shrunk',
]);

/** These are unconfirmed browser observations, never a substitute for the server's record. */
export function loadPendingEvents(attemptId: string, storage?: Storage): ViolationReport[] {
  try {
    const value: unknown = JSON.parse((storage ?? localStorage).getItem(prefix + attemptId) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((event): event is ViolationReport =>
      event !== null && typeof event === 'object'
      && typeof event.eventId === 'string' && event.eventId.length > 0 && event.eventId.length <= 100
      && kinds.has(event.kind)
      && typeof event.observedAt === 'string' && Number.isFinite(Date.parse(event.observedAt))
      && (event.relatedEventId === undefined || typeof event.relatedEventId === 'string')
    ).slice(0, 100);
  } catch { return []; }
}

export function savePendingEvents(attemptId: string, events: Iterable<ViolationReport>, storage?: Storage): boolean {
  try {
    const list = [...events];
    if (list.length) (storage ?? localStorage).setItem(prefix + attemptId, JSON.stringify(list));
    else (storage ?? localStorage).removeItem(prefix + attemptId);
    return true;
  } catch { return false; }
}

export function eventLabel(kind: ViolationReport['kind']): string {
  return ({
    'tab-hidden': 'The exam tab was hidden', 'window-blurred': 'The exam window lost focus',
    'fullscreen-exited': 'Full screen was exited', 'page-exit': 'The exam page was left',
    copy: 'Copy was attempted', cut: 'Cut was attempted', paste: 'Paste was attempted',
    print: 'Print was attempted', 'context-menu': 'The context menu was opened',
    'developer-shortcut': 'A developer tools shortcut was pressed',
    'connection-lost': 'The connection was lost', 'connection-restored': 'The connection returned',
    'window-shrunk': 'The exam window was sharply reduced',
  } satisfies Record<ViolationReport['kind'], string>)[kind];
}
