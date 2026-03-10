# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Expo Router route entry files (`app/programs/create.tsx`, `app/programs/[id].tsx`, etc.).
- `src/screens/`: Route-level wrappers; create/edit routines now delegate to shared UI logic.
- `src/components/`: Reusable UI; use `src/components/RoutineEditorScreen.tsx` for routine create/edit flows and `ExerciseEditor.tsx` for exercise rows.
- `src/stores/`: Zustand stores.
- `src/stores/workoutSessionStore.ts`: canonical workout state + sync merge.
- `src/stores/activeSessionStore.ts` and `src/stores/workoutHistoryStore.ts`: selector wrappers to keep active-session and history concerns separated.
- `src/storage/`: persistence helpers (`workoutStorage.ts` for sharded workouts, `workoutStatsStorage.ts` for stats index).
- `src/lib/api/`: API and sync layer.
- `server/`: Express + TypeScript backend (`server/src`).

## Build, Test, and Development Commands
- `npm install`: install mobile app dependencies.
- `npm run dev`: start Expo dev server.
- `npm run android`: launch Android target.
- `npm run ios`: launch iOS target.
- `npx tsc --noEmit --pretty false --incremental false`: strict type check (run before commit).
- `cd server && npm install && npm run dev`: run backend locally.
- `cd server && npm run build && npm start`: build + run backend production mode.

## Coding Style & Naming Conventions
- TypeScript with strict mode; keep 2-space indentation.
- Use PascalCase for React components/screens and camelCase for stores/util files.
- Prefer `@/` path alias imports over deep relative paths.
- Keep screens thin when possible; place shared UI/state logic in components/hooks (example: `RoutineEditorScreen`).
- For workout features, prefer consuming `activeSessionStore`/`workoutHistoryStore` wrappers instead of adding new direct selectors everywhere.

## Testing Guidelines
- Automated tests are not configured yet; rely on type checks and focused manual QA.
- Minimum checks for routine-related changes:
- Create routine flow.
- Edit routine flow (save, save+start, delete).
- Muscle picker and set/rest controls.
- Validate sync-sensitive changes by confirming history/stats still update after save/edit/delete.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`).
- Keep commits scoped and descriptive (`refactor(routines): extract shared RoutineEditorScreen`).
- PRs should include: summary, affected paths, QA steps, and screenshots for UI changes.

## Security & Configuration Tips
- No end-user auth is required for this app mode; do not add auth dependencies unless requested.
- Keep runtime config behavior unchanged unless explicitly requested.
- Keep secrets in `.env`; backend requires `MONGODB_URI` (`PORT` defaults to `4000`).
- When adding new persisted keys, update force-resync key cleanup in `src/stores/syncStore.ts`.
