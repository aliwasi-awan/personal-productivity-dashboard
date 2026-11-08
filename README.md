# Fen1x's Lair — Personal Productivity Dashboard

A local-first React + TypeScript dashboard for Personal, Work, German, and Study. Tasks, projects, goals, dedicated trackers, and activity logs share one IndexedDB store. Google Calendar is a read-only integration; dashboard tasks never create Google events.

## Project environment

Use an isolated environment for every project. This repository uses local `node_modules`, a committed pnpm lockfile, and an ignored `.venv` for optional Python tooling. The application itself runs on Node and does not need Python packages.

Requirements: Node 22.12+ and pnpm 10.11.

On this Windows machine, double-click **Start Dashboard.cmd**. The launcher finds the available Node/pnpm runtime, maintains `.venv`, installs missing local dependencies, and starts Vite. Leave its terminal open while using the dashboard. `./Start-Dashboard.ps1 -Check` runs tests and builds.

```powershell
cd 'C:\GPT Codebase\personal-productivity-dashboard'
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pnpm install --frozen-lockfile
pnpm dev
```

Open the address printed by Vite. `pnpm test` runs automated tests; `pnpm build` checks TypeScript and produces `dist`; `pnpm preview` serves the production build locally. On machines without pnpm, install pnpm from its official instructions or use Corepack if your Node distribution includes it.

## Local Anki due count

The German Anki project can refresh the due-card total from Anki Desktop through AnkiConnect on `127.0.0.1:8765`. Run this app locally with Anki Desktop open and AnkiConnect enabled. Configure two distinct deck names in ignored `.env.local` as `ANKI_REVIEW_DECK_1` and `ANKI_REVIEW_DECK_2`; names must use letters, numbers, spaces, periods, or hyphens. The local Vite dev and preview servers expose only a fixed same-origin count route and query only those configured decks. Hosted builds do not have this local server route or access to your Anki Desktop.

## Your data

- IndexedDB database: `daymark-dashboard`, schema version 1, store `state`.
- Saves commit atomically. A stale-tab revision check refuses silent overwrites. Reload other open tabs after editing in one tab.
- Save errors are visible. Do not clear browser storage to resolve errors; export a backup first when possible.
- JSON exports contain personal information and calendar assignments. Keep them outside this public repository.
- Import validates version, field types, dates, unique IDs, and record references before writing. Merge keeps existing records with the same ID; replace swaps the snapshot after confirmation.
- Browser data belongs to the exact website origin and browser profile. Local preview and GitHub Pages have separate storage. Use export/import to move between them or between devices.
- Clearing site data, using a private browsing session, or browser eviction can remove local data. Keep regular JSON backups. Git and GitHub Pages do not synchronize your personal records.
- Project and tracker deletion removes their related records after confirmation. Archive a project to retain its history.

## Connect Google Calendar

The app works without Google. To add events:

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. Enable **Google Calendar API** in APIs & Services → Library.
3. Configure Google Auth Platform branding, audience, and data access. Use the `https://www.googleapis.com/auth/calendar.readonly` scope. For an external app in Testing, add your Google account as a test user.
4. Create an OAuth client with application type **Web application**.
5. Add exact **Authorized JavaScript origins**, including your development origin, such as `http://localhost:5173` (and `http://127.0.0.1:5173` if used), plus `https://aliwasi-awan.github.io` for the eventual deployed app. Origins do not include a repository path. Ports must match the actual preview server.
6. Copy the **client ID** to Daymark Settings and connect. Do not copy or publish a client secret. A browser OAuth client ID is a public identifier.
7. First connection enables accessible calendars and maps familiar names to domains; unmatched calendars appear on Overview. Adjust assignments in Settings. While connected, visible, and online, events refresh every five minutes and on return after a minute. Use Refresh for immediate updates. Reconnect when short-lived authorization expires.

OAuth access tokens and fetched events stay in memory, never in the repository or JSON backups. Refreshing the browser requires connecting again. Offline local task editing still works while the app is open; Google fetching requires a connection. This release is not an installable offline PWA.

Google's standard Calendar API usage currently has no additional charge below its published thresholds. Check the [current quota and pricing page](https://developers.google.com/workspace/calendar/api/guides/quota) before enabling additional paid services. A single-person dashboard should be far below the published limits.

Official references: [browser token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [OAuth client setup](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid), [events API](https://developers.google.com/workspace/calendar/api/v3/reference/events/list).

## GitHub Pages release — approval required

No push automatically deploys this app. `check.yml` verifies code on push; `deploy.yml` is **manual only**.

After the owner approves deployment:

1. Set repository Settings → Pages → Source to **GitHub Actions**.
2. Run **Deploy approved release to Pages** from Actions.
3. Verify `https://aliwasi-awan.github.io/personal-productivity-dashboard/` and Google sign-in on that origin.

Vite emits relative asset paths and the UI uses hash navigation, so repository subpaths and page refreshes work without server rewrites. Add the production origin to your Google client before connecting. Keep tokens, private exports, and personal data out of Git.

## Storage migration policy

`src/storage.ts` owns version validation and the IndexedDB upgrade transaction. Version 1 creates the atomic snapshot store. Unknown future backup versions are rejected. Future migrations must preserve the old snapshot on transaction failure and have fixture tests before increasing either schema version; do not reset the database to perform an upgrade.
