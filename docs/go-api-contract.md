# Go HTTP contract

The implementation now lives in [SAT_backend](../../SAT_backend/README.md). The local Vite development setup uses `.env.development.local` to call `http://127.0.0.1:8080`. Start the Go service and PostgreSQL first; without them the frontend deliberately shows a service-unavailable state.

The production frontend calls the origin in `VITE_API_BASE_URL` with `fetch(..., { credentials: 'include', cache: 'no-store' })`. Every success is `{ "data": ..., "serverTime": "ISO-8601 UTC" }`; errors use `{ "error": { "code": "...", "message": "..." } }` and an appropriate HTTP status. `serverTime` anchors the display clock; Go enforces deadlines. Configure credentialed CORS for the exact local development site origin (for example `http://127.0.0.1:5173`, and `http://localhost:5173` if used); `Access-Control-Allow-Origin: *` cannot be used with credentials. Allow `Content-Type` and `X-Olympiad-Request` on mutating requests. Use secure, HttpOnly, SameSite-appropriate session cookies and CSRF protection. Go obtains the client IP from trusted request information, not from browser JavaScript. The frontend sends no IP field and stores no auth token.

The TypeScript source of truth is [exam.ts](../src/domain/exam.ts), [client.ts](../src/api/client.ts), and [http.ts](../src/api/http.ts). The endpoint outline is:

| Method and path | Purpose |
| --- | --- |
| `GET /service` | Service availability and environment |
| `POST /auth/password/session` | `{ purpose: 'sign-in', email, password }` or `{ purpose: 'sign-up', name, grade, email, password }` → Student, establishes cookie session |
| `GET /auth/me` | Restore Student or null from cookie |
| `POST /auth/sign-out` | Revoke cookie session |
| `GET /exam` | Schedule, two fixed section descriptors, optional `autoSubmitAfterEvents` |
| `GET /exams/:id/eligibility` | Server decision on entry |
| `GET /exams/:id/attempt` | Current attempt or null |
| `POST /exams/:id/attempts` | Idempotent `{ mutationId }` |
| `GET /attempts/:id` | Authoritative progress and activity count |
| `POST /attempts/:id/sections/:section/start` | Idempotent `{ mutationId }` |
| `GET /attempts/:id/sections/:section` | Only currently authorized section's slots and saved answers |
| `PUT /attempts/:id/answers/:questionId` | `{ value, markedForReview, tools?, expectedRevision, mutationId }` → saved Answer |
| `POST /attempts/:id/sections/:section/submit` | Idempotent `{ mutationId }` → next attempt progress |
| `POST /attempts/:id/violations` | Idempotent observed browser event → decision and updated count |
| `GET /attempts/:id/result` | Personal section/overall scores and release states |
| `GET /attempts/:id/review` | Released correct answers and explanations, or locked state |
| `GET /exams/:id/releases` | Release states |
| `GET /exams/:id/leaderboard` | Public participant list and gated ranking |

The backend saves the typed email at sign-up, hashes the password with bcrypt, and establishes a cookie session. No email verification code is sent or required. Sign-up requires name, email, and integer grade 7–12. Profile displays only name and email. Public participant payloads include `id`, `name`, and `grade`, never email. Before release, `leaderboard.results` is `{ status: 'locked', message }` with no ranking data. After release, entries include rank, name, grade, score on the 400–1600 independent Olympiad scale, and `timeTakenSeconds`; Go defines tie handling and disclosure. Personal result includes `submittedAt`, `timeTakenSeconds`, Reading and Writing and Math section scores each 200–800, overall 400–1600, and release states. Real scores and keys must never be computed or shipped in React.

The Go service grades with a transparent independent scale: `200 + 10 × round(60 × correct / questionCount)` per section. The overall score is their sum; score ties rank by shorter completion time. It is not an official SAT score. Organizer-only CLI commands import the private bank and release explanations and ranking independently. The backend requires all 49 questions before anyone can start.

The schedule contains exactly Reading and Writing (27, 32 minutes) then Math (22, 35 minutes). The frontend requests only the current section. Submission/expiry of Reading advances directly to Math. Go must make the transition and Math deadline atomic so a lost connection cannot extend Math time. Answers and annotations use optimistic revisions; each `mutationId` is idempotent. The frontend retains pending drafts in tab session storage across reloads and retries them, but Go's acknowledged answer is authoritative. On conflict, the frontend fetches the latest section before retrying.

`entryClosesAt` is also the hard deadline for the entire exam. The displayed timer uses the earlier of the section deadline and this shared closing time. At closing, editing stops and the browser requests the finalized attempt/result. Go completes all started, unrestricted attempts and grades their saved answers, including partial Reading-only attempts and absent browsers; no new answers are accepted after closing. The leaderboard automatically releases at closing after attempts have been finalized, showing scores and ranks 1, 2, 3, etc. It refreshes every five seconds. Unstarted/restricted attempts have no rank. Answer keys and explanations still require organizer release.

`ViolationReport.kind` supports `tab-hidden`, `window-blurred`, `fullscreen-exited`, `page-exit`, `copy`, `cut`, `paste`, `print`, `context-menu`, `developer-shortcut`, `connection-lost`, `connection-restored`, and `window-shrunk`. Reports carry `eventId`, `observedAt`, and optional `relatedEventId`. The client groups focus/full-screen/page-exit signals from one action; Go must deduplicate idempotently as well. `observedAt` is diagnostic, never trusted as proof. The current `ViolationDecision.counted` and `Attempt.strikes.count` fields are legacy names in the typed interface: they represent **recorded observations**, not a finding of misconduct. The mock never locks an attempt based on count. If Go has an automatic **submission** threshold, return it as `autoSubmitAfterEvents` in the schedule so the briefing can show it before start; no browser event automatically decides honesty. The server may return a locked attempt after a separate organizer decision. Page-exit reporting is best effort. Browser code cannot prevent screenshots, detect every closure, control browser chrome, or guarantee full-screen support on tablets.

Serve question media only after authorization. Do not return future-section questions, answer keys, or unreleased explanations through any pre-release endpoint. The production build includes no development fixtures. `VITE_DESMOS_API_KEY` is a browser-visible provider key; enable and restrict the official GraphingCalculator and ScientificCalculator features with Desmos. The frontend shows a clear unavailable state for a disabled feature.

The bank importer accepts embedded data-URI images inside authorized question JSON and rejects public question fields named `correctAnswer` or `explanation`. No private bank file belongs in either repository. Cookie `SameSite` is configurable for deployment; use same-site frontend/API origins when possible. Browser activity reports are observations; only an organizer command can lock an attempt. The current Go service has no IP eligibility restriction because an organizer policy was not specified.
