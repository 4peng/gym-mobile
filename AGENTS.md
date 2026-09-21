# Repository Guidelines

## Purpose
Expo Router workout tracker (iOS only) with an Express + Mongo backend. Core: routine creation, live workouts, history, offline sync.

## Project Structure
- `app/`: Expo Router routes (thin: each renders one screen)
- `src/screens/`: Screen implementations
- `src/components/`: Reusable UI (`Workout/` live-workout pieces, `Workout/HUD/` session HUD, `Home/` dashboard chart)
- `src/hooks/`: `useSheet` / `useDragToClose` (sheet mount + animation plumbing)
- `src/stores/`: Zustand stores
- `src/storage/`: AsyncStorage adapter + workout shards
- `src/lib/api/`: API client, sync engine, converters
- `src/utils/`: Shared helpers
- `src/widgets/`: iOS Live Activity
- `src/constants/`, `src/data/`: Constants and exercise catalog
- `shared/`: JS helpers used by app and (contractually) server: `programs.js`, `muscles.js` with `.d.ts`
- `server/`: Express + TypeScript backend

## Route Map
- `app/index.tsx` → redirect (`/workout` if a session is active, else `/programs/`)
- `app/programs/index.tsx` → programs list (home)
- `app/programs/create.tsx` → `ProgramEditorScreen variant="create"`
- `app/programs/[id].tsx` → `ProgramEditorScreen variant="edit"`
- `app/workout/index.tsx` → live workout
- `app/history/index.tsx` → history
- `app/stats/index.tsx` → exercise stats index
- `app/exercises/[name]/volume.tsx` → exercise volume
- `app/settings/index.tsx` → settings
- `app/mock-data.tsx` → dev-only history injector (`__DEV__`, no in-app navigation to it)
- `app/_layout.tsx` → root stack; `app/programs/_layout.tsx` → programs stack. Routes auto-register; only list a `Stack.Screen` when it needs options.

## Screen / Component / State Ownership
- `ProgramsListScreen`: dashboard + routine list (`ProgramTile`, `ActivityComboChart`)
- `ProgramEditorScreen`: create/edit wrapper over `RoutineEditorScreen` (form UI) + `ExerciseEditor` rows
- `WorkoutSessionScreen`: live session; `ExerciseCard` → `SetRow`, `ExerciseHistoryGraph`; HUD in `Workout/HUD/`; `ExerciseNavMenu`, `ExerciseReorderModal`
- `WorkoutHistoryScreen`, `ExerciseListStatsScreen`, `ExerciseVolumeScreen`, `SettingsScreen`
- Sheets/pickers: `ExercisePickerModal`, `MuscleSelector` (controlled: `visible`/`onClose`), `RestTimerPicker`, `ExerciseTrackingModeSelector`. All use `useSheet`.
- Shared bits: `EditableSetTag` (tap-to-edit weight×reps chip), `SetTypeLegend`, `Swipeable`, timers (`FloatingRestTimer`, `LiveRestTimer`, `LiveWorkoutTimer`), `RestTimerLiveActivity` (iOS Live Activity)
- `workoutSessionStore.ts`: active session, history cache/index, rest timer, sync metadata. `rewriteExerciseRefs()` is the single path for propagating exercise edits (muscles, renames, removals) across RAM history, active session and disk shards.
- `programStore.ts`: programs, per-item dirty tracking (`dirtyProgramIds`), tombstones; `rewriteProgramExerciseRefs()` for exercise-definition propagation
- `exerciseLibraryStore.ts`: custom exercises (local-only)
- `uiPreferencesStore.ts`: UI preferences (detailed muscles, bodyweight, preferred unit)
- `syncStore.ts` (sync actions, `forceResync`), `syncEffect.ts` (debounced background sync on dirty), `networkListener.ts` (sync on reconnect)
- Screens read the store directly with `useShallow`; there are no selector-wrapper store files.

## Persistence & Sync
- `zustandAsyncStorage` (`src/storage/mmkv.ts`, historically named; it is AsyncStorage with per-key debounced writes flushed on background) backs every persisted store
- Workouts are sharded one key per session in `workoutStorage.ts`; `normalizePersistedWorkoutSession` there is the one normalizer for shards and store rehydrate. Recent sessions are cached in `workoutSessionStore.history` (capped), all ids in `historyIndex`.
- `src/lib/api/sync.ts`: offline-first (push tombstones via one `DELETE /batch` per collection → push dirty via `PUT /batch` → fetch deltas → merge by `updatedAt`). Programs push by `dirtyProgramIds`, workouts by `dirtyWorkoutIds` (per-item, never a timestamp watermark).
- `forceResync()` clears server-backed keys (`program-store`, `workout-session-store`, `workout_*`, legacy `workout-stats-index-v1`) and reloads; custom exercises and pinned exercises survive.

