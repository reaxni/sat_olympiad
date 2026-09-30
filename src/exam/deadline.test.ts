import { describe, expect, it } from 'vitest';
import { examDeadline } from './deadline';

describe('exam closing deadline', () => {
  it('stops at the shared close when a section would run longer', () => {
    expect(examDeadline('2026-10-01T12:35:00Z', '2026-10-01T12:04:00Z')).toBe(Date.parse('2026-10-01T12:04:00Z'));
  });
  it('keeps an earlier section deadline', () => {
    expect(examDeadline('2026-10-01T12:02:00Z', '2026-10-01T12:04:00Z')).toBe(Date.parse('2026-10-01T12:02:00Z'));
  });
});
