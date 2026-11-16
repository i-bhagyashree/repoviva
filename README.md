# RepoViva

Paste a GitHub project link. Get a senior-developer code review and the interview questions a recruiter would ask about that project. Practice your answers and get them graded.

## Tech stack

| Part | Technology |
|---|---|
| Frontend (`client/`) | React, TypeScript, Vite, Tailwind CSS |
| Backend (`server/`) | Node.js, Express, TypeScript, Zod |
| AI | Claude API (Anthropic SDK) with structured outputs |
| Data | GitHub REST API; reports saved in browser localStorage |

## Run it

```bash
npm run setup     # first time only: installs everything
npm run dev       # starts server (port 4000) and client (port 5173)
```

Open the link Vite prints (usually http://localhost:5173).

Without an API key the app uses its **built-in review engine**: pattern rules (like a small linter) that find common problems, score the project and pick interview questions that match its tech stack. Answers are graded by checking which key points they mention. For a deeper AI review:

```bash
cp server/.env.example server/.env
# then put your key in server/.env:  ANTHROPIC_API_KEY=...
```

## Features

- **Home page** with how it works, features and FAQ.
- **Accounts**: sign up / log in with email and password (hashed with scrypt, signed tokens). No external auth service.
- **Dashboard**: review a repo, stats (average/best score, answers practiced), score trend chart, "focus next" weakest topics, search and sort your reports.
- **Report page**: severity and difficulty filters, a "fixed" checklist per issue, hints for each question, export to Markdown, print / save as PDF, public share link, "review again" with score change vs. your previous review.
- **Mock interview**: timed sessions (1-5 min per question or untimed), pick repo, count and difficulty, graded answers, session summary.
- **Compare**: two repos (or two reviews of the same repo) side by side.
- **Profile**: change name or password, download all your data, delete account.

Accounts, reports and practice answers are stored in `server/data/db.json` (created automatically, git-ignored).

## How it works

1. `client/src/App.tsx` routes between pages (hash routes like `#/dashboard`) and guards the private ones.
2. `server/src/auth.ts` handles passwords and tokens; `server/src/store.ts` is the JSON-file database.
3. `server/src/github.ts` reads the file list and downloads the most important source files (up to 40 files, 150 KB).
4. With an API key, `server/src/claude.ts` sends them to Claude. Without one, `server/src/analyzer.ts` runs rule checks, `server/src/questions.ts` picks questions and `server/src/grader.ts` grades answers.

## API

All endpoints except health, signup, login and share need `Authorization: Bearer <token>`.

| Endpoint | Body | Returns |
|---|---|---|
| `GET /api/health` | none | `{ ok, engine: "ai" \| "builtin" }` |
| `POST /api/auth/signup` | `{ name, email, password }` | `{ token, user }` |
| `POST /api/auth/login` | `{ email, password }` | `{ token, user }` |
| `GET / PATCH / DELETE /api/auth/me` | PATCH: `{ name?, currentPassword?, newPassword? }` | `{ user }` |
| `POST /api/analyze` | `{ url }` | the saved report |
| `GET /api/reports`, `GET /api/reports/:id` | none | your reports |
| `PATCH /api/reports/:id` | `{ shared }` | the report |
| `DELETE /api/reports/:id` | none | 204 |
| `POST /api/reports/import` | `{ reports }` | `{ imported }` (old browser-saved reports) |
| `GET /api/share/:id` | none | a shared report (public) |
| `POST /api/feedback` | `{ question, goodAnswerCovers, projectSummary, answer, reportId?, topic? }` | score and feedback |
| `GET /api/practice` | none | your graded answers |

## Live demo (GitHub Pages)

https://i-bhagyashree.github.io/repoviva/

This version runs entirely in your browser: reviews use the built-in engine, and your account and reports are saved in your browser only (`localStorage`). Share links contain the report itself. Every push to `main` redeploys it via `.github/workflows/deploy-pages.yml`.

## Deploy with the server (free, on Render)

1. Push this repo to GitHub.
2. On https://render.com: **New > Blueprint**, pick the repo. `render.yaml` sets everything up.
3. Open the URL Render gives you.

Note: Render's free plan does not keep files between restarts, so accounts and reports in `server/data/` are wiped when the service restarts. Add a Render disk (paid) or move to a hosted database for permanent data.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md). Released under the [MIT License](LICENSE).
