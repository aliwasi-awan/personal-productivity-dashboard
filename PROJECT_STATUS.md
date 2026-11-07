# Project status

## Decisions
- React, TypeScript, Vite, Tailwind; public GitHub repository and GitHub Pages destination.
- Dedicated trackers for habits, German learning, study sessions, and job applications.
- IndexedDB with atomic snapshots, validation, versioning, and stale-tab overwrite protection.
- Google Calendar API via read-only browser OAuth; no custom backend, secrets, or task-to-Google writes.
- Project-local `.venv` created; Node dependencies isolated in `node_modules`.
- Implementation approved. Deployment requires separate approval.

## Implemented
- Responsive light/dark dashboard, collapsible sidebar, four domains, Overview and Settings.
- Shared task board, sortable table, calendar, project/category management, goals and milestones.
- Dedicated habit, German, study-session and job-application trackers with editable activity history.
- Read-only Google OAuth integration, paginated event loading, calendar assignments, range caching and deduplication.
- Atomic local saving, validated JSON merge/replace and export, conflict protection and schema versioning.
- Windows launcher, isolated environments, GitHub check workflow and manual Pages deployment workflow.

## Verification
- 16 automated tests passed: storage roundtrip, malformed/future imports, reference integrity, concurrent writes, credential stripping, populated backup restoration, calendar boundaries, deduplication and safe links.
- TypeScript check and Vite production build passed through the repaired Windows launcher.
- Browser verified task creation, Overview-to-domain completion, table/board/calendar agreement, persistence after reload, study-session logging and Overview statistics.
- 390px mobile navigation and document width checked. Dashboard appearance captured through native browser window; extended screenshot capture was limited by minimized browser/window-control behavior.
- Test records were created only in local preview browser storage, never in source or Git. A temporary study tracker may remain in the testing browser profile.
- Independent reviewer identified form-event timing and import validation issues; fixes incorporated before final checks.

## External setup
- Owner must create a Google Cloud project, enable Calendar API, and configure a web OAuth client. Instructions in README and Settings.
- Live OAuth and production Pages validation require that setup and deployment approval respectively.
- GitHub Pages is not deployed. No production URL should be reported as live yet.
