import type { ExamApi } from './client';
import { createUnavailableApi } from './unavailable';
import { createHttpApi } from './http';

export async function createApi(): Promise<ExamApi> {
  if (import.meta.env.VITE_API_BASE_URL) return createHttpApi(import.meta.env.VITE_API_BASE_URL);
  // Vite removes this entire import branch from production builds.
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_API_MODE !== 'unavailable') {
    const { createMockApi } = await import('./development/mock');
    return createMockApi();
  }
  return createUnavailableApi();
}
