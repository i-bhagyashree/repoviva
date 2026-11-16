# Contributing to RepoViva

Thanks for helping! Bug fixes, new review rules, new interview questions and UI improvements are all welcome.

## Set up

You need Node.js 20 or newer. No API key is needed.

```bash
git clone https://github.com/i-bhagyashree/repoviva.git
cd repoviva
npm run setup   # installs root, server and client
npm run dev     # server on :4000, website on :5173
```

Open http://localhost:5173 and create a local account. Accounts and reports are stored in `server/data/db.json` on your machine.

## Where things live

| Folder | What |
|---|---|
| `client/src/pages/` | One file per page (Home, Login, Dashboard, Report, Practice, Compare, Profile) |
| `client/src/components/` | Shared UI pieces |
| `server/src/index.ts` | All API routes |
| `server/src/analyzer.ts` | Built-in review rules (good first place to contribute) |
| `server/src/questions.ts` | Interview question bank by tech stack |
| `server/src/grader.ts` | Offline answer grader |

## Making a change

1. Fork the repo and create a branch: `git checkout -b fix/short-description`.
2. Make your change. Keep pull requests small and focused on one thing.
3. Check that everything builds:
   ```bash
   npm run build
   npm run lint --prefix client
   ```
4. Commit with a clear message, e.g. `Add rule for missing error handling in fetch calls`.
5. Open a pull request that explains **what** changed and **why**. Add a screenshot for UI changes.

## Guidelines

- TypeScript everywhere; no `any` unless there is no other way.
- The app must keep working **without** an API key. AI features are optional extras.
- Never commit secrets, `.env` files or `server/data/`.
- Validate all request bodies on the server with Zod.

## Reporting bugs and ideas

Open an issue with steps to reproduce (for bugs) or the problem you want solved (for ideas).

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
