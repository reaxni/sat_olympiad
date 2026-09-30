import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createApi } from './index';
import { errorMessage, type ExamApi, type ServiceInfo } from './client';
import type { Student } from '../domain/exam';
import { restoreSession } from './restoreSession';

type ServiceState = { status: 'loading' } | { status: 'ready'; api: ExamApi; service: ServiceInfo; student: Student | null } | { status: 'error'; message: string };
const ApiContext = createContext<{ state: ServiceState; retry: () => void; setStudent: (student: Student | null) => void } | null>(null);
export function ApiProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ServiceState>({ status: 'loading' });
  const [generation, setGeneration] = useState(0);
  const setStudent = useCallback((student: Student | null) => setState((old) => old.status === 'ready' ? { ...old, student } : old), []);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    void (async () => {
      try {
        const restored = await restoreSession(createApi, controller.signal);
        if (!controller.signal.aborted) setState({ status: 'ready', ...restored });
      } catch (error) {
        if (!controller.signal.aborted) setState({ status: 'error', message: errorMessage(error) });
      }
    })();
    return () => controller.abort();
  }, [generation]);
  useEffect(() => {
    const expire = () => setStudent(null);
    window.addEventListener('olympiad:session-expired', expire);
    return () => window.removeEventListener('olympiad:session-expired', expire);
  }, [setStudent]);
  return <ApiContext.Provider value={{ state, retry: () => setGeneration((v) => v + 1), setStudent }}>{children}</ApiContext.Provider>;
}
export function useExamService() {
  const context = useContext(ApiContext);
  if (!context) throw new Error('ApiProvider is required.');
  return context;
}
export function useAuthenticatedApi() {
  const { state } = useExamService();
  if (state.status !== 'ready' || !state.student) throw new Error('Authenticated session required.');
  return { api: state.api, student: state.student, isMock: state.service.environment === 'development' };
}
