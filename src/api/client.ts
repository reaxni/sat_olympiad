import type {
  Answer, Attempt, Eligibility, ExamSchedule, ISODateTime, Leaderboard,
  PersonalResult, EmailCodeRequest, EmailChallenge, PasswordAuthRequest, ReleasedResource, ReleasedReview, Releases,
  SaveAnswerInput, SectionContent, SectionId, Student, ViolationDecision, ViolationReport,
} from '../domain/exam';

export interface ApiResponse<T> {
  data: T;
  serverTime: ISODateTime;
}
export interface RequestOptions { signal?: AbortSignal; keepalive?: boolean }
export interface MutationInput { mutationId: string }
export interface ServiceInfo { status: 'available'; environment: 'development' | 'production'; mockVerificationHint?: string }

export type ApiErrorCode = 'SERVICE_UNAVAILABLE' | 'NOT_IMPLEMENTED' | 'UNAUTHENTICATED'
  | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'CONFLICT' | 'NOT_FOUND' | 'RELEASE_LOCKED'
  | 'INVALID_CODE' | 'EXPIRED_CODE' | 'RATE_LIMITED';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  constructor(code: ApiErrorCode, message: string, status = 503) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/** UI uses only this boundary; a Go HTTP adapter will implement it later. */
export interface ExamApi {
  getService(options?: RequestOptions): Promise<ApiResponse<ServiceInfo>>;
  passwordSession(input: PasswordAuthRequest, options?: RequestOptions): Promise<ApiResponse<Student>>;
  requestEmailCode(input: EmailCodeRequest, options?: RequestOptions): Promise<ApiResponse<EmailChallenge>>;
  resendEmailCode(challengeId: string, options?: RequestOptions): Promise<ApiResponse<EmailChallenge>>;
  verifyEmailCode(challengeId: string, code: string, options?: RequestOptions): Promise<ApiResponse<Student>>;
  signOut(options?: RequestOptions): Promise<ApiResponse<null>>;
  getStudent(options?: RequestOptions): Promise<ApiResponse<Student | null>>;
  getSchedule(options?: RequestOptions): Promise<ApiResponse<ExamSchedule>>;
  getEligibility(examId: string, options?: RequestOptions): Promise<ApiResponse<Eligibility>>;
  createAttempt(examId: string, input: MutationInput, options?: RequestOptions): Promise<ApiResponse<Attempt>>;
  getActiveAttempt(examId: string, options?: RequestOptions): Promise<ApiResponse<Attempt | null>>;
  getAttempt(attemptId: string, options?: RequestOptions): Promise<ApiResponse<Attempt>>;
  startSection(attemptId: string, sectionId: SectionId, input: MutationInput, options?: RequestOptions): Promise<ApiResponse<Attempt>>;
  getSection(attemptId: string, sectionId: SectionId, options?: RequestOptions): Promise<ApiResponse<SectionContent>>;
  saveAnswer(attemptId: string, questionId: string, input: SaveAnswerInput, options?: RequestOptions): Promise<ApiResponse<Answer>>;
  submitSection(attemptId: string, sectionId: SectionId, input: MutationInput, options?: RequestOptions): Promise<ApiResponse<Attempt>>;
  reportViolation(attemptId: string, input: ViolationReport, options?: RequestOptions): Promise<ApiResponse<ViolationDecision>>;
  getResult(attemptId: string, options?: RequestOptions): Promise<ApiResponse<PersonalResult>>;
  getReleases(examId: string, options?: RequestOptions): Promise<ApiResponse<Releases>>;
  getReview(attemptId: string, options?: RequestOptions): Promise<ApiResponse<ReleasedResource<ReleasedReview>>>;
  getLeaderboard(examId: string, options?: RequestOptions): Promise<ApiResponse<Leaderboard>>;
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Connection failed. Check your connection and try again.';
}
