import { ApiError, type ExamApi } from './client';

/** Deliberately fails closed until the real Go transport is implemented. */
export function createUnavailableApi(): ExamApi {
  const unavailable = async (): Promise<never> => {
    throw new ApiError('SERVICE_UNAVAILABLE', 'Exam service unavailable.');
  };
  return {
    getService: unavailable, passwordSession: unavailable, requestEmailCode: unavailable, resendEmailCode: unavailable,
    verifyEmailCode: unavailable, signOut: unavailable, getStudent: unavailable,
    getSchedule: unavailable, getEligibility: unavailable, createAttempt: unavailable,
    getAttempt: unavailable, getActiveAttempt: unavailable, startSection: unavailable, getSection: unavailable,
    saveAnswer: unavailable, submitSection: unavailable, reportViolation: unavailable,
    getResult: unavailable, getReleases: unavailable, getReview: unavailable,
    getLeaderboard: unavailable,
  };
}
