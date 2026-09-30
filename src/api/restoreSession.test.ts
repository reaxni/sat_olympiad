import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExamApi } from './client';
import { restoreSession } from './restoreSession';

const student = { id: 'restored', name: 'Student', email: 'student@example.test', grade: 10 };
const response = <T,>(data: T) => ({ data, serverTime: '2026-09-30T00:00:00Z' });
const service = { status: 'available' as const, environment: 'production' as const };
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('session restoration timeout', () => {
  it('keeps an existing session that restores before five seconds', async () => {
    const api = { getService: vi.fn().mockResolvedValue(response(service)), getStudent: vi.fn().mockResolvedValue(response(student)) } as unknown as ExamApi;
    const restored = await restoreSession(async () => api, new AbortController().signal);
    expect(restored.student).toEqual(student);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows sign-in at five seconds and ignores a late session response', async () => {
    let complete!: (value: ReturnType<typeof response<typeof student>>) => void;
    let signal: AbortSignal | undefined;
    const api = {
      getService: vi.fn().mockResolvedValue(response(service)),
      getStudent: vi.fn((options) => { signal = options.signal; return new Promise((resolve) => { complete = resolve; }); }),
    } as unknown as ExamApi;
    const done = vi.fn();
    const pending = restoreSession(async () => api, new AbortController().signal).then(done);
    await vi.advanceTimersByTimeAsync(4999);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(done).toHaveBeenCalledWith({ api, service, student: null });
    expect(signal?.aborted).toBe(true);
    complete(response(student));
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('also times out if service discovery hangs', async () => {
    const api = { getService: vi.fn(() => new Promise(() => {})), getStudent: vi.fn().mockResolvedValue(response(student)) } as unknown as ExamApi;
    const pending = restoreSession(async () => api, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(5000);
    expect((await pending).student).toBeNull();
  });

  it('cleans up when the provider unmounts', async () => {
    const controller = new AbortController();
    const pending = restoreSession(() => new Promise(() => {}), controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
});
