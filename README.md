# 1609 SAT Olympiad frontend

React, TypeScript, and Vite frontend for an independent remote Olympiad. It has one hard Reading and Writing section (27 questions, 32 minutes) followed immediately by one hard Math section (22 questions, 35 minutes). The name describes this independent Olympiad; scores are not official SAT scores. The Go service owns real questions, timing, accepted answers, scores, release decisions, and all account and session security.

## Setup

Use Node 22.12 or newer. Run `npm install`, then `npm run dev`. Open the local URL printed by Vite (normally `http://127.0.0.1:5173`). Run `npm run typecheck`, `npm test`, and `npm run build` before deployment. The build checks that development questions and mock account data are absent from the production bundle.

The local development adapter is clearly marked **Local mock**. Its sample account is `learner@example.test` with password `sample-password-123`; it sends no email. Set `VITE_MOCK_SCENARIO=exam` to start with an open sitting, `countdown` (default) to see the opening clock, or `released` to see released ranking and review gates. `VITE_MOCK_OPEN_DELAY_SECONDS` controls countdown length and `VITE_MOCK_CLOCK_RATE` can accelerate the mock clock. Set `VITE_DEV_API_MODE=unavailable` to inspect the service-unavailable view.

For an HTTP service, set `VITE_API_BASE_URL` to its origin, such as `http://localhost:8080`. Requests use `credentials: include` and a backend-managed secure session cookie; the frontend stores no authentication token and never reads or sends a client IP. The Go service must allow the exact local site origin in its CORS policy and allow credentials. In production, configure the service URL before building. Without it, the frontend shows service unavailable. See [Go API contract](docs/go-api-contract.md).

## Railway deployment

Deploy this frontend directory as its own Railway service. The included `Dockerfile` builds the production website and serves it with Nginx. `railway.json` enables the `/healthz` health check. Nginx listens on Railway's `PORT` and supports refreshing client routes such as `/auth` and `/dashboard`. Leave Railway's custom build/start command overrides empty so the container's commands run.

Before deploying, set frontend service variable `VITE_API_BASE_URL` to your public HTTPS backend origin. Optionally set `VITE_DESMOS_API_KEY`. These values are compiled into the website; rebuild when changing them. The Docker build stops if the API URL is missing. Local `.env` files are excluded from the Docker build context.

Add the website domain under the frontend service's Networking settings. For the selected address, use `www.1609sat-olympiad.run.place` and configure the CNAME/TXT records Railway provides. On the backend, include `https://www.1609sat-olympiad.run.place` in `ALLOWED_ORIGINS` (comma-separated if preserving other origins). If frontend and backend use different sites, configure `COOKIE_SAMESITE=none` with HTTPS; browser third-party-cookie restrictions may still affect login. Prefer a backend domain under the same site for reliable sessions.

Images from `assets/1609logo.jpeg`, `assets/jurek.jpeg`, and `assets/adele.jpeg` are imported by Vite, so the production build includes them with hashed filenames. Keep those files committed alongside the source.

See [Railway Docker build arguments](https://docs.railway.com/builds/dockerfiles) and [SPA routing](https://docs.railway.com/guides/spa-routing-configuration).

## Desmos configuration

Set `VITE_DESMOS_API_KEY` to an official Desmos API key. Both GraphingCalculator and ScientificCalculator are loaded only in Math. The frontend checks `window.Desmos.enabledFeatures` and the constructor for each calculator; a missing key, disabled feature, or loading failure shows an unavailable message. Any `VITE_` setting is embedded in the client bundle, so the Desmos key must be suitable for public browser use and restricted by the provider. Neither calculator appears in Reading and Writing.

## Manual checks

1. In the default countdown scenario, sign up with name, grade 7–12, email, and password, or sign in with the sample account. Try a wrong password, sign-out, and refresh to see session restoration.
2. Confirm Dashboard and Profile are the only sidebar pages. The Profile shows full name and email. Dashboard opens Exam and links to Ranking. Before release, Ranking has names and grades only.
3. With `VITE_MOCK_SCENARIO=exam`, start the exam. Test full-screen acceptance and denial, the timer, question grid, answer autosave, mark for review, eliminating choices, notes and highlights in Reading. Reload after saving; the attempt returns with the server deadline. In Math, test graphing/scientific switching, movable calculator and reference sheet, and numeric-response directions.
4. Submit Reading and Writing; Math should begin immediately with its own 35-minute timer. Submit Math; the result shows overall 400–1600 and section 200–800 scale. In mock mode these are explicitly simulated display values, not graded answers.
5. In a supported browser, switch tabs, exit full screen, attempt clipboard/print/context menu/shortcut actions, disconnect/reconnect, and sharply shrink the window. Check the named warning and provisional count appear immediately, then reconcile with the server. A tab switch should create one related focus observation. Returning to full screen requires a click.
6. Repeat on an iPad/tablet-sized viewport and laptop viewport. Verify the account sidebar becomes compact, the exam remains usable, the Reading panes stack on narrow screens, and the calculator and reference can be moved by drag or keyboard.

Unsent answer drafts are backed up in the current browser tab's session storage and retried after reconnection. Browser observations are saved locally by attempt ID with stable event IDs and retried after reconnection. The server remains authoritative: a different device, cleared storage, or a terminated tab cannot guarantee recovery of unsent changes. Only acknowledged answers count. Browser activity is a record for human review, not an automatic honesty verdict; the Go service enforces the displayed five-event restriction.

A website can observe focus, visibility, full-screen changes, and some keyboard actions in its own page. It cannot inspect other running applications, reliably detect already-open developer tools or screenshots, or prevent all bypasses by a student controlling the browser. Device-level monitoring would require a separate desktop proctoring application with explicit student consent and its own privacy and security review.
