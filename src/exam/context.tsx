import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuthenticatedApi } from '../api/context';
import { ApiError, errorMessage, type ApiResponse } from '../api/client';
import type { Answer, AnswerValue, Attempt, Eligibility, ExamSchedule, QuestionTools, SaveAnswerInput, SectionContent, ViolationReport } from '../domain/exam';
import { createViolationDeduper, shortcutViolation } from './violationEvents';
import { eventLabel, loadPendingEvents, savePendingEvents } from './violationQueue';

type Draft = { value: AnswerValue | null; markedForReview: boolean; tools?: QuestionTools };
interface QueueEntry { draft: Draft; request?: SaveAnswerInput }
interface ExamContextValue {
  schedule: ExamSchedule | null; eligibility: Eligibility | null; attempt: Attempt | null; content: SectionContent | null;
  loading: boolean; error: string; warning: string; now: number; pending: number; saveError: string;
  violationCount: number; violationPending: number; violationLimitPending: boolean;
  drafts: Record<string, Draft>; refresh: () => Promise<void>; begin: () => Promise<void>; start: () => Promise<void>;
  startExam: () => Promise<void>; fullscreenMode: 'not-entered' | 'active' | 'required' | 'unsupported' | 'denied'; enterFullscreen: () => void; returnToFullscreen: () => void;
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
  const [violationPending, setViolationPending] = useState(0);
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
    if (!document.fullscreenElement) requestFullscreenFromGesture(false);
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
    const reports = new Map(loadPendingEvents(attempt.id).map((event) => [event.eventId, event]));
    setViolationPending(reports.size);
    let sending: Promise<void> | null = null;
    let blurTimer = 0;
    const persistReports = () => {
      setViolationPending(reports.size);
      if (!savePendingEvents(attempt.id, reports.values())) {
        setWarning('Local event backup is unavailable. Keep this tab open until the event is confirmed by the service.');
      }
    };
    const flush = (): Promise<void> => {
      if (sending) return sending;
      sending = (async () => {
        try {
          for (const [key, report] of reports) {
            if (!navigator.onLine) break;
            const decision = setResponse(await api.reportViolation(attempt.id, report, { keepalive: report.kind === 'page-exit' }));
            reports.delete(key); persistReports();
            if (!mounted.current) return;
            const current = attemptRef.current;
            if (current?.id === attempt.id) applyAttempt({ ...current, strikes: decision.strikes });
            const reason = decision.counted ? decision.strikes.lastReason ?? decision.message : decision.message;
            setWarning(`${reason} ${decision.strikes.count} of ${decision.strikes.limit} events confirmed.${reports.size ? ` ${reports.size} awaiting confirmation.` : ''} An observation is not an accusation.`);
            setFocusReview((visible) => visible ? { state: 'ready', counted: decision.counted, reason, remaining: decision.strikes.remaining } : null);
            if (decision.strikes.disqualified) {
              const final = setResponse(await api.getAttempt(attempt.id));
              if (mounted.current) applyAttempt(final);
              return;
            }
          }
        } catch {
          if (mounted.current) setWarning(`${reports.size} browser observation${reports.size === 1 ? '' : 's'} saved locally and awaiting the exam service. The timer continues.`);
        }
      })().finally(() => { sending = null; });
      return sending;
    };
    const report = (kind: ViolationReport['kind']) => {
      const input = dedupe(kind);
      if (!input) return null;
      reports.set(input.eventId, input); persistReports();
      const current = attemptRef.current;
      const projected = Math.min(current?.strikes.limit ?? 5, (current?.strikes.count ?? 0) + reports.size);
      setWarning(`${eventLabel(kind)}. ${projected} of ${current?.strikes.limit ?? 5} observed; ${reports.size} awaiting server confirmation. An observation is not an accusation.`);
      void flush();
      return input;
    };
    const visibility = () => {
      if (document.hidden) {
        window.clearTimeout(blurTimer);
        const observation = report('tab-hidden');
        setFocusReview({ state: 'ready', counted: false,
          reason: observation ? 'The exam tab was hidden. Server confirmation is pending.' : 'The exam tab was hidden during a related focus observation.',
          remaining: Math.max(0, (attemptRef.current?.strikes.remaining ?? 5) - reports.size) });
      }
      else {
        void (async () => {
          await flush();
          try {
            const currentAttempt = setResponse(await api.getAttempt(attempt.id)); applyAttempt(currentAttempt);
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
    const blur = () => {
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(() => {
        if (!document.hidden && !document.hasFocus() && !(document.activeElement instanceof HTMLIFrameElement)) {
          const observation = report('window-blurred');
          if (observation) setFocusReview({ state: 'ready', counted: false, reason: 'The exam window lost focus. Server confirmation is pending.', remaining: Math.max(0, (attemptRef.current?.strikes.remaining ?? 5) - reports.size) });
        }
      }, 120);
    };
    const focused = () => { window.clearTimeout(blurTimer); void flush(); };
    const offline = () => { setWarning('Connection lost. Unsent answers are kept in this browser tab and will retry when the connection returns.'); report('connection-lost'); };
    const online = () => { report('connection-restored'); void flush(); void pump(); };
    const clipboard = (event: ClipboardEvent) => { event.preventDefault(); report(event.type as 'copy' | 'cut' | 'paste'); };
    const contextMenu = (event: MouseEvent) => { event.preventDefault(); report('context-menu'); };
    const beforePrint = () => report('print');
    const keyboard = (event: KeyboardEvent) => {
      const kind = shortcutViolation(event);
      if (kind) { event.preventDefault(); report(kind); }
    };
    let width = window.innerWidth; let resizeTimer = 0;
    const resize = () => { window.clearTimeout(resizeTimer); resizeTimer = window.setTimeout(() => { if (window.innerWidth < width * .7) report('window-shrunk'); width = window.innerWidth; }, 200); };
    const retry = window.setInterval(() => { if (navigator.onLine) { void flush(); if (queue.current.size) void pump(); } }, 3000);
    if (reports.size) void flush();
    document.addEventListener('visibilitychange', visibility); document.addEventListener('fullscreenchange', fullscreen); window.addEventListener('online', online); window.addEventListener('offline', offline); window.addEventListener('blur', blur); window.addEventListener('focus', focused); window.addEventListener('pagehide', pagehide); window.addEventListener('beforeprint', beforePrint); window.addEventListener('resize', resize); document.addEventListener('copy', clipboard, true); document.addEventListener('cut', clipboard, true); document.addEventListener('paste', clipboard, true); document.addEventListener('contextmenu', contextMenu, true); document.addEventListener('keydown', keyboard, true);
    return () => { clearInterval(retry); clearTimeout(resizeTimer); clearTimeout(blurTimer); document.removeEventListener('visibilitychange', visibility); document.removeEventListener('fullscreenchange', fullscreen); window.removeEventListener('online', online); window.removeEventListener('offline', offline); window.removeEventListener('blur', blur); window.removeEventListener('focus', focused); window.removeEventListener('pagehide', pagehide); window.removeEventListener('beforeprint', beforePrint); window.removeEventListener('resize', resize); document.removeEventListener('copy', clipboard, true); document.removeEventListener('cut', clipboard, true); document.removeEventListener('paste', clipboard, true); document.removeEventListener('contextmenu', contextMenu, true); document.removeEventListener('keydown', keyboard, true); };
  }, [api, attempt?.id, phase, applyAttempt, pump, setResponse]);
  const reconnect = async () => { await refresh(); if (!contentRef.current) setContentRetry((value) => value + 1); };
  const violationCount = Math.min(attempt?.strikes.limit ?? 5, (attempt?.strikes.count ?? 0) + violationPending);
  const violationLimitPending = Boolean(attempt?.progress.phase === 'in-progress' && violationCount >= attempt.strikes.limit);
  return <ExamContext.Provider value={{ schedule, eligibility, attempt, content, loading, error, warning, now, pending, saveError, violationCount, violationPending, violationLimitPending, drafts, refresh: reconnect, begin, start, startExam, fullscreenMode, enterFullscreen: () => requestFullscreenFromGesture(false), returnToFullscreen: () => requestFullscreenFromGesture(true), focusReview, dismissFocusReview: () => setFocusReview(null), submit, updateAnswer, retrySaving }}>{children}</ExamContext.Provider>;
}
export function useExam() { const value = useContext(ExamContext); if (!value) throw new Error('ExamProvider required.'); return value; }
export type { Answer };
