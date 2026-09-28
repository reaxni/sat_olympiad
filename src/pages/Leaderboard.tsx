import { useEffect, useState } from 'react';
import { useAuthenticatedApi } from '../api/context';
import { errorMessage } from '../api/client';
import type { Leaderboard } from '../domain/exam';
import { Button, Card, LoadingState, Notice } from '../components/ui';
import { Link } from 'react-router';
const duration = (seconds: number) => `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`;

export function LeaderboardPage() {
  const { api } = useAuthenticatedApi(); const [data, setData] = useState<Leaderboard | null>(null); const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try { const schedule = await api.getSchedule({ signal: controller.signal }); const response = await api.getLeaderboard(schedule.data.id, { signal: controller.signal }); if (!controller.signal.aborted) { setData(response.data); setError(''); } }
      catch (failure) { if (!controller.signal.aborted) { setError(errorMessage(failure)); setData(null); } }
    };
    void load(); const timer = window.setInterval(() => void load(), 15_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [api, retry]);
  const released = data?.results.status === 'released';
  return <div className="page-container ranking-page"><div className="page-heading"><div><p className="eyebrow">1609 SAT OLYMPIAD</p><h1>Ranking</h1><p>{released ? 'Results released by the organizer. Ties are ordered by time taken.' : 'Registered participants. Ranks, scores, and times appear after release.'}</p></div><Link className="button button--secondary" to="/dashboard">Dashboard</Link></div>
    {error ? <Notice tone="error" title="Leaderboard unavailable">{error}<div><Button variant="secondary" onClick={() => setRetry((v) => v + 1)}>Try again</Button></div></Notice> : !data ? <LoadingState label="Loading participants…" /> : <>
      {!released && <Notice title="Results not released">Only participant names and grades are available.</Notice>}
      <Card className="leaderboard-card"><div className="card-heading"><h2>{released ? 'Released results' : 'Registered participants'}</h2><span>{data.participants.length} participants</span></div>
        <div className="table-scroll" role="region" aria-label="Ranking table" tabIndex={0}><table><caption className="sr-only">{released ? 'Released Olympiad ranking' : 'Registered participants without ranks or scores'}</caption><thead><tr>{released && <th scope="col">Rank</th>}<th scope="col">Participant</th><th scope="col">Grade</th>{released && <><th scope="col">Score</th><th scope="col">Time taken</th></>}</tr></thead><tbody>
          {data.results.status === 'released' ? data.results.data.map((entry, i) => <tr key={`${entry.rank}-${i}`}><td>{entry.rank}</td><th scope="row">{entry.name}</th><td>{entry.grade}</td><td>{entry.score.value} / {entry.score.maximum}</td><td>{duration(entry.timeTakenSeconds)}</td></tr>) : data.participants.map((person) => <tr key={person.id}><th scope="row">{person.name}</th><td>{person.grade}</td></tr>)}
        </tbody></table></div>{(data.results.status === 'released' ? data.results.data.length === 0 : data.participants.length === 0) && <p className="empty-state">No participants to display yet.</p>}
      </Card>
    </>}
  </div>;
}
