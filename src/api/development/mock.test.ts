import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockApi } from './mock';
import type { ExamApi } from '../client';

beforeEach(() => {
  const memory = new Map<string, string>();
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) });
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubEnv('VITE_MOCK_SCENARIO', 'exam'); vi.stubEnv('VITE_MOCK_CLOCK_RATE', '1');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
async function login(api: ExamApi) {
  const challenge = await api.requestEmailCode({ purpose: 'sign-in', email: 'learner@example.test' });
  return api.verifyEmailCode(challenge.data.id, '123456');
}
async function begin(api: ExamApi) {
  await login(api);
  const schedule = await api.getSchedule(); const attempt = await api.createAttempt(schedule.data.id, { mutationId: 'create' });
  await api.startSection(attempt.data.id, 'reading-writing', { mutationId: 'start-rw' }); return attempt.data.id;
}
describe('email flow', () => {
  it('saves a new email with password and rejects the wrong password', async () => {
    const api = createMockApi();
    const created = await api.passwordSession({ purpose: 'sign-up', name: 'Test Learner', grade: 10, email: ' NEW@example.test ', password: 'long-test-password' });
    expect(created.data.email).toBe('new@example.test');
    await api.signOut();
    await expect(api.passwordSession({ purpose: 'sign-in', email: 'new@example.test', password: 'wrong-password' })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect((await api.passwordSession({ purpose: 'sign-in', email: 'new@example.test', password: 'long-test-password' })).data.id).toBe(created.data.id);
  });
  it('can be returned from the asynchronous adapter factory without becoming a thenable', async () => {
    const api = await Promise.resolve(createMockApi());
    expect((await api.getService()).data.status).toBe('available');
  });
  it('rejects wrong codes, consumes verified codes, restores the mock session, and signs out', async () => {
    const api = createMockApi();
    expect((await api.getStudent()).data).toBeNull();
    const challenge = await api.requestEmailCode({ purpose: 'sign-up', name: 'Test Learner', grade: 10, email: 'test@example.test' });
    await expect(api.verifyEmailCode(challenge.data.id, '000000')).rejects.toMatchObject({ code: 'INVALID_CODE' });
    const user = await api.verifyEmailCode(challenge.data.id, '123456');
    expect(user.data.name).toBe('Test Learner');
    expect(user.data.grade).toBe(10);
    await expect(api.verifyEmailCode(challenge.data.id, '123456')).rejects.toMatchObject({ code: 'EXPIRED_CODE' });
    expect((await createMockApi().getStudent()).data?.id).toBe(user.data.id);
    await api.signOut(); expect((await createMockApi().getStudent()).data).toBeNull();
    await expect(api.getSchedule()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
  it('expires codes and allows a rate-limited resend with a new challenge', async () => {
    const api = createMockApi(); const challenge = await api.requestEmailCode({ purpose: 'sign-in', email: 'learner@example.test' });
    await expect(api.resendEmailCode(challenge.data.id)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    const later = Date.now() + 601_000; vi.spyOn(Date, 'now').mockReturnValue(later);
    await expect(api.verifyEmailCode(challenge.data.id, '123456')).rejects.toMatchObject({ code: 'EXPIRED_CODE' });
    const resent = await api.resendEmailCode(challenge.data.id);
    expect(resent.data.id).not.toBe(challenge.data.id);
    expect((await api.verifyEmailCode(resent.data.id, '123456')).data.email).toBe('learner@example.test');
  });
  it('does not apply offline mutations', async () => {
    const api = createMockApi(); await login(api); vi.stubGlobal('navigator', { onLine: false });
    await expect(api.signOut()).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    vi.stubGlobal('navigator', { onLine: true }); expect((await api.getStudent()).data).not.toBeNull();
  });
});
describe('fixed exam and release boundaries', () => {
  it('ends a partial exam at the shared close and releases ranks without releasing keys', async () => {
    vi.stubEnv('VITE_MOCK_CLOSE_DELAY_SECONDS', '60');
    const api = createMockApi(); const id = await begin(api);
    const schedule = (await api.getSchedule()).data;
    const active = (await api.getAttempt(id)).data;
    expect(active.progress.phase === 'in-progress' && active.progress.deadlineAt).toBe(schedule.entryClosesAt);
    await api.saveAnswer(id, 'reading-writing-1', { value: { kind: 'choice', choiceId: 'a' }, markedForReview: false, expectedRevision: 0, mutationId: 'before-close' });
    expect((await api.getLeaderboard(schedule.id)).data.results.status).toBe('locked');
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(schedule.entryClosesAt));
    // Ranking also finalizes an attempt without a browser submitting it.
    const ranking = (await api.getLeaderboard(schedule.id)).data.results;
    expect(ranking.status).toBe('released');
    if (ranking.status === 'released') expect(ranking.data[0]?.rank).toBe(1);
    expect((await api.getAttempt(id)).data.progress).toEqual({ phase: 'completed', completedAt: schedule.entryClosesAt });
    await expect(api.saveAnswer(id, 'reading-writing-1', { value: null, markedForReview: false, expectedRevision: 1, mutationId: 'after-close' })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await api.getReview(id)).data.status).toBe('locked');
    await expect(api.startSection(id, 'math', { mutationId: 'late-start' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('blocks early entry and supplies only the current section with exact counts and duration', async () => {
    vi.stubEnv('VITE_MOCK_SCENARIO', 'countdown'); vi.stubEnv('VITE_MOCK_OPEN_DELAY_SECONDS', '120');
    const api = createMockApi(); await login(api); const schedule = await api.getSchedule();
    expect((await api.getEligibility(schedule.data.id)).data.status).toBe('blocked');
    await expect(api.createAttempt(schedule.data.id, { mutationId: 'too-early' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 121_000);
    const attempt = await api.createAttempt(schedule.data.id, { mutationId: 'create' });
    const active = await api.startSection(attempt.data.id, 'reading-writing', { mutationId: 'start' });
    if (active.data.progress.phase !== 'in-progress') throw new Error('Expected active attempt');
    expect(Date.parse(active.data.progress.deadlineAt) - Date.parse(active.data.progress.startedAt)).toBe(32 * 60_000);
    const content = await api.getSection(attempt.data.id, 'reading-writing');
    expect(content.data.slots).toHaveLength(27); expect(content.data.slots.every((slot) => slot.question?.sectionId === 'reading-writing')).toBe(true);
    expect(JSON.stringify(content.data)).not.toContain('correctAnswer');
    await expect(api.getSection(attempt.data.id, 'math')).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('persists responses and tools, handles revisions and retries, and closes prior sections', async () => {
    const api = createMockApi(); const id = await begin(api);
    const input = { value: { kind: 'choice' as const, choiceId: 'a' }, markedForReview: true, expectedRevision: 0, mutationId: 'save-1', tools: { notes: 'Keep this note', eliminatedChoiceIds: ['b'], highlights: [{ id: 'h1', blockId: 'reading-writing-1:passage:0', start: 0, end: 4, text: 'This', color: 'yellow' as const, note: 'Review this phrase' }] } };
    const saved = await api.saveAnswer(id, 'reading-writing-1', input); expect(saved.data.revision).toBe(1);
    expect((await api.saveAnswer(id, 'reading-writing-1', input)).data.revision).toBe(1);
    await expect(api.saveAnswer(id, 'reading-writing-1', { ...input, mutationId: 'stale' })).rejects.toMatchObject({ code: 'CONFLICT' });
    const restored = await createMockApi().getSection(id, 'reading-writing'); expect(restored.data.answers[0]?.tools).toEqual(input.tools);
    await api.submitSection(id, 'reading-writing', { mutationId: 'submit-rw' });
    await expect(api.getSection(id, 'reading-writing')).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(api.startSection(id, 'reading-writing', { mutationId: 'rewind' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const math = await api.startSection(id, 'math', { mutationId: 'start-math' });
    if (math.data.progress.phase !== 'in-progress') throw new Error('Expected math');
    expect(Date.parse(math.data.progress.deadlineAt) - Date.parse(math.data.progress.startedAt)).toBe(35 * 60_000);
    expect((await api.getSection(id, 'math')).data.slots).toHaveLength(22);
    await api.submitSection(id, 'math', { mutationId: 'finish' });
    const result = await api.getResult(id); expect(result.data.overall.value).toBe(1300); expect(result.data.overall.maximum).toBe(1600); expect(result.data.readingWriting.maximum).toBe(800); expect(result.data.math.maximum).toBe(800);
    expect((await api.getReview(id)).data).not.toHaveProperty('data');
    const leaderboard = (await api.getLeaderboard('dev-olympiad')).data;
    expect(leaderboard.results).not.toHaveProperty('data'); expect(JSON.stringify(leaderboard)).not.toContain('@');
    expect(leaderboard.participants[0]).not.toHaveProperty('email');
    expect(leaderboard.participants[0]).toHaveProperty('grade', 10);
  });
  it('expires the active section using the simulated server clock', async () => {
    const api = createMockApi(); const id = await begin(api);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 32 * 60_000 + 1000);
    expect((await api.getAttempt(id)).data.progress).toEqual({ phase: 'instructions', sectionId: 'math' });
    await expect(api.saveAnswer(id, 'reading-writing-1', { value: null, markedForReview: false, expectedRevision: 0, mutationId: 'late' })).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('deduplicates related reports and restricts the attempt after five counted events', async () => {
    const api = createMockApi(); const id = await begin(api);
    const report = { eventId: 'v1', kind: 'tab-hidden' as const, observedAt: new Date().toISOString() };
    expect((await api.reportViolation(id, report)).data.strikes.count).toBe(1);
    expect((await api.reportViolation(id, report)).data.strikes.count).toBe(1);
    expect((await api.reportViolation(id, { ...report, eventId: 'related', kind: 'fullscreen-exited' })).data.counted).toBe(false);
    const timestamp = Date.now(); const now = vi.spyOn(Date, 'now').mockReturnValue(timestamp + 3000);
    await api.reportViolation(id, { ...report, eventId: 'v2' }); now.mockReturnValue(timestamp + 6000);
    expect((await api.reportViolation(id, { ...report, eventId: 'v3' })).data.strikes.remaining).toBe(2);
    expect((await api.getAttempt(id)).data.progress.phase).toBe('in-progress');
    expect((await api.reportViolation(id, { ...report, eventId: 'clipboard', kind: 'paste' })).data.counted).toBe(true);
    expect((await api.getAttempt(id)).data.strikes.remaining).toBe(1);
    expect((await api.reportViolation(id, { ...report, eventId: 'print', kind: 'print' })).data.strikes.disqualified).toBe(true);
    expect((await api.getAttempt(id)).data.progress.phase).toBe('disqualified');
  });
  it('releases a leaderboard response without emails', async () => {
    vi.stubEnv('VITE_MOCK_SCENARIO', 'released'); const api = createMockApi(); await login(api);
    const result = (await api.getLeaderboard('dev-olympiad')).data;
    expect(result.results.status).toBe('released'); expect(JSON.stringify(result)).not.toContain('email');
  });
});
