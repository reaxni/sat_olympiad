/** Public format metadata only. The server enforces order, difficulty and timing. */
export const EXAM_SECTIONS = [
  { id: 'reading-writing', title: 'Reading and Writing', difficulty: 'hard', questionCount: 27, durationSeconds: 1920 },
  { id: 'math', title: 'Math', difficulty: 'hard', questionCount: 22, durationSeconds: 2100 },
] as const;

export type SectionId = (typeof EXAM_SECTIONS)[number]['id'];
export type Section = (typeof EXAM_SECTIONS)[number];
export type FixedSections = typeof EXAM_SECTIONS;
export type ISODateTime = string;

export interface Student {
  id: string;
  name: string;
  grade: number;
  email: string;
}
export type RegistrationInput = Pick<Student, 'name' | 'grade' | 'email'>;
export type EmailCodeRequest = { purpose: 'sign-in'; email: string } | ({ purpose: 'sign-up' } & RegistrationInput);
export type PasswordAuthRequest = { purpose: 'sign-in'; email: string; password: string } | ({ purpose: 'sign-up'; password: string } & RegistrationInput);
export interface EmailChallenge { id: string; email: string; expiresAt: ISODateTime; resendAt: ISODateTime }
export interface Participant { id: string; name: string; grade: number }
export interface Leaderboard { participants: Participant[]; results: ReleasedResource<LeaderboardEntry[]> }

export interface ExamSchedule {
  id: string;
  title: string;
  opensAt: ISODateTime;
  entryClosesAt: ISODateTime;
  sections: FixedSections;
  /** Optional server policy; displaying this does not make a browser observation a verdict. */
  autoSubmitAfterEvents?: number | null;
}

export type Eligibility =
  | { status: 'eligible' }
  | { status: 'blocked'; reason: 'not-open' | 'entry-closed' | 'already-completed' | 'disqualified' | 'ip-ineligible'; message: string };

export type TextMark = { start: number; end: number; style: 'underline' | 'italic' | 'bold' };
export type GraphPoint = { x: number; y: number };
export type ContentBlock =
  | { kind: 'text'; text: string; marks?: TextMark[] }
  | { kind: 'math'; latex: string; accessibleText: string }
  | { kind: 'image'; url: string; alt: string; caption?: string; width?: number; height?: number }
  | { kind: 'table'; caption: string; headers: string[]; rows: string[][] }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'graph'; title: string; xLabel: string; yLabel: string; xMin: number; xMax: number; yMin: number; yMax: number; points: GraphPoint[]; lines?: { from: GraphPoint; to: GraphPoint }[] };

export interface Passage {
  id: string;
  label?: string;
  content: ContentBlock[];
}

interface QuestionBase {
  id: string;
  sectionId: SectionId;
  position: number;
  prompt: ContentBlock[];
  passages?: Passage[];
  /** Optional organizer metadata for varied Reading and Writing item types. */
  readingSkill?: 'words-in-context' | 'inference' | 'cross-text-connections' | 'rhetorical-synthesis' | 'standard-english-conventions' | 'transitions' | 'text-structure';
  /** Math numeric items may request an adjacent input-format directions pane. */
  studentProducedResponseDirections?: boolean;
}

export type Question =
  | (QuestionBase & { kind: 'multiple-choice'; choices: { id: string; content: ContentBlock[] }[] })
  | (QuestionBase & { kind: 'numeric'; sectionId: 'math'; inputHint?: string });

/** Raw numeric input stays a string; accepted syntax and grading belong to Go. */
export type AnswerValue = { kind: 'choice'; choiceId: string } | { kind: 'numeric'; value: string };
export interface TextHighlight { id: string; blockId: string; start: number; end: number; text: string; color: 'yellow' | 'blue' | 'pink' | 'underline'; note?: string }
export interface QuestionTools { notes: string; highlights: TextHighlight[]; eliminatedChoiceIds: string[] }
export interface Answer {
  questionId: string;
  value: AnswerValue | null;
  markedForReview: boolean;
  revision: number;
  savedAt: ISODateTime;
  tools?: QuestionTools;
}
export interface SaveAnswerInput {
  value: AnswerValue | null;
  markedForReview: boolean;
  expectedRevision: number;
  mutationId: string;
  tools?: QuestionTools;
}

export interface StrikeState {
  count: number;
  limit: number;
  remaining: number;
  disqualified: boolean;
  lastReason?: string;
}
export interface ViolationReport {
  eventId: string;
  kind: 'tab-hidden' | 'window-blurred' | 'fullscreen-exited' | 'page-exit' | 'copy' | 'cut' | 'paste' | 'print' | 'context-menu' | 'developer-shortcut' | 'connection-lost' | 'connection-restored' | 'window-shrunk';
  observedAt: ISODateTime;
  relatedEventId?: string;
}
export interface ViolationDecision {
  counted: boolean;
  message: string;
  strikes: StrikeState;
}

export type AttemptProgress =
  | { phase: 'instructions'; sectionId: SectionId }
  | { phase: 'in-progress'; sectionId: SectionId; startedAt: ISODateTime; deadlineAt: ISODateTime }
  | { phase: 'completed'; completedAt: ISODateTime }
  | { phase: 'disqualified'; disqualifiedAt: ISODateTime };

export interface Attempt {
  id: string;
  examId: string;
  progress: AttemptProgress;
  strikes: StrikeState;
}

/** Empty slots permit sparse development content while retaining the fixed format. */
export interface QuestionSlot {
  position: number;
  question: Question | null;
}
export interface SectionContent {
  section: Section;
  slots: QuestionSlot[];
  answers: Answer[];
}

export type ReleaseState =
  | { status: 'locked'; message: string }
  | { status: 'released'; releasedAt: ISODateTime };
export interface Releases {
  explanations: ReleaseState;
  leaderboard: ReleaseState;
}
export interface OlympiadScore {
  value: number;
  maximum: number;
  label: string;
}
export interface PersonalResult {
  attemptId: string;
  submittedAt: ISODateTime;
  timeTakenSeconds: number;
  readingWriting: OlympiadScore;
  math: OlympiadScore;
  overall: OlympiadScore;
  releases: Releases;
}
/** Only returned by the separately authorized, released review endpoint. */
export interface ReleasedReview {
  attemptId: string;
  items: { question: Question; submittedAnswer: AnswerValue | null; correctAnswer: AnswerValue; explanation: ContentBlock[] }[];
}
export interface LeaderboardEntry {
  rank: number;
  name: string;
  grade: number;
  score: OlympiadScore;
  timeTakenSeconds: number;
}
export type ReleasedResource<T> =
  | { status: 'locked'; message: string }
  | { status: 'released'; releasedAt: ISODateTime; data: T };
