import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useExamService } from '../api/context';
import { errorMessage } from '../api/client';
import { Badge, Button, LoadingState, Notice, TextField } from '../components/ui';
import jurekArtwork from '../../assets/jurek.jpeg';
import adeleArtwork from '../../assets/adele.jpeg';
import olympiadLogo from '../../assets/1609logo.jpeg';
import './Auth.css';

export function Auth() {
  const { state, retry, setStudent } = useExamService();
  const location = useLocation();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (state.status === 'ready' && state.student) return <Navigate to={typeof location.state?.from === 'string' ? location.state.from : '/dashboard'} replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (state.status !== 'ready' || busy) return;
    setError(''); setBusy(true);
    try {
      if (mode === 'sign-up' && (!name.trim() || !/^(7|8|9|10|11|12)$/.test(grade))) throw new Error('Enter your name and select a grade from 7 to 12.');
      const response = await state.api.passwordSession(mode === 'sign-up'
        ? { purpose: mode, email: email.trim(), password, name: name.trim(), grade: Number(grade) }
        : { purpose: mode, email: email.trim(), password });
      setStudent(response.data);
    } catch (failure) { setError(failure instanceof Error && failure.message.startsWith('Enter your name') ? failure.message : errorMessage(failure)); }
    finally { setBusy(false); }
  }
  const mock = state.status === 'ready' && state.service.environment === 'development';
  return <main className="auth-layout">
    <section className="auth-story" aria-label="1609 SAT Olympiad">
      <div className="wordmark"><img className="brand-logo" src={olympiadLogo} alt="" />1609 SAT Olympiad</div>
      <div className="auth-story-copy campaign-story"><p className="eyebrow">ВЫБОРЫ ПРЕЗИДЕНТА ШКОЛЫ</p><h1>Твой голос<br /><em>имеет значение.</em></h1><p className="campaign-lead">Участвуй в школьных выборах: познакомься с кандидатами и проголосуй за того, кому доверяешь будущее школы.</p>
        <article className="campaign-card campaign-card--combined" aria-label="Jurek and Adele">
          <div className="campaign-candidate"><img src={jurekArtwork} alt="Арт с именем Jurek" width="180" height="180" /><h2>Vote for Jurek</h2></div>
          <div className="campaign-candidate"><img src={adeleArtwork} alt="Фото Adele" width="180" height="180" /><h2>Vote for Adele</h2></div>
        </article>
        <p className="campaign-status">Ссылки для голосования пока не добавлены.</p>
      </div>
      <div className="auth-format"><span>02 <small>fixed sections</small></span><span>49 <small>questions</small></span><span>67 <small>minutes</small></span></div>
      <p className="auth-footnote">Independent Olympiad. Not an official SAT exam or score.</p>
    </section>
    <section className="auth-panel" aria-labelledby="auth-title"><div className="auth-form-wrap">
      <p className="eyebrow">YOUR PLACE TO BEGIN</p><h2 id="auth-title">{mode === 'sign-in' ? 'Welcome back.' : 'Make it yours.'}</h2>
      <p>Sign in or create an account to join the Olympiad.</p>
      {mock && <div className="mock-note"><Badge>Local mock</Badge><span>Sample accounts are available in local development.</span></div>}
      {state.status === 'loading' && <LoadingState label="Restoring your session…" />}
      {state.status === 'error' && <><Notice tone="error" title="Exam service unavailable.">{state.message}</Notice><Button onClick={retry}>Try again</Button></>}
      {state.status === 'ready' && <>
        <div className="auth-switch" aria-label="Authentication mode"><Button variant={mode === 'sign-in' ? 'primary' : 'quiet'} aria-pressed={mode === 'sign-in'} onClick={() => { setMode('sign-in'); setError(''); }} disabled={busy}>Sign in</Button><Button variant={mode === 'sign-up' ? 'primary' : 'quiet'} aria-pressed={mode === 'sign-up'} onClick={() => { setMode('sign-up'); setError(''); }} disabled={busy}>Create account</Button></div>
        <form onSubmit={submit} aria-busy={busy}>
          {mode === 'sign-up' && <><TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={100} required disabled={busy} /><label className="field"><span>Grade</span><select value={grade} onChange={(e) => setGrade(e.target.value)} required disabled={busy}><option value="">Select grade</option>{[7, 8, 9, 10, 11, 12].map((value) => <option key={value} value={value}>{value}</option>)}</select></label></>}
          <TextField label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} placeholder="you@example.com" required disabled={busy} />
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} minLength={12} maxLength={72} required disabled={busy} hint={mode === 'sign-up' ? 'Use 12 to 72 characters.' : undefined} />
          {error && <Notice tone="error" title="Please try again">{error}</Notice>}
          <Button type="submit" className="wide" disabled={busy}>{busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'} <span aria-hidden="true">↗</span></Button>
        </form>
        <p className="privacy-note">Your email is private. Only your name and grade appear on the participant list.</p>
      </>}
    </div></section>
  </main>;
}
