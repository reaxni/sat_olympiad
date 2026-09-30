import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { useAuthenticatedApi, useExamService } from '../api/context';
import { errorMessage } from '../api/client';
import { useExam } from '../exam/context';
import { Badge, Button, Notice } from './ui';
import { Modal } from './Modal';
import olympiadLogo from '../../assets/1609logo.jpeg';
import { AppIcon } from './AppIcon';

export function Layout() {
  const { api, student, isMock } = useAuthenticatedApi();
  const { setStudent } = useExamService();
  const { pending, attempt, warning } = useExam();
  const { pathname } = useLocation();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = attempt?.progress.phase === 'in-progress' || (attempt?.progress.phase === 'instructions' && attempt.progress.sectionId === 'math');
  const takingExam = active && pathname === '/exam';
  useEffect(() => { document.title = `${pathname === '/profile' ? 'Profile' : pathname === '/leaderboard' ? 'Ranking' : pathname === '/exam' ? 'Exam' : 'Dashboard'} | 1609 SAT Olympiad`; }, [pathname]);
  if (active && pathname !== '/exam') return <Navigate to="/exam" replace />;
  const signOut = async () => {
    setBusy(true); setError('');
    try { await api.signOut(); setStudent(null); } catch (failure) { setError(errorMessage(failure)); setBusy(false); }
  };
  return <div className={`app-shell olympiad-shell ${takingExam ? 'test-active' : 'with-sidebar'}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    {!takingExam && <aside className="dashboard-sidebar">
      <div className="sidebar-brand"><img src={olympiadLogo} alt="" /><strong>1609 SAT<br />Olympiad</strong></div>
      <nav aria-label="Main navigation"><NavLink to="/dashboard"><AppIcon name="dashboard" /><span>Dashboard</span></NavLink><NavLink to="/leaderboard"><AppIcon name="ranking" /><span>Ranking</span></NavLink><NavLink to="/profile"><AppIcon name="profile" /><span>Profile</span></NavLink></nav>
      <div className="sidebar-account"><div><strong>{student.name}</strong><small>{student.email}</small></div><button aria-label="Sign out" onClick={() => setConfirm(true)}>↪</button></div>
    </aside>}
    <div className="shell-body">
      {isMock && !takingExam && <div className="mock-banner"><Badge>Local mock</Badge> Simulated accounts, questions, timing, and scores. No real service.</div>}
      {warning && !takingExam && <div className="global-warning"><Notice title="Exam notice">{warning}</Notice></div>}
      <main id="main-content"><Outlet /></main>
    </div>
    {confirm && <Modal title="Sign out?" onClose={() => { if (!busy) setConfirm(false); }}><p>{active ? 'The exam timer keeps running while you are signed out.' : 'You can sign in again with your email and password.'}</p>{pending > 0 && <Notice tone="error" title="Answers still saving">Wait for your responses to save before signing out.</Notice>}{error && <Notice tone="error" title="Sign-out failed">{error}</Notice>}<div className="actions"><Button variant="secondary" disabled={busy} onClick={() => setConfirm(false)}>Stay signed in</Button><Button disabled={busy || pending > 0} onClick={() => void signOut()}>{busy ? 'Signing out…' : 'Sign out'}</Button></div></Modal>}
  </div>;
}
