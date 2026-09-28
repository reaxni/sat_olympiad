import { ApiError, type ApiErrorCode, type ApiResponse, type ExamApi, type RequestOptions } from './client';

/** Cookie session only; no browser token storage and no client IP collection. */
export function createHttpApi(baseUrl: string): ExamApi {
  const base = baseUrl.replace(/\/$/, '');
  const id = encodeURIComponent;
  async function request<T>(path: string, method = 'GET', body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    const abort = () => controller.abort();
    options?.signal?.addEventListener('abort', abort, { once: true });
    if (options?.signal?.aborted) controller.abort();
    try {
      const response = await fetch(`${base}${path}`, {
        method, credentials: 'include', cache: 'no-store', signal: controller.signal, keepalive: options?.keepalive,
        headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-Olympiad-Request': '1' } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (response.status === 401) window.dispatchEvent(new Event('olympiad:session-expired'));
      const payload = await response.json();
      if (!response.ok) throw new ApiError((payload.error?.code ?? 'SERVICE_UNAVAILABLE') as ApiErrorCode, payload.error?.message ?? 'Exam service unavailable.', response.status);
      if (!payload || typeof payload !== 'object' || !('data' in payload) || typeof payload.serverTime !== 'string' || !Number.isFinite(Date.parse(payload.serverTime))) throw new ApiError('SERVICE_UNAVAILABLE', 'The exam service returned an invalid response.');
      return payload as ApiResponse<T>;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (options?.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
      throw new ApiError('SERVICE_UNAVAILABLE', 'Exam service unavailable. Check your connection and try again.');
    } finally {
      window.clearTimeout(timeout);
      options?.signal?.removeEventListener('abort', abort);
    }
  }
  const attempt = (value: string) => `/attempts/${id(value)}`;
  return {
    getService: (o) => request('/service', 'GET', undefined, o),
    passwordSession: (input, o) => request('/auth/password/session', 'POST', input, o),
    requestEmailCode: (input, o) => request('/auth/email/request', 'POST', input, o),
    resendEmailCode: (challengeId, o) => request('/auth/email/resend', 'POST', { challengeId }, o),
    verifyEmailCode: (challengeId, code, o) => request('/auth/email/verify', 'POST', { challengeId, code }, o),
    signOut: (o) => request('/auth/sign-out', 'POST', {}, o),
    getStudent: (o) => request('/auth/me', 'GET', undefined, o),
    getSchedule: (o) => request('/exam', 'GET', undefined, o),
    getEligibility: (e, o) => request(`/exams/${id(e)}/eligibility`, 'GET', undefined, o),
    getActiveAttempt: (e, o) => request(`/exams/${id(e)}/attempt`, 'GET', undefined, o),
    createAttempt: (e, input, o) => request(`/exams/${id(e)}/attempts`, 'POST', input, o),
    getAttempt: (a, o) => request(attempt(a), 'GET', undefined, o),
    startSection: (a, s, input, o) => request(`${attempt(a)}/sections/${id(s)}/start`, 'POST', input, o),
    getSection: (a, s, o) => request(`${attempt(a)}/sections/${id(s)}`, 'GET', undefined, o),
    saveAnswer: (a, q, input, o) => request(`${attempt(a)}/answers/${id(q)}`, 'PUT', input, o),
    submitSection: (a, s, input, o) => request(`${attempt(a)}/sections/${id(s)}/submit`, 'POST', input, o),
    reportViolation: (a, input, o) => request(`${attempt(a)}/violations`, 'POST', input, o),
    getResult: (a, o) => request(`${attempt(a)}/result`, 'GET', undefined, o),
    getReleases: (e, o) => request(`/exams/${id(e)}/releases`, 'GET', undefined, o),
    getReview: (a, o) => request(`${attempt(a)}/review`, 'GET', undefined, o),
    getLeaderboard: (e, o) => request(`/exams/${id(e)}/leaderboard`, 'GET', undefined, o),
  };
}
