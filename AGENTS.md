# Repository Guidelines

## Purpose
Personal, single-device workout tracker. Expo Router (iOS only, Expo SDK 55) with SQLite on the
phone; an Express + Mongo mirror exists only so data survives reinstalling a sideloaded build.

## Project Structure
- `app/`: Expo Router routes (thin: each renders one screen)
- `src/screens/`: Screen implementations
- `src/components/`: Feature components (`Workout/` live-workout pieces, `Workout/HUD/` session header + bottom bar, `Home/` dashboard chart + start sheet)
- `src/components/ui/`: Primitives: `IconButton`, `Button` (text button, same tones/radius), `ScreenHeader`, `SegmentedControl`, `Chip`, `Sheet`, `EmptyState`, `SectionLabel`
- `src/constants/theme.ts`: every design token (`COLORS`, `SURFACE`, `SPACE`, `RADIUS`, `TYPE`, `UI`, fonts)
- `src/hooks/useSheet.ts`: sheet mount/animation + drag-to-close (used by `Sheet`)
- `src/db/`: SQLite layer (`driver.ts` schema + driver interface, `workoutRepo.ts`, `dbVersion.ts`, `migrateFromAsyncStorage.ts`, `index.ts` expo-sqlite binding)
- `src/stores/`: Zustand stores (small, AsyncStorage-persisted)
- `src/storage/asyncStorage.ts`: debounced AsyncStorage adapter for the stores
- `src/lib/api/`: HTTP client, `backup.ts`, converters, `networkListener.ts`
- `src/utils/`: Shared helpers
- `src/widgets/`: iOS Live Activity (SwiftUI via `expo-widgets`; exempt from the colour-token lint rule)
- `patches/`: `patch-package` patches applied on `npm install` (expo-widgets resolves the entitled App Group at runtime, see README “Sideloading”)
- `shared/`: JS helpers used by app and (contractually) server: `programs.js`, `muscles.js` with `.d.ts`
- `server/`: Express + TypeScript backend

## Route Map
- `app/index.tsx` → redirect (`/workout` if a session is active, else `/programs/`)
- `app/programs/index.tsx` → home (`ProgramsListScreen`)
- `app/programs/create.tsx`, `app/programs/[id].tsx` → `ProgramEditorScreen variant="create" | "edit"` (create may duplicate via `?sourceId=`)
- `app/workout/index.tsx` → live workout
- `app/history/index.tsx`, `app/stats/index.tsx`, `app/exercises/[name]/volume.tsx`, `app/settings/index.tsx`
- `app/mock-data.tsx` → dev-only history injector (`__DEV__`, not linked from the UI)
- `app/_layout.tsx` opens the database, runs the shard migration, then mounts the stack. Routes auto-register; only list a `Stack.Screen` when it needs options.

## Ownership
- `ProgramsListScreen`: activity summary (SQLite summaries), routine list (`ProgramTile`), floating bar whose Start opens `StartWorkoutSheet` (search routines or start blank)
- `ProgramEditorScreen` → `RoutineEditorScreen` (form) → `ExerciseEditor` rows
- `WorkoutSessionScreen`: live session as one scrollable page of `ExerciseCard`s (→ `SetRow`, lazy `ExerciseHistoryGraph`); `HUDHeader` + `HUDBar` (add, reorder, discard, finish); `RoutineNamePrompt`. Every picker (exercise, muscles, rest, tracking mode, reorder) is mounted by the screen, never inside a card: an overlay inside a scrolling card is positioned relative to that card and gets clipped. `RoutineEditorScreen` follows the same rule for `ExerciseEditor` rows.
- `WorkoutHistoryScreen`, `ExerciseListStatsScreen`, `ExerciseVolumeScreen`, `SettingsScreen` read the repo through `useDbQuery`
- Shared: `EditableSetTag` (tap-to-edit weight×reps), `SetTypeLegend`, `Swipeable`, `FloatingRestTimer`, `LiveRestTimer`, `LiveWorkoutTimer`, `RestTimerLiveActivity`
- `workoutSessionStore.ts`: active session, rest timer, pins, `dirtyWorkoutIds` / `deletedWorkoutIds`. Completed sessions are written to `workoutRepo`, never kept in the store. `toggleExerciseUnit` converts every set's weight (the logged load stays physically the same); the session is written to SQLite only on finish. `propagateExerciseEdit()` is the one path for muscle/rename/removal propagation (repo + active session).
- `programStore.ts`: programs, `dirtyProgramIds` / `deletedProgramIds`, `importPrograms` for restore
- `exerciseLibraryStore.ts` (custom exercises, local-only), `uiPreferencesStore.ts`
- `syncStore.ts`: `pushPending`, `backupEverything`, `restoreFromCloud` with an in-flight guard; `syncEffect.ts` debounces a push whenever something becomes pending; `networkListener.ts` restores on an empty install or pushes on startup/reconnect

## Data & Persistence
- SQLite `gym.db`: `workouts` (one row per completed session) + `workout_exercises` (one JSON row per exercise, indexed by `identity_key`). Stats read `recentExercises` (window function) or `exerciseHistory(key)`; nothing loads the whole history into memory.
- `useDbQuery(fn, deps)` re-runs after any repo write (`bumpDbVersion`). Repo reads are synchronous.
- Legacy `workout_*` AsyncStorage shards are imported once by `migrateFromAsyncStorage` and then deleted.
- Stores persist with `zustandAsyncStorage` (per-key debounce, flushed on background). Store versions: workout-session 7, program 7.
- Tests run the repository against Node's built-in `node:sqlite` (`src/db/__tests__/nodeDriver.ts`); CI needs Node ≥ 22.

