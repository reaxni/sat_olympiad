import { useState } from 'react';
import { useExam } from '../exam/context';
import { EXAM_SECTIONS } from '../domain/exam';
import { Badge, Button, Card, Notice } from '../components/ui';
import { Result } from './Result';
import { TestWorkspace, formatDuration } from '../exam/TestWorkspace';
import { ModuleLoadingScreen } from '../exam/ModuleLoadingScreen';

export function Exam() {
  const exam = useExam(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  if (exam.loading) return <ModuleLoadingScreen />;
  if (!exam.schedule) return <div className="page-container"><Notice tone="error" title="Exam service unavailable.">{exam.error || 'The exam could not be loaded.'}</Notice><Button onClick={() => void exam.refresh()}>Try again</Button></div>;
  if (exam.attempt?.progress.phase === 'completed') return <Result attemptId={exam.attempt.id} />;
  if (exam.attempt?.progress.phase === 'disqualified') return <div className="page-container narrow"><Badge>Attempt restricted</Badge><h1>Your attempt has ended.</h1><Notice tone="error" title="Five-event limit reached">{exam.attempt.strikes.lastReason ? `Latest recorded event: ${exam.attempt.strikes.lastReason} ` : ''}The exam service restricted this attempt after five confirmed events. No more answers can be submitted.</Notice><p>Contact the organizer if an event needs review.</p></div>;
  if (exam.attempt?.progress.phase === 'in-progress') return <TestWorkspace key={exam.attempt.progress.sectionId} />;
  if (exam.attempt?.progress.phase === 'instructions' && exam.attempt.progress.sectionId === 'math') return <><ModuleLoadingScreen math />{exam.error && <div className="module-loading-error"><Notice tone="error" title="Math is reconnecting">{exam.error}<Button onClick={() => void exam.refresh()}>Retry now</Button></Notice></div>}</>;
  const countdown = Math.max(0, Date.parse(exam.schedule.opensAt) - exam.now);
  const currentSection = EXAM_SECTIONS.find((section) => exam.attempt?.progress.phase === 'instructions' && section.id === exam.attempt.progress.sectionId) ?? EXAM_SECTIONS[0];
  const start = async () => {
    setBusy(true); setError('');
    try { await exam.startExam(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to start. Please try again.'); } finally { setBusy(false); }
  };
  return <div className="page-container"><div className="page-heading"><div><p className="eyebrow">1609 SAT OLYMPIAD</p><h1>Exam</h1><p>Two fixed sections. Reading and Writing, then Math.</p></div><Badge>{countdown > 0 ? 'Opening soon' : 'Ready to begin'}</Badge></div>
    {(exam.error || error) && <Notice tone="error" title="Unable to connect">{error || exam.error}<div><Button variant="secondary" onClick={() => void exam.refresh()}>Reconnect</Button></div></Notice>}
    <div className="exam-welcome-grid"><Card className="countdown-card"><p className="eyebrow">{countdown > 0 ? 'EXAM OPENS IN' : 'UP NEXT'}</p>
      {countdown > 0 && !exam.attempt ? <><div className="countdown" aria-label={`Time until opening: ${formatDuration(countdown)}`}>{formatDuration(countdown)}</div><p>Opens {new Date(exam.schedule.opensAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p><p>Stay on this page. Availability updates automatically.</p></> : <><h2>{currentSection.title}</h2><p>{currentSection.questionCount} questions · {currentSection.durationSeconds / 60} minutes · Hard</p><p>{currentSection.id === 'math' ? 'Reading and Writing is closed. Starting Math begins its 35-minute timer.' : 'The timer keeps running after you begin, even if you leave this page.'}</p>
        {!exam.attempt && exam.eligibility?.status === 'blocked' ? <Notice title="Entry unavailable">{exam.eligibility.message}</Notice> : <Button disabled={busy || Boolean(exam.error)} onClick={() => void start()}>{busy ? 'Starting…' : 'Start exam'}</Button>}
      </>}
    </Card><Card><h2>Before you begin</h2><p>The exam records observable browser activity while the sitting runs. The event count and every warning are visible. An event is not an accusation; a person can review the record.</p><ul className="rules-list"><li>Switching tabs or windows; leaving required full screen.</li><li>Attempting copy, cut, paste, or print; opening the context menu or a developer tools shortcut.</li><li>Losing or regaining the connection; sharply shrinking the window.</li></ul><p>After {exam.schedule.autoSubmitAfterEvents ?? 5} confirmed events, the attempt is restricted and further answers are blocked.</p><p>Most sittings use full screen. If you leave it, the paper is covered until you press Return to full screen; the clock keeps running. A denied or unsupported initial full-screen request does not count.</p><p>Answers are saved as you work. If the connection drops, unsent answers remain in this browser tab and are retried when it returns. Reloading restores the attempt and server deadline. Browser closure reports are best effort; device screenshots cannot be reliably detected by a website.</p></Card></div>
  </div>;
}
