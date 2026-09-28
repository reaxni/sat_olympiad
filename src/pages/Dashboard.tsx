import { Link } from 'react-router';
import { useExam } from '../exam/context';
import { Badge, Card, LoadingState, Notice } from '../components/ui';
import { formatDuration } from '../exam/TestWorkspace';

export function Dashboard() {
  const exam = useExam();
  if (exam.loading) return <div className="page-container"><LoadingState label="Loading dashboard…" /></div>;
  const schedule = exam.schedule;
  const phase = exam.attempt?.progress.phase;
  const until = schedule ? Math.max(0, Date.parse(schedule.opensAt) - exam.now) : 0;
  return <div className="page-container dashboard-page"><h1>Dashboard</h1><p className="muted">Your Olympiad and current sitting.</p>
    {!schedule ? <Notice tone="error" title="Service unavailable">{exam.error || 'The exam schedule could not be loaded.'}</Notice> : <Card className="dashboard-exam-card">
      <div className="card-heading"><h2>{schedule.title}</h2><Badge>{phase === 'completed' ? 'Finished' : phase === 'disqualified' ? 'Locked' : phase === 'in-progress' ? 'In progress' : until > 0 ? 'Opening soon' : 'Open'}</Badge></div>
      <p>One hard Reading and Writing module followed immediately by one hard Math module.</p>
      <div className="dashboard-facts"><span>◷ &nbsp; 32 + 35 minutes</span><span>☷ &nbsp; 27 + 22 questions</span><span>▦ &nbsp; Grades 7–12</span></div>
      {until > 0 && !exam.attempt && <p>Opens in <strong>{formatDuration(until)}</strong> · {new Date(schedule.opensAt).toLocaleString()}</p>}
      <div className="dashboard-card-actions"><Link className="button button--primary" to="/exam">{phase === 'completed' ? 'See your result' : phase === 'in-progress' ? 'Return to exam' : 'Open exam'}</Link><Link className="button button--secondary" to="/leaderboard">Ranking</Link></div>
    </Card>}
  </div>;
}
