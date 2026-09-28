import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuthenticatedApi } from '../api/context';
import { ApiError, errorMessage, type ApiResponse } from '../api/client';
import type { Answer, AnswerValue, Attempt, Eligibility, ExamSchedule, QuestionTools, SaveAnswerInput, SectionContent, ViolationReport } from '../domain/exam';
import { createViolationDeduper } from './violationEvents';

type Draft = { value: AnswerValue | null; markedForReview: boolean; tools?: QuestionTools };
interface QueueEntry { draft: Draft; request?: SaveAnswerInput }
interface ExamContextValue {
  schedule: ExamSchedule | null; eligibility: Eligibility | null; attempt: Attempt | null; content: SectionContent | null;
  loading: boolean; error: string; warning: string; now: number; pending: number; saveError: string;
  drafts: Record<string, Draft>; refresh: () => Promise<void>; begin: () => Promise<void>; start: () => Promise<void>;
  startExam: () => Promise<void>; fullscreenMode: 'not-entered' | 'active' | 'required' | 'unsupported' | 'denied'; returnToFullscreen: () => void;
  focusReview: { state: 'checking' | 'ready'; counted: boolean; reason: string; remaining: number } | null; dismissFocusReview: () => void;
  submit: () => Promise<void>; updateAnswer: (questionId: string, draft: Draft) => void; retrySaving: () => Promise<void>;
}
const ExamContext = createContext<ExamContextValue | null>(null);
export function ExamProvider({ children }: { children: ReactNode }) {
  const { api } = useAuthenticatedApi();
  const [schedule, setSchedule] = useState<ExamSchedule | null>(null); const scheduleRef = useRef<ExamSchedule | null>(null); const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null); const attemptRef = useRef<Attempt | null>(null);
  const [content, setContent] = useState<SectionContent | null>(null); const contentRef = useRef<SectionContent | null>(null);
  const [contentRetry, setContentRetry] = useState(0);
  const [fullscreenMode, setFullscreenMode] = useState<ExamContextValue['fullscreenMode']>(() => {
    try { return sessionStorage.getItem('1609:was-fullscreen') === '1' && !document.fullscreenElement ? 'required' : 'not-entered'; }
    catch { return 'not-entered'; }
  });
  const fullscreenEverEntered = useRef(fullscreenMode === 'required' || Boolean(document.fullscreenElement));
  const stateVersion = useRef(0); const refreshing = useRef(false);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [warning, setWarning] = useState('');
  const [focusReview, setFocusReview] = useState<ExamContextValue['focusReview']>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({}); const [pending, setPending] = useState(0); const [saveError, setSaveError] = useState('');
  const queue = useRef(new Map<string, QueueEntry>()); const saving = useRef<Promise<void> | null>(null); const mounted = useRef(true);
  const anchor = useRef({ server: Date.now(), local: performance.now() }); const [now, setNow] = useState(Date.now());
  const setResponse = useCallback(<T,>(response: ApiResponse<T>): T => { anchor.current = { server: Date.parse(response.serverTime), local: performance.now() }; setNow(anchor.current.server); return response.data; }, []);
  const applyAttempt = useCallback((value: Attempt | null) => {
    stateVersion.current += 1; attemptRef.current = value; setAttempt(value);
    if (!value || value.progress.phase === 'completed' || value.progress.phase === 'disqualified') {
      setFocusReview(null);
      try { sessionStorage.removeItem('1609:was-fullscreen'); } catch { /* Browser storage can be disabled. */ }
    }
  }, []);
  const requestId = useRef<Record<string, string>>({});
  const mutationId = (key: string) => requestId.current[key] ?? (requestId.current[key] = crypto.randomUUID());
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    const version = stateVersion.current;
    try {
      let nextSchedule = scheduleRef.current;
      if (!nextSchedule) {
        nextSchedule = setResponse(await api.getSchedule());
        scheduleRef.current = nextSchedule;
        if (mounted.current) setSchedule(nextSchedule);
      }
      const current = attemptRef.current;
      const active = setResponse(current
        ? await api.getAttempt(current.id)
        : await api.getActiveAttempt(nextSchedule.id));
      if (!mounted.current) return;
      if (active && version === stateVersion.current) applyAttempt(active);
      if (!active && version === stateVersion.current) {
        const allowed = setResponse(await api.getEligibility(nextSchedule.id));
        if (!mounted.current || version !== stateVersion.current) return;
        setEligibility(allowed);
      }
      setError('');
    } catch (failure) { if (mounted.current) setError(errorMessage(failure)); }
    finally { refreshing.current = false; if (mounted.current) setLoading(false); }
  }, [api, applyAttempt, setResponse]);
  useEffect(() => {
    mounted.current = true; void refresh();
    const poll = window.setInterval(() => {
      const phase = attemptRef.current?.progress.phase;
      if (phase !== 'completed' && phase !== 'disqualified') void refresh();
    }, 5000);
    const recover = () => { void refresh(); };
    window.addEventListener('online', recover);
    return () => { mounted.current = false; clearInterval(poll); window.removeEventListener('online', recover); };
  }, [refresh]);
  useEffect(() => { const timer = window.setInterval(() => setNow(anchor.current.server + performance.now() - anchor.current.local), 500); return () => clearInterval(timer); }, []);
  const phase = attempt?.progress.phase;
  const sectionId = attempt && (attempt.progress.phase === 'instructions' || attempt.progress.phase === 'in-progress') ? attempt.progress.sectionId : null;
  useEffect(() => {
    const controller = new AbortController();
    setContent(null); contentRef.current = null;
    if (queue.current.size) setWarning('The section closed before all changes were acknowledged. Only server-saved answers count.');
    queue.current.clear(); setPending(0); setSaveError(''); setDrafts({});
    if (!attempt || phase !== 'in-progress' || !sectionId) return;
    void api.getSection(attempt.id, sectionId, { signal: controller.signal }).then((response) => {
      if (controller.signal.aborted) return;
      const data = setResponse(response); contentRef.current = data; setContent(data);
      let unsent: Record<string, Draft> = {};
      try { unsent = JSON.parse(sessionStorage.getItem(`1609:drafts:${attempt.id}:${sectionId}`) || '{}') as Record<string, Draft>; } catch { /* Storage may be disabled. */ }
      const allowed = new Set(data.slots.flatMap((slot) => slot.question ? [slot.question.id] : []));
      unsent = Object.fromEntries(Object.entries(unsent).filter(([id]) => allowed.has(id)));
      for (const [id, draft] of Object.entries(unsent)) queue.current.set(id, { draft });
      setDrafts({ ...Object.fromEntries(data.answers.map((answer) => [answer.questionId, { value: answer.value, markedForReview: answer.markedForReview, tools: answer.tools }])), ...unsent });
      setPending(queue.current.size);
      setError('');
    }).catch((failure) => { if (!controller.signal.aborted) setError(errorMessage(failure)); });
    return () => controller.abort();
  }, [api, attempt?.id, phase, sectionId, setResponse, contentRetry]);
  const pump = useCallback(async () => {
    if (saving.current) return saving.current;
    const work = async () => {
      setSaveError('');
      while (queue.current.size && mounted.current) {
        const item = queue.current.entries().next().value as [string, QueueEntry] | undefined;
        const active = attemptRef.current;
        if (!item || !active || active.progress.phase !== 'in-progress') break;
        const [qid, entry] = item;
        entry.request ??= { ...entry.draft, expectedRevision: contentRef.current?.answers.find((answer) => answer.questionId === qid)?.revision ?? 0, mutationId: crypto.randomUUID() };
        try {
          const response = await api.saveAnswer(active.id, qid, entry.request);
          if (!mounted.current) return;
          const saved = setResponse(response);
          if (contentRef.current && contentRef.current.section.id === active.progress.sectionId) {
            contentRef.current = { ...contentRef.current, answers: [...contentRef.current.answers.filter((answer) => answer.questionId !== qid), saved] };
            setContent(contentRef.current);
          }
          if (queue.current.get(qid) === entry) queue.current.delete(qid);
          try { sessionStorage.setItem(`1609:drafts:${active.id}:${active.progress.sectionId}`, JSON.stringify(Object.fromEntries([...queue.current].map(([id, value]) => [id, value.draft])))); } catch { /* Best effort local backup. */ }
          setPending(queue.current.size);
        } catch (failure) {
          if (mounted.current) setSaveError(failure instanceof ApiError && failure.code === 'CONFLICT' ? 'A newer answer exists on the service. Retry saving to apply your current response to the latest revision.' : errorMessage(failure));
          break;
        }
      }
    };
    saving.current = work();
    try { await saving.current; } finally { saving.current = null; }
  }, [api, setResponse]);
  useEffect(() => {
    if (!pending || saveError) return;
    const timer = window.setTimeout(() => { void pump(); }, 350);
    return () => clearTimeout(timer);
  }, [pending, drafts, saveError, pump]);
  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);
  const updateAnswer = (qid: string, draft: Draft) => {
    queue.current.set(qid, { draft }); setDrafts((old) => ({ ...old, [qid]: draft })); setPending(queue.current.size);
    const active = attemptRef.current;
    if (active?.progress.phase === 'in-progress') try { sessionStorage.setItem(`1609:drafts:${active.id}:${active.progress.sectionId}`, JSON.stringify(Object.fromEntries([...queue.current].map(([id, value]) => [id, value.draft])))); } catch { setWarning('Local backup is unavailable in this browser. Keep this page open until answers are saved.'); }
  };
  const retrySaving = async () => {
    const active = attemptRef.current;
    if (!active || active.progress.phase !== 'in-progress') return;
    try {
      const data = setResponse(await api.getSection(active.id, active.progress.sectionId));
      contentRef.current = data; setContent(data);
      // Preserve IDs for uncertain requests; only conflicts need a new revision and ID.
      if (saveError.startsWith('A newer answer')) for (const entry of queue.current.values()) entry.request = undefined;
      await pump();
    } catch (failure) { setSaveError(errorMessage(failure)); }
  };
  const begin = async () => {
    if (!schedule) return;
    applyAttempt(setResponse(await api.createAttempt(schedule.id, { mutationId: mutationId('create') })));
  };
  const start = async () => {
    const active = attemptRef.current; if (!active || active.progress.phase !== 'instructions') return;
    applyAttempt(setResponse(await api.startSection(active.id, active.progress.sectionId, { mutationId: mutationId(`start:${active.progress.sectionId}`) })));
  };
  const requestFullscreenFromGesture = (recovery: boolean) => {
    if (!document.fullscreenEnabled || typeof document.documentElement.requestFullscreen !== 'function') {
      setFullscreenMode(recovery ? 'required' : 'unsupported');
      setWarning(recovery
        ? 'Full screen cannot be restored in this browser right now. Use a supported browser to return to the exam; this failed request is not another strike.'
        : 'Full screen is unavailable in this browser or tablet. The exam continues without it; this is not a strike.');
      return;
    }
    // Call the browser API before any await so the user click supplies transient activation.
    try {
      void document.documentElement.requestFullscreen().then(() => {
        fullscreenEverEntered.current = true;
        try { sessionStorage.setItem('1609:was-fullscreen', '1'); } catch { /* Optional state only. */ }
        setFullscreenMode('active');
        setWarning('');
      }).catch(() => {
        setFullscreenMode(recovery ? 'required' : 'denied');
        setWarning(recovery ? 'Full screen was denied. Press Return to full screen again after allowing it in your browser.' : 'Full screen was denied. The exam continues; a denied request is not a strike.');
      });
    } catch {
      setFullscreenMode(recovery ? 'required' : 'denied');
      setWarning(recovery ? 'Full screen could not be restored. Press Return to full screen to retry.' : 'Full screen could not start. The exam continues without a strike.');
    }
  };
  const startExam = async () => {
    requestFullscreenFromGesture(false);
    if (!attemptRef.current) await begin();
    await start();
  };
  const mathStarting = useRef(false);
  const submit = useCallback(async () => {
    const active = attemptRef.current; if (!active || active.progress.phase !== 'in-progress') return;
    const timeLeft = Date.parse(active.progress.deadlineAt) - (anchor.current.server + performance.now() - anchor.current.local);
    if (timeLeft > 0) { await pump(); if (queue.current.size) throw new Error('Answers are not saved yet. Retry saving before submitting.'); }
    const next = setResponse(await api.submitSection(active.id, active.progress.sectionId, { mutationId: mutationId(`submit:${active.progress.sectionId}`) }));
    applyAttempt(next);
    if (next.progress.phase === 'instructions' && next.progress.sectionId === 'math') {
      // Start Math immediately; its own deadline comes from the server response.
      mathStarting.current = true;
      try { applyAttempt(setResponse(await api.startSection(active.id, 'math', { mutationId: mutationId('start:math') }))); }
      finally { mathStarting.current = false; }
    }
  }, [api, applyAttempt, pump, setResponse]);
  const expiring = useRef(false);
  useEffect(() => {
    if (attempt?.progress.phase !== 'in-progress' || now < Date.parse(attempt.progress.deadlineAt) || expiring.current) return;
    expiring.current = true;
    void submit().catch((failure) => setError(errorMessage(failure))).finally(() => { window.setTimeout(() => { expiring.current = false; }, 4000); });
  }, [attempt, now, submit]);
  useEffect(() => {
    if (attempt?.progress.phase !== 'instructions' || attempt.progress.sectionId !== 'math' || mathStarting.current) return;
    mathStarting.current = true;
    void api.startSection(attempt.id, 'math', { mutationId: mutationId('start:math') }).then((response) => {
      if (mounted.current) { applyAttempt(setResponse(response)); setError(''); }
    }).catch((failure) => { if (mounted.current) setError(`Math could not start automatically. ${errorMessage(failure)} Retrying…`); })
      .finally(() => { window.setTimeout(() => { mathStarting.current = false; }, 3000); });
  }, [api, attempt, now, applyAttempt, setResponse]);
  useEffect(() => {
    if (phase !== 'in-progress' || !attempt?.id) return;
    const dedupe = createViolationDeduper();
    let wasFullscreen = Boolean(document.fullscreenElement);
    let latestDecision: { counted: boolean; reason: string; remaining: number; receivedAt: number } | null = null;
    const reports = new Map<string, ViolationReport>(); let sending: Promise<void> | null = null;
    const flush = (): Promise<void> => {
      if (sending) return sending;
      sending = (async () => {
      try { for (const [key, report] of reports) {
        const response = await api.reportViolation(attempt.id, report, { keepalive: report.kind === 'page-exit' }); reports.delete(key);
        if (!mounted.current) return;
        const decision = setResponse(response);
        if (decision.counted) setWarning(`${decision.message} ${decision.strikes.count} of ${decision.strikes.limit} events recorded. ${decision.strikes.remaining} remaining. An observation is not an accusation.`);
        latestDecision = { counted: decision.counted, reason: decision.counted ? decision.strikes.lastReason ?? decision.message : decision.message, remaining: decision.strikes.remaining, receivedAt: performance.now() };
        if (report.kind === 'tab-hidden') setFocusReview({ state: 'ready', ...latestDecision });
        else setFocusReview((current) => current ? { state: 'ready', ...latestDecision! } : current);
        const currentAttempt = setResponse(await api.getAttempt(attempt.id)); applyAttempt(currentAttempt);
      } } catch { if (mounted.current) setWarning('A focus report could not be sent. It will be retried when the connection returns.'); }
      })().finally(() => { sending = null; });
      return sending;
    };
    const report = (kind: ViolationReport['kind']) => {
      const input = dedupe(kind);
      if (!input) return;
      reports.set(input.eventId, input); void flush();
    };
    const visibility = () => {
      if (document.hidden) {
        const recent = latestDecision && performance.now() - latestDecision.receivedAt < 2500 ? latestDecision : null;
        setFocusReview(recent ? { state: 'ready', ...recent } : { state: 'checking', counted: false, reason: '', remaining: attemptRef.current?.strikes.remaining ?? 5 });
        report('tab-hidden');
      }
      else {
        void (async () => {
          await flush();
          try {
            const currentAttempt = setResponse(await api.getAttempt(attempt.id)); applyAttempt(currentAttempt);
            if (currentAttempt.progress.phase === 'in-progress' && reports.size === 0) setFocusReview((current) => current && current.state === 'checking' ? {
              state: 'ready', counted: currentAttempt.strikes.remaining < current.remaining,
              reason: currentAttempt.strikes.remaining < current.remaining ? currentAttempt.strikes.lastReason ?? 'The exam service confirmed a rule break.' : 'The exam service did not confirm an additional strike.',
              remaining: currentAttempt.strikes.remaining,
            } : current);
          } catch { setWarning('Could not verify your attempt after returning. Reconnect before continuing.'); }
        })();
        if (fullscreenEverEntered.current && !document.fullscreenElement && document.fullscreenEnabled) setFullscreenMode('required');
      }
    };
    const fullscreen = () => {
      const active = Boolean(document.fullscreenElement);
      if (wasFullscreen && !active && fullscreenEverEntered.current) { setFullscreenMode('required'); report('fullscreen-exited'); }
      if (active) setFullscreenMode('active');
      wasFullscreen = active;
    };
    const pagehide = () => report('page-exit');
    const blur = () => { if (!document.hidden && !(document.activeElement instanceof HTMLIFrameElement)) report('window-blurred'); };
    const offline = () => { setWarning('Connection lost. Unsent answers are kept in this browser tab and will retry when the connection returns.'); report('connection-lost'); };
    const online = () => { report('connection-restored'); void flush(); void pump(); };
    const clipboard = (event: ClipboardEvent) => { event.preventDefault(); report(event.type as 'copy' | 'cut' | 'paste'); };
    const contextMenu = (event: MouseEvent) => { event.preventDefault(); report('context-menu'); };
    const beforePrint = () => report('print');
    const keyboard = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ['c', 'x', 'v', 'p'].includes(key)) { event.preventDefault(); report(({ c: 'copy', x: 'cut', v: 'paste', p: 'print' } as const)[key as 'c' | 'x' | 'v' | 'p']); }
      else if (event.key === 'F12' || ((event.ctrlKey || event.metaKey) && event.shiftKey && ['i', 'j', 'c'].includes(key))) { event.preventDefault(); report('developer-shortcut'); }
    };
    let width = window.innerWidth; let resizeTimer = 0;
    const resize = () => { window.clearTimeout(resizeTimer); resizeTimer = window.setTimeout(() => { if (window.innerWidth < width * .7) report('window-shrunk'); width = window.innerWidth; }, 200); };
    const retry = window.setInterval(() => { if (navigator.onLine) { void flush(); if (queue.current.size) void pump(); } }, 5000);
    document.addEventListener('visibilitychange', visibility); document.addEventListener('fullscreenchange', fullscreen); window.addEventListener('online', online); window.addEventListener('offline', offline); window.addEventListener('blur', blur); window.addEventListener('pagehide', pagehide); window.addEventListener('beforeprint', beforePrint); window.addEventListener('resize', resize); document.addEventListener('copy', clipboard, true); document.addEventListener('cut', clipboard, true); document.addEventListener('paste', clipboard, true); document.addEventListener('contextmenu', contextMenu, true); document.addEventListener('keydown', keyboard, true);
    return () => { clearInterval(retry); clearTimeout(resizeTimer); document.removeEventListener('visibilitychange', visibility); document.removeEventListener('fullscreenchange', fullscreen); window.removeEventListener('online', online); window.removeEventListener('offline', offline); window.removeEventListener('blur', blur); window.removeEventListener('pagehide', pagehide); window.removeEventListener('beforeprint', beforePrint); window.removeEventListener('resize', resize); document.removeEventListener('copy', clipboard, true); document.removeEventListener('cut', clipboard, true); document.removeEventListener('paste', clipboard, true); document.removeEventListener('contextmenu', contextMenu, true); document.removeEventListener('keydown', keyboard, true); };
  }, [api, attempt?.id, phase, applyAttempt, pump, setResponse]);
  const reconnect = async () => { await refresh(); if (!contentRef.current) setContentRetry((value) => value + 1); };
  return <ExamContext.Provider value={{ schedule, eligibility, attempt, content, loading, error, warning, now, pending, saveError, drafts, refresh: reconnect, begin, start, startExam, fullscreenMode, returnToFullscreen: () => requestFullscreenFromGesture(true), focusReview, dismissFocusReview: () => setFocusReview(null), submit, updateAnswer, retrySaving }}>{children}</ExamContext.Provider>;
}
export function useExam() { const value = useContext(ExamContext); if (!value) throw new Error('ExamProvider required.'); return value; }
export type { Answer };
