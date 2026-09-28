import { describe, expect, it } from 'vitest';
import { loadPendingEvents, savePendingEvents } from './violationQueue';
import type { ViolationReport } from '../domain/exam';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

describe('unconfirmed event recovery', () => {
  it('keeps the same event ID across reloads and clears it after acknowledgement', () => {
    const storage = memoryStorage();
    const event: ViolationReport = { eventId: 'stable-1', kind: 'tab-hidden', observedAt: '2026-09-28T12:00:00Z' };
    expect(savePendingEvents('attempt-1', [event], storage)).toBe(true);
    expect(loadPendingEvents('attempt-1', storage)).toEqual([event]);
    expect(loadPendingEvents('attempt-2', storage)).toEqual([]);
    expect(savePendingEvents('attempt-1', [], storage)).toBe(true);
    expect(loadPendingEvents('attempt-1', storage)).toEqual([]);
  });

  it('discards malformed events rather than sending them to the server', () => {
    const storage = memoryStorage();
    storage.setItem('1609:pending-events:attempt-1', JSON.stringify([
      { eventId: 'bad', kind: 'unknown', observedAt: '2026-09-28T12:00:00Z' },
      { eventId: 'good', kind: 'copy', observedAt: '2026-09-28T12:00:00Z' },
    ]));
    expect(loadPendingEvents('attempt-1', storage).map((event) => event.eventId)).toEqual(['good']);
  });
});
