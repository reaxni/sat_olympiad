import { useEffect, useState } from 'react';
import { useAuthenticatedApi } from '../api/context';
import { errorMessage } from '../api/client';
import type { AnswerValue, PersonalResult, ReleasedResource, ReleasedReview } from '../domain/exam';
import { Button, Card, LoadingState, Notice } from '../components/ui';
import { Content } from '../components/Content';
import { Link } from 'react-router';
export function Result({ attemptId }: { attemptId: string }) {
  const { api, isMock } = useAuthenticatedApi(); const [result, setResult] = useState<PersonalResult | null>(null);
  const [review, setReview] = useState<ReleasedResource<ReleasedReview> | null>(null); const [error, setError] = useState(''); const [retry, setRetry] = useState(0); const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => { try { const response = await api.getResult(attemptId, { signal: controller.signal }); if (!controller.signal.aborted) { setResult(response.data); setError(''); if (response.data.releases.explanations.status === 'locked') setReview(null); } } catch (failure) { if (!controller.signal.aborted) setError(errorMessage(failure)); } };
    void load(); const timer = window.setInterval(() => void load(), 15_000); return () => { controller.abort(); clearInterval(timer); };
  }, [api, attemptId, retry]);
  const openReview = async () => { setBusy(true); setError(''); try { setReview((await api.getReview(attemptId)).data); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); } };
  const describe = (value: AnswerValue | null, item: ReleasedReview['items'][number]) => !value ? 'No answer' : value.kind === 'numeric' ? value.value : item.question.kind === 'multiple-choice' ? `Choice ${item.question.choices.findIndex((choice) => choice.id === value.choiceId) + 1}` : 'Response unavailable';
  return <div className="page-container result-page"><div className="page-heading"><div><p className="eyebrow">1609 SAT OLYMPIAD</p><h1>Your result</h1><p>Your exam has ended and your saved answers have been scored. This is an independent Olympiad scale, not an official SAT score.</p></div><Link className="button button--secondary" to="/leaderboard">♜ Ranking</Link></div>
    {isMock && <Notice title="Simulated result">Development scores are sample display values. Placeholder questions have no answer key and are not graded.</Notice>}
    {error && <Notice tone="error" title="Result unavailable">{error}<Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>Try again</Button></Notice>}
    {!result && !error && <LoadingState label="Loading your result…" />}
    {result && <><div className="result-layout"><div><Card className="result-total"><p className="eyebrow">OVERALL SCORE</p><p className="score">{result.overall.value}<span> / 1600</span></p><p>{result.overall.label}</p></Card><Card className="result-meta"><div><span>Questions</span><strong>49</strong></div><div><span>Time taken</span><strong>{Math.floor(result.timeTakenSeconds / 60)} minutes</strong></div><div><span>Status</span><strong>Submitted</strong></div></Card></div><div><Card className="section-results"><h2>By section</h2>{([{ label: 'Reading and Writing', score: result.readingWriting }, { label: 'Math', score: result.math }]).map(({ label, score }) => <div className="section-score" key={label}><div><span>{label}</span><strong>{score.value} / 800</strong></div><progress max={800} value={score.value} /></div>)}</Card>
      <Card><h2>Answers & explanations</h2>{result.releases.explanations.status === 'locked' ? <p>{result.releases.explanations.message}</p> : <Button disabled={busy} onClick={() => void openReview()}>{busy ? 'Loading review…' : 'View released explanations'}</Button>}
        {review?.status === 'locked' && <Notice title="Review locked">{review.message}</Notice>}
        {review?.status === 'released' && <div className="released-review">{review.data.items.length === 0 && <p>No explanations are available for this placeholder test.</p>}{review.data.items.map((item) => <details key={item.question.id}><summary>{item.question.sectionId === 'math' ? 'Math' : 'Reading and Writing'} · Question {item.question.position}</summary>{item.question.passages?.map((passage) => <Content key={passage.id} blocks={passage.content} />)}<Content blocks={item.question.prompt} />{item.question.kind === 'multiple-choice' && <ol>{item.question.choices.map((choice) => <li key={choice.id}><Content blocks={choice.content} /></li>)}</ol>}<p>Your answer: {describe(item.submittedAnswer, item)}</p><p>Correct answer: {describe(item.correctAnswer, item)}</p><Content blocks={item.explanation} /></details>)}</div>}
      </Card></div></div></>}
  </div>;
}

