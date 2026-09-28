import { LoadingState } from '../components/ui';

export function ModuleLoadingScreen({ math = false }: { math?: boolean }) {
  return <div className="module-loading-screen" role="status" aria-live="polite">
    <h1>{math ? 'Reading and Writing is complete' : 'Loading your exam'}</h1>
    <p>{math ? 'Your saved work is being carried forward.' : 'Your questions are being prepared.'}</p>
    <p>{math ? 'Math will open automatically with its own timer.' : 'Please keep this page open.'}</p>
    <LoadingState label={math ? 'Starting Math…' : 'Loading questions…'} />
  </div>;
}