## Data Invariants
- `updatedAt` resolves conflicts; `deletedAt` is the tombstone flag
- Normalize `ProgramExercise`/`WorkoutExercise` via `shared/programs.js` (`normalizeExercise`, `normalizeSets`, `normalizeTrackingMode`, `NEXT_SET_TYPE`); server schemas mirror it
- Exercise identity: prefer `exerciseDefinitionId`, fall back to canonical name (`utils/exerciseIdentity.ts`)
- Tracking modes: `strength`, `timed`, `cardio`. Set types: `working`, `warmup`, `dropset` (`SET_TYPE_COLORS` in `constants/colors.ts`)
- Custom exercise ids: `custom-` prefix; renames/removals propagate through both stores' `*ExerciseDefinitionReferences` actions
- Custom and pinned exercises are local-only; never wiped by sync or `forceResync`
- `defaultSets` is a set-type template array; legacy numeric counts are backfilled to at least one working set

## API & Backend
- Mobile: `src/lib/api/programs.ts`, `workouts.ts` expose only `fetch*`, `batchUpsert*`, `batchDelete*`; `converters.ts` maps server ↔ client
- Server: `server/src/index.ts` wires two collections through `makeSyncService(Model, sort)` (`services/syncService.ts`) and `makeSyncRouter(service, schema, key)` (`routes/syncRouter.ts`). Endpoints per collection: `GET /?userId&since&limit&skip`, `PUT /batch`, `DELETE /batch` (soft delete; `x-user-id` header). Validation: `validation/schemas.ts` (zod). Models infer types from their schemas.
- Every write sets `updatedAt` explicitly; there are no Mongoose hooks. Stale incoming writes (older `updatedAt`) are ignored.
- Seeds: `seed:year`, `seed:4day-split` (+ `:remove`); dev tools: `db:clear`, `db:diag`

## Build Commands
- `npm install`; `npm run dev` (Expo); `npm run ios`
- `npm run typecheck`, `npm run lint`, `npm run format` / `format:check` (app, shared and server), `npm test` (Jest, `jest-expo`)
- `cd server && npm install && npm run dev`; `npm run build && npm start`

## CI
- `.github/workflows/ci.yml`: every push/PR runs `lint`, `format:check`, `typecheck`, server `tsc --noEmit`, `test`; steps use `if: !cancelled()` so one run reports every failure
- `.github/workflows/ios-build.yml`: IPA build + release on `main` only. Not a gate.
- Root `tsconfig.json` covers `app/` and `src/`; `server/` has its own tsconfig; `shared/` is typed by its `.d.ts` files

## Coding Style
- TypeScript strict, Prettier (100 cols, double quotes, trailing commas). Prettier is the formatting authority; do not hand-minify JSX.
- PascalCase components/screens, camelCase stores/utils; prefer `@/` imports; thin routes
- iOS only: no `Platform.OS` branches for Android or web, no `BackHandler`, no web fallbacks
- Reuse before writing: check `src/utils/`, `src/hooks/`, `shared/` and `constants/` first

## Engineering Standards
- **Primitive Rule**: selectors return primitives or `useShallow`-wrapped arrays/objects; no inline object creation in a selector
- **Wrap dynamic strings in `<Text>`**
- **No native Modal**: overlays are absolute `View`s driven by `useSheet(visible)` (180ms `Animated.timing`, `useNativeDriver`); add `useDragToClose` for swipe-down dismissal
- **Backend set types**: `enum: ['working', 'warmup', 'dropset']`
- **Session continuity**: `activeExerciseId` is persisted with the session store

## Testing
- Jest (`jest-expo`) suites live in `__tests__/` next to the code: stores, sync engine, network listener, storage, shared normalizers, utils. Run `npm test`.
- Manual QA still covers UI: routine create/edit/save/delete, muscle picker, set/rest controls, quick-start, start-from-routine, finish, decimal weight, rest timer, history pagination, pull-to-refresh, stats, volume hydration

## Security
- No auth; `x-user-id` header identifies the user. Secrets in `.env`; `MONGODB_URI` required; `PORT` defaults to `4000`. Helmet, CORS (`ALLOWED_ORIGIN`), rate limiting and zod validation are in `server/src/index.ts` / `validation/schemas.ts`.

## When `AGENTS.md` Must Be Updated
- Route structure or stack layout
- Store ownership or source of truth
- Persistence keys, shard strategy, force-resync
- Sync flow, merge rules, tombstones, server endpoints
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
