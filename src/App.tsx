import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Layout } from './components/Layout';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { useExamService } from './api/context';
import { ExamProvider } from './exam/context';
import { LoadingState } from './components/ui';

const Exam = lazy(() => import('./pages/Exam').then((module) => ({ default: module.Exam })));
const LeaderboardPage = lazy(() => import('./pages/Leaderboard').then((module) => ({ default: module.LeaderboardPage })));

function Protected() {
  const { state } = useExamService(); const location = useLocation();
  if (state.status !== 'ready' || !state.student) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  return <ExamProvider key={state.student.id}><Layout /></ExamProvider>;
}
export function App() {
  return <Suspense fallback={<div className="module-loading-screen"><LoadingState label="Opening your page…" /></div>}><Routes><Route path="/auth" element={<Auth />} /><Route element={<Protected />}><Route path="/dashboard" element={<Dashboard />} /><Route path="/profile" element={<Profile />} /><Route path="/exam" element={<Exam />} /><Route path="/leaderboard" element={<LeaderboardPage />} /></Route><Route path="*" element={<Navigate to="/dashboard" replace />} /></Routes></Suspense>;
}