## Backup Model (single device)
- Local is the source of truth. `updatedAt` is bumped on every local edit and used only for the push-clear guard (an edit landing during a push keeps its id dirty).
- Push: `DELETE /batch` for pending deletes (hard delete), then `PUT /batch` in chunks of 50. Restore: `GET /programs`, `GET /workouts?limit&skip` paged by 200, replacing local. No tombstones, no watermarks, no merge.
- Server (`server/src`): `makeSyncService(Model, sort)` (replaceOne upsert, deleteMany, findAll excluding legacy `deletedAt` docs) + `makeSyncRouter(service, schema, key)`; zod validation in `validation/schemas.ts`; models infer types from schemas.

## Data Invariants
- Normalize exercises via `shared/programs.js` (`normalizeExercise`, `normalizeSets`, `normalizeTrackingMode`, `NEXT_SET_TYPE`); `normalizePersistedWorkoutSession` (`src/utils/normalizeWorkout.ts`) for any raw session
- Exercise identity: `exerciseDefinitionId`, else canonical name (`utils/exerciseIdentity.ts`); the repo recomputes `identity_key` on every write
- Tracking modes `strength | timed | cardio`; set types `working | warmup | dropset` (`SET_TYPE_COLORS`)
- Custom exercise ids use the `custom-` prefix; renames/removals go through both stores' `*ExerciseDefinitionReferences`
- Custom and pinned exercises are local only; restore never touches them
- `defaultSets` is a set-type template array; legacy numeric counts backfill to at least one working set
- Finishing a workout stores only completed sets; a session with none is discarded

## Commands
- `npm install` (runs `patch-package`); `npm run dev`; `npm run ios`
- `npm run typecheck`, `npm run lint`, `npm run format` / `format:check` (app, shared, server), `npm test`
- `cd server && npm install && npm run dev`; `npm run build && npm start`; seeds `seed:year`, `seed:4day-split` (+ `:remove`); dev tools `db:clear`, `db:diag`
- EAS: project `@4peng/gym-mobile`; `eas.json` has a `simulator` dev-client profile

## CI
- `.github/workflows/ci.yml` (Node 24): `lint`, `format:check`, `typecheck`, server `tsc --noEmit`, `test`; steps use `if: !cancelled()`
- `.github/workflows/ios-build.yml`: IPA on `main`, released for sideloading. Ad-hoc signed only so the App Group entitlement travels with the app and the widget extension (see README “Sideloading”). Not a gate.

## Coding Style
- TypeScript strict; Prettier is the formatting authority (100 cols, double quotes, trailing commas). Never hand-minify JSX.
- iOS only: no `Platform.OS` branches, no `BackHandler`, no web fallbacks
- Colours, spacing, radii and text styles come from `@/constants/theme`; raw hex/rgba literals in components, screens or routes fail lint. Use `TYPE` presets as-is (override colour/alignment only, never `fontSize`/`fontWeight`); one grey outline (`COLORS.BORDER`) for cards/buttons, `SURFACE.hairline` for insets; corner radius `item` for controls, `container` for cards and bars
- Overlays use `Sheet` (or `useSheet` for the one anchored dropdown); never a native `Modal`
- Selectors return primitives or `useShallow`-wrapped arrays/objects; screens read the store directly, no wrapper hooks
- Reuse before writing: check `src/utils/`, `src/hooks/`, `src/components/ui/`, `shared/` first
- One import alias: `@/` → `src/`, `@/shared/` → `shared/`

## Testing
- Jest (`jest-expo`) suites in `__tests__/` beside the code: repo SQL, migration, backup engine, stores, network listener, converters, utils. `npm test`.
- Manual QA for UI: routine create/edit/duplicate/delete, muscle picker, set/rest controls, quick-start, start-from-routine, finish (incl. save-as-routine), decimal weight, rest timer + Live Activity, history editing, stats, volume screen, backup/restore

## Security
- No auth; `x-user-id` header identifies the user. Secrets in `.env`; `MONGODB_URI` required; `PORT` defaults to `4000`. Helmet, CORS (`ALLOWED_ORIGIN`), rate limiting and zod validation live in `server/src/index.ts` / `validation/schemas.ts`.

## When `AGENTS.md` Must Be Updated
- Route structure or stack layout
- Store ownership or source of truth
- Database schema, persistence keys, migrations
- Backup flow or server endpoints
- Core commands, seed scripts, dev workflow
- Update as part of the same change; no later cleanup

## Agent Roles
- **Orchestrator**: Coordination/decisions; CANNOT edit files directly
- **Coder**: Implements only, no follow-up requests
- **Explorer**: Read-only research
- **Reviewer**: Reviews only when requested
- **Scribe**: Documentation only when requested
- **Researcher**: External research only
- Only orchestrator decides next steps. Subagents execute and report.

IF UNSURE THEN ASK. NEVER ASSUME.
FONTS ARE ALREADY CORRECT WITH SPACEMONO AND VIGA. DO NOT CHANGE.
