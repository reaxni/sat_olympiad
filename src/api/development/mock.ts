import { ApiError, type ApiResponse, type ExamApi } from '../client';
import { EXAM_SECTIONS, type Answer, type Attempt, type EmailChallenge, type EmailCodeRequest, type LeaderboardEntry, type ReleasedResource, type SectionId, type Student } from '../../domain/exam';
import { questions } from './questions';

interface MockState {
  epoch: number; realEpoch: number; user: Student | null; students: Student[];
  passwords?: Record<string, string>;
  challenges: Record<string, { challenge: EmailChallenge; input: EmailCodeRequest; used: boolean }>;
  attempts: Record<string, Attempt>; answers: Record<string, Record<string, Answer>>;
  mutations: Record<string, { signature: string; data: unknown }>;
  violations: Record<string, number>;
  attemptStarts: Record<string, string>;
}
export function createMockApi(): ExamApi {
  if (!import.meta.env.DEV) throw new Error('DEV_MOCK_ADAPTER_ONLY');
  const scenario = import.meta.env.VITE_MOCK_SCENARIO ?? 'countdown';
  const rate = Math.max(1, Number(import.meta.env.VITE_MOCK_CLOCK_RATE) || 1);
  const delay = Math.max(0, Number(import.meta.env.VITE_MOCK_OPEN_DELAY_SECONDS ?? 60));
  const storageKey = `1609-mock-v5:${scenario}:${rate}:${delay}`;
  const fresh = (): MockState => ({ epoch: Date.now(), realEpoch: Date.now(), user: null,
    students: [{ id: 'sample-student', name: 'Alex Morgan', grade: 10, email: 'learner@example.test' }],
    passwords: { 'learner@example.test': 'sat1609pass' }, challenges: {}, attempts: {}, answers: {}, mutations: {}, violations: {}, attemptStarts: {} });
  let state = fresh();
  try { const saved = sessionStorage.getItem(storageKey); if (saved) state = JSON.parse(saved) as MockState; } catch { /* In-memory fallback when storage is disabled. */ }
  const persist = () => { try { sessionStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* The current tab still works. */ } };
  const now = () => state.epoch + (Date.now() - state.realEpoch) * rate;
  const iso = (value = now()) => new Date(value).toISOString();
  const opensAt = state.epoch + (scenario === 'countdown' ? delay * 1000 : -1000);
  const closesAt = opensAt + Math.max(1, Number(import.meta.env.VITE_MOCK_CLOSE_DELAY_SECONDS) || 7 * 86_400) * 1000;
  const schedule = { id: 'dev-olympiad', title: '1609 SAT Olympiad', opensAt: iso(opensAt), entryClosesAt: iso(closesAt), sections: EXAM_SECTIONS, autoSubmitAfterEvents: 5 };
  const respond = async <T>(data: T, signal?: AbortSignal): Promise<ApiResponse<T>> => {
    signal?.throwIfAborted();
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new ApiError('SERVICE_UNAVAILABLE', 'Connection failed. Your request was not completed.');
    persist();
    await new Promise((resolve) => setTimeout(resolve, 180));
    signal?.throwIfAborted();
    return { data: structuredClone(data), serverTime: iso() };
  };
  const requireUser = () => {
    if (!state.user) throw new ApiError('UNAUTHENTICATED', 'Please sign in again.', 401);
    return state.user;
  };
  const exam = (examId: string) => { requireUser(); if (examId !== schedule.id) throw new ApiError('NOT_FOUND', 'Exam not found.', 404); };
  const advance = (a: Attempt) => {
    if (a.progress.phase !== 'in-progress') return;
    a.progress = a.progress.sectionId === 'reading-writing' ? { phase: 'instructions', sectionId: 'math' } : { phase: 'completed', completedAt: iso() };
  };
  const owned = (attemptId: string) => {
    const a = state.attempts[requireUser().id];
    if (!a || a.id !== attemptId) throw new ApiError('NOT_FOUND', 'Attempt not found.', 404);
    closeAttempt(a);
    if (a.progress.phase === 'in-progress' && now() >= Date.parse(a.progress.deadlineAt)) advance(a);
    persist(); return a;
  };
  const closeAttempt = (a: Attempt) => {
    if (now() >= closesAt && state.attemptStarts[a.id] && (a.progress.phase === 'in-progress' || a.progress.phase === 'instructions')) a.progress = { phase: 'completed', completedAt: iso(closesAt) };
  };
  const current = (attemptId: string, sectionId: SectionId) => {
    const a = owned(attemptId);
    if (a.progress.phase !== 'in-progress' || a.progress.sectionId !== sectionId) throw new ApiError('CONFLICT', 'This section is closed. Refresh the exam state.', 409);
    return a;
  };
  const mutate = <T>(key: string, signature: string, action: () => T): T => {
    const previous = state.mutations[key];
    if (previous) {
      if (previous.signature !== signature) throw new ApiError('CONFLICT', 'This request ID was already used.', 409);
      return structuredClone(previous.data) as T;
    }
    const data = action(); state.mutations[key] = { signature, data: structuredClone(data) }; persist(); return data;
  };
  const released = <T>(data: () => T, ranking = false): ReleasedResource<T> => scenario === 'released' || (ranking && now() >= closesAt) ? { status: 'released', releasedAt: iso(ranking && now() >= closesAt ? closesAt : now()), data: data() } : { status: 'locked', message: 'Results have not been released.' };
  const makeChallenge = (input: EmailCodeRequest, expired = false) => {
    const challenge = { id: crypto.randomUUID(), email: input.email, expiresAt: iso(now() + (expired ? -1 : 600_000)), resendAt: iso(now() + 30_000) };
    state.challenges[challenge.id] = { challenge, input, used: false }; return challenge;
  };
  const scores = (_a: Attempt, sectionId: SectionId) => ({ value: sectionId === 'math' ? 620 : 680, maximum: 800, label: 'Simulated development score — not graded' });
  const elapsed = (a: Attempt) => Math.max(0, Math.round((Date.parse(a.progress.phase === 'completed' ? a.progress.completedAt : iso()) - Date.parse(state.attemptStarts[a.id] ?? iso())) / 1000));
  persist();
  const api: ExamApi = {
    getService: (o) => respond({ status: 'available', environment: 'development', mockVerificationHint: 'Local mock code: 123456. It does not verify email ownership.' }, o?.signal),
    getStudent: (o) => respond(state.user, o?.signal),
    passwordSession: async (input, o) => {
      const normalized = input.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || input.password.length < 6 || input.password.length > 12) throw new ApiError('VALIDATION_ERROR', 'Enter a valid email and a password of 6 to 12 characters.', 400);
      let user = state.students.find((student) => student.email === normalized);
      if (input.purpose === 'sign-up') {
        if (!input.name.trim() || !Number.isInteger(input.grade) || input.grade < 7 || input.grade > 12) throw new ApiError('VALIDATION_ERROR', 'Enter a name and grade from 7 to 12.', 400);
        if (user) throw new ApiError('CONFLICT', 'This email already has an account. Sign in instead.', 409);
        user = { id: crypto.randomUUID(), name: input.name.trim(), grade: input.grade, email: normalized };
        state.students.push(user); state.passwords ??= {}; state.passwords[normalized] = input.password;
      } else if (!user || state.passwords?.[normalized] !== input.password) {
        throw new ApiError('UNAUTHENTICATED', 'Email or password is incorrect.', 401);
      }
      state.user = user;
      return respond(user, o?.signal);
    },
    requestEmailCode: async (input, o) => {
      if (scenario === 'network-error') throw new ApiError('SERVICE_UNAVAILABLE', 'Mock network error. No email was sent.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || (input.purpose === 'sign-up' && (!input.name.trim() || !Number.isInteger(input.grade) || input.grade < 7 || input.grade > 12))) throw new ApiError('VALIDATION_ERROR', 'Please check your details.', 400);
      return respond(makeChallenge({ ...input, email: input.email.trim().toLowerCase() }, scenario === 'expired-code'), o?.signal);
    },
    resendEmailCode: async (challengeId, o) => {
      const old = state.challenges[challengeId];
      if (!old) throw new ApiError('EXPIRED_CODE', 'Request a new code.', 400);
      if (now() < Date.parse(old.challenge.resendAt)) throw new ApiError('RATE_LIMITED', 'Please wait before requesting another code.', 429);
      old.used = true;
      return respond(makeChallenge(old.input), o?.signal);
    },
    verifyEmailCode: async (challengeId, code, o) => {
      const entry = state.challenges[challengeId];
      if (!entry || entry.used || now() >= Date.parse(entry.challenge.expiresAt)) throw new ApiError('EXPIRED_CODE', 'This code has expired. Request a new code.', 400);
      if (code !== '123456') throw new ApiError('INVALID_CODE', 'That code is not valid. Check the six digits and try again.', 400);
      let user = state.students.find((s) => s.email === entry.input.email);
      if (!user && entry.input.purpose === 'sign-in') throw new ApiError('INVALID_CODE', 'No mock account matches this email. Create an account first.', 400);
      if (!user && entry.input.purpose === 'sign-up') {
        user = { id: crypto.randomUUID(), name: entry.input.name.trim(), grade: entry.input.grade, email: entry.input.email };
        state.students.push(user);
      }
      entry.used = true; state.user = user!;
      return respond(user!, o?.signal);
    },
    signOut: (o) => { state.user = null; return respond(null, o?.signal); },
    getSchedule: (o) => { requireUser(); return respond(schedule, o?.signal); },
    getEligibility: (e, o) => { exam(e); const attempt = state.attempts[requireUser().id]; return respond(now() < opensAt ? { status: 'blocked', reason: 'not-open', message: 'The exam has not opened yet.' } : now() >= closesAt ? { status: 'blocked', reason: 'entry-closed', message: 'The exam has closed.' } : attempt?.progress.phase === 'disqualified' ? { status: 'blocked', reason: 'disqualified', message: 'This attempt was restricted after five confirmed browser events.' } : { status: 'eligible' }, o?.signal); },
    getActiveAttempt: (e, o) => { exam(e); const a = state.attempts[requireUser().id]; return respond(a ? owned(a.id) : null, o?.signal); },
    createAttempt: async (e, input, o) => {
      exam(e); if (now() < opensAt || now() >= closesAt) throw new ApiError('FORBIDDEN', 'The exam entry window is closed.', 403);
      const user = requireUser();
      const data = mutate(`${user.id}:${input.mutationId}`, `create:${e}`, () => state.attempts[user.id] ?? (state.attempts[user.id] = { id: crypto.randomUUID(), examId: e, progress: { phase: 'instructions', sectionId: 'reading-writing' }, strikes: { count: 0, remaining: 5, limit: 5, disqualified: false } }));
      return respond(data, o?.signal);
    },
    getAttempt: (a, o) => respond(owned(a), o?.signal),
    startSection: async (a, s, input, o) => {
      const attempt = owned(a);
      const data = mutate(`${a}:${input.mutationId}`, `start:${s}`, () => {
        if (attempt.progress.phase === 'in-progress' && attempt.progress.sectionId === s) return attempt;
        if (attempt.progress.phase !== 'instructions' || attempt.progress.sectionId !== s) throw new ApiError('FORBIDDEN', 'This section cannot be started.', 403);
        if (now() >= closesAt) throw new ApiError('FORBIDDEN', 'The exam has closed.', 403);
        const section = EXAM_SECTIONS.find((item) => item.id === s)!;
        if (s === 'reading-writing') state.attemptStarts[a] = iso();
        attempt.progress = { phase: 'in-progress', sectionId: s, startedAt: iso(), deadlineAt: iso(Math.min(now() + section.durationSeconds * 1000, closesAt)) }; return attempt;
      }); return respond(data, o?.signal);
    },
    getSection: (a, s, o) => { current(a, s); const section = EXAM_SECTIONS.find((item) => item.id === s)!; return respond({ section, slots: Array.from({ length: section.questionCount }, (_, i) => ({ position: i + 1, question: questions.find((q) => q.sectionId === s && q.position === i + 1) ?? null })), answers: Object.values(state.answers[a] ?? {}).filter((answer) => questions.some((q) => q.id === answer.questionId && q.sectionId === s)) }, o?.signal); },
    saveAnswer: async (a, qid, input, o) => {
      const q = questions.find((item) => item.id === qid);
      if (!q) throw new ApiError('NOT_FOUND', 'Question not found.', 404);
      owned(a);
      const answer = mutate(`${a}:${input.mutationId}`, `save:${qid}:${JSON.stringify(input)}`, () => {
        current(a, q.sectionId);
        if (input.value && ((q.kind === 'numeric' && input.value.kind !== 'numeric') || (q.kind === 'multiple-choice' && (input.value.kind !== 'choice' || !q.choices.some((c) => input.value?.kind === 'choice' && c.id === input.value.choiceId))))) throw new ApiError('VALIDATION_ERROR', 'Invalid response type.', 400);
        const answers = state.answers[a] ?? (state.answers[a] = {});
        if ((answers[qid]?.revision ?? 0) !== input.expectedRevision) throw new ApiError('CONFLICT', 'A newer answer exists. Reload before continuing.', 409);
        return answers[qid] = { questionId: qid, value: input.value, markedForReview: input.markedForReview, tools: input.tools, revision: input.expectedRevision + 1, savedAt: iso() };
      }); return respond(answer, o?.signal);
    },
    submitSection: async (a, s, input, o) => {
      const attempt = owned(a);
      const data = mutate(`${a}:${input.mutationId}`, `submit:${s}`, () => {
        if (attempt.progress.phase === 'completed' || (s === 'reading-writing' && (attempt.progress.phase === 'instructions' || attempt.progress.phase === 'in-progress') && attempt.progress.sectionId === 'math')) return attempt;
        current(a, s); advance(attempt); return attempt;
      }); return respond(data, o?.signal);
    },
    reportViolation: async (a, report, o) => {
      const attempt = owned(a);
      const decision = mutate(`${a}:${report.eventId}`, `violation:${report.kind}`, () => {
        const group = ['tab-hidden', 'window-blurred', 'fullscreen-exited', 'page-exit'].includes(report.kind) ? 'focus' : report.kind;
        const last = state.violations[`${a}:${group}`] ?? -Infinity;
        const counted = attempt.progress.phase === 'in-progress' && Date.now() - last > (group === 'focus' ? 2000 : 500);
        if (counted) {
          state.violations[`${a}:${group}`] = Date.now(); attempt.strikes.count += 1; attempt.strikes.remaining = Math.max(0, 5 - attempt.strikes.count);
          attempt.strikes.lastReason = ({ 'tab-hidden': 'The exam tab was hidden.', 'window-blurred': 'The exam window lost focus.', 'fullscreen-exited': 'Full screen was exited.', 'page-exit': 'The exam page was left or closed.', copy: 'Copy was attempted.', cut: 'Cut was attempted.', paste: 'Paste was attempted.', print: 'Print was attempted.', 'context-menu': 'The context menu was opened.', 'developer-shortcut': 'A developer tools shortcut was pressed.', 'connection-lost': 'The connection was lost.', 'connection-restored': 'The connection returned.', 'window-shrunk': 'The exam window was sharply reduced.' } as Record<typeof report.kind, string>)[report.kind];
          if (attempt.strikes.count >= 5) { attempt.strikes.disqualified = true; attempt.progress = { phase: 'disqualified', disqualifiedAt: iso(Date.now()) }; }
        }
        return { counted, message: counted ? `Recorded observation: ${attempt.strikes.lastReason}` : 'Related observation received; no additional record.', strikes: attempt.strikes };
      }); return respond(decision, o?.signal);
    },
    getResult: (a, o) => {
      const attempt = owned(a); if (attempt.progress.phase !== 'completed') throw new ApiError('FORBIDDEN', 'Results are not available.', 403);
      const readingWriting = scores(attempt, 'reading-writing'); const math = scores(attempt, 'math');
      return respond({ attemptId: a, submittedAt: attempt.progress.completedAt, timeTakenSeconds: elapsed(attempt), readingWriting, math, overall: { value: readingWriting.value + math.value, maximum: 1600, label: 'Simulated development score — not graded' }, releases: { explanations: scenario === 'released' ? { status: 'released', releasedAt: iso() } : { status: 'locked', message: 'Explanations have not been released.' }, leaderboard: scenario === 'released' || now() >= closesAt ? { status: 'released', releasedAt: iso() } : { status: 'locked', message: 'Leaderboard results have not been released.' } } }, o?.signal);
    },
    getReleases: (e, o) => { exam(e); return respond({ explanations: scenario === 'released' ? { status: 'released', releasedAt: iso() } : { status: 'locked', message: 'Explanations have not been released.' }, leaderboard: scenario === 'released' || now() >= closesAt ? { status: 'released', releasedAt: iso() } : { status: 'locked', message: 'Leaderboard results have not been released.' } }, o?.signal); },
    getReview: (a, o) => { const attempt = owned(a); if (attempt.progress.phase !== 'completed') throw new ApiError('FORBIDDEN', 'Complete the exam before review.', 403); return respond(released(() => ({ attemptId: a, items: [] })), o?.signal); },
    getLeaderboard: (e, o) => {
      exam(e); Object.values(state.attempts).forEach(closeAttempt); const participants = state.students.map(({ id, name, grade }) => ({ id, name, grade }));
      return respond({ participants, results: released<LeaderboardEntry[]>(() => state.students.flatMap((s) => { const a = state.attempts[s.id]; return a?.progress.phase === 'completed' ? [{ rank: 0, name: s.name, grade: s.grade, score: { value: scores(a, 'reading-writing').value + scores(a, 'math').value, maximum: 1600, label: 'Simulated development score — not graded' }, timeTakenSeconds: elapsed(a) }] : []; }).sort((a, b) => b.score.value - a.score.value || a.timeTakenSeconds - b.timeTakenSeconds).map((row, i) => ({ ...row, rank: i + 1 })), true) }, o?.signal);
    },
  };
  // Check before mutations; an offline mock must not acknowledge or apply a write.
  return new Proxy(api, { get(target, key: keyof ExamApi) {
    const method = target[key];
    if (typeof method !== 'function') return method;
    return (...args: unknown[]) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return Promise.reject(new ApiError('SERVICE_UNAVAILABLE', 'Connection failed. Your request was not completed.'));
      try { return (method as (...input: unknown[]) => unknown)(...args); } catch (error) { return Promise.reject(error); }
    };
  } });
}

