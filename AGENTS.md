<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project boundaries

- This directory is the new application. The parent `archive`, `sources`, and research scripts are recovery artifacts; preserve them.
- Use Node.js 22 and npm with the committed package lock. Read `README.md` before changing database or deployment configuration.
- PGlite is development-only and single-process per data directory. Never point browser tests at the working `.data/postgres` database. Stop the local server before running administrative CLI commands against PGlite.
- Every mutation must authenticate on the server. Only published listings and their media are public. Keep authorization tests when modifying these rules.
- Run `npm run check` and `npm run test:e2e`. Browser tests are headless and use an isolated server on 4388; the user preview is 4387.
- Run production builds and browser tests sequentially on this shared machine. Concurrent runs have caused a Chromium page crash; the isolated rerun passed.
- Do not open new visible browser windows, alter VK community settings, publish externally, import old personal contacts, or expose local data as part of development checks.
- `.env*`, `.data`, test traces, and local OTP logs must remain private. Never use the development console mail transport in production.
- Deployment templates do not imply production validation. Verify real PostgreSQL, private S3, SMTP, VK ID, and backup restore separately before launch.
