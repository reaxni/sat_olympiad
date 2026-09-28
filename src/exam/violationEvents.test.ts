import { describe, expect, it } from 'vitest';
import { createViolationDeduper } from './violationEvents';
describe('related browser observations', () => {
  it('reports a tab switch once even when fullscreen and pagehide also fire', () => {
    const observe = createViolationDeduper();
    const first = observe('tab-hidden', 1000);
    expect(first?.kind).toBe('tab-hidden');
    expect(observe('fullscreen-exited', 1100)).toBeNull();
    expect(observe('page-exit', 1200)).toBeNull();
    expect(observe('window-blurred', 1300)).toBeNull();
    expect(observe('paste', 1400)?.kind).toBe('paste');
    expect(observe('context-menu', 1500)?.kind).toBe('context-menu');
    expect(observe('paste', 1600)).toBeNull();
    expect(observe('tab-hidden', 4000)?.eventId).not.toBe(first?.eventId);
  });
});
