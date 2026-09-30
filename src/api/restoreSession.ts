import type { ExamApi, ServiceInfo } from './client';
import type { Student } from '../domain/exam';
import { createUnavailableApi } from './unavailable';

export interface RestoredSession { api: ExamApi; service: ServiceInfo; student: Student | null }

/** Stop waiting after five seconds; late restoration must not replace a new login. */
export function restoreSession(create: () => Promise<ExamApi>, signal: AbortSignal): Promise<RestoredSession> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    let finished = false;
    let api = createUnavailableApi();
    let service: ServiceInfo = { status: 'available', environment: 'production' };
    const finish = (action: () => void) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      controller.abort();
      action();
    };
    const cancel = () => finish(() => reject(new DOMException('Session restoration cancelled', 'AbortError')));
    const timer = setTimeout(() => finish(() => resolve({ api, service, student: null })), 5000);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) { cancel(); return; }
    void (async () => {
      api = await create();
      if (finished) return;
      const [info, current] = await Promise.all([
        api.getService({ signal: controller.signal }).then((response) => { service = response.data; return response; }),
        api.getStudent({ signal: controller.signal }),
      ]);
      finish(() => resolve({ api, service: info.data, student: current.data }));
    })().catch((error) => finish(() => reject(error)));
  });
}
