# Repository Guidelines

## Purpose
- This is an Expo Router mobile workout tracker with an Express + Mongo backend.
- The core product areas are:
- Routine/program creation and editing.
- Live workout execution.
- Workout history and exercise-volume trends.
- Offline-first persistence and background sync.

## Project Structure & Module Organization
- `app/`: Expo Router route entry files and stack layout files.
- `src/screens/`: Route-level screen implementations. Route files in `app/` are mostly thin wrappers around these screens.
- `src/components/`: Reusable UI primitives and feature components.
- `src/components/Workout/`: Live-workout-specific UI such as `ExerciseCard`, `SetRow`, and reorder modal.
- `src/stores/`: Zustand state containers plus selector-wrapper stores.
- `src/storage/`: AsyncStorage/MMKV-backed persistence helpers.
- `src/lib/api/`: API client, server converters, sync engine, and connectivity listener.
- `src/utils/`: shared helpers for IDs, navigation, placeholders, tracking-mode normalization, notifications, and formatting.
- `src/utils/activitySummary.ts`: shared home/dashboard activity bucketing, range labeling, and duration formatting helpers.
- `src/utils/restTimerLiveActivity.ts`: guarded bridge for starting, updating, and ending the iOS rest-timer Live Activity from canonical workout state.
- `src/utils/exerciseIdentity.ts`: canonical exercise identity/search normalization. Keep analytics/search consistency changes here, not scattered across screens.
- `src/widgets/`: Expo widget and Live Activity layouts. These files are native-build surfaces and must remain compatible with `expo-widgets`.
- `src/constants/`: design constants and shared domain constants.
- `src/data/`: bundled exercise catalog data.
- `shared/`: JS helpers shared across app/tooling boundaries. `shared/programs.js` is the main routine normalization boundary.
- `server/`: Express + TypeScript backend.
- `server/src/models/`: Mongoose models.
- `server/src/routes/`: REST endpoints for programs and workouts.
- `server/scripts/`: seed and cleanup scripts for local/demo data.

## Route Map
- `app/index.tsx`: redirects to `/workout` when an active session exists, otherwise `/programs/`.
- `app/programs/index.tsx`: routines/program list.
- `app/programs/create.tsx`: create routine flow.
- `app/programs/[id].tsx`: edit an existing routine.
- `app/workout/index.tsx`: live workout session screen.
- `app/history/index.tsx`: workout history list and inline history editing.
- `app/stats/index.tsx`: exercise stats list.
- `app/exercises/[name]/volume.tsx`: exercise volume/details modal screen.
- `app/settings/index.tsx`: settings and maintenance actions.
- `app/mock-data.tsx`: local/dev helper route for mock data.
- `app/_layout.tsx`: root navigation stack. Keep it aligned with actual route files.
- `app/programs/_layout.tsx`: nested programs stack.

## Screen Ownership
- `ProgramsListScreen`: home/dashboard, active session resume, quick-start, routine launch.
- `ProgramEditorScreen`: canonical route-level controller for create, duplicate, and edit routine flows. Owns store orchestration, save/delete/start branching, and not-found handling.
- `CreateProgramScreen`: thin wrapper that routes the create flow into `ProgramEditorScreen`.
- `EditProgramScreen`: thin wrapper that routes the edit flow into `ProgramEditorScreen`.
- `WorkoutSessionScreen`: live session flow, finish flow, save-as-routine flow for quick sessions.
- `WorkoutHistoryScreen`: paginated history list, inline set/date edits, pull-to-refresh.
- `ExerciseListStatsScreen`: searchable/pinnable exercise index.
- `ExerciseVolumeScreen`: per-exercise history hydration, charting, muscle-category editing, inline set edits.
- `SettingsScreen`: sync/reset and app-level preferences.

## Component Ownership
- `RoutineEditorScreen.tsx`: canonical UI for create/edit routine flows. Prefer extending this instead of duplicating routine form logic.
- `ExerciseEditor.tsx`: routine-exercise row editor used by routine editing flows.
- `ExercisePickerModal.tsx` and `ExercisePickerField.tsx`: exercise selection UI.
- `src/components/Home/ActivityComboChart.tsx`: canonical home/dashboard activity chart renderer. Keep dashboard chart treatment changes here instead of reimplementing chart markup in screens.
- `MuscleSelector.tsx`: shared muscle/category picker used across routine, workout, and stats flows.
- `ExerciseTrackingModeSelector.tsx`: switching between `strength`, `timed`, and `cardio`.
- `FloatingRestTimer.tsx`, `LiveWorkoutTimer.tsx`, `RestTimerPicker.tsx`: workout timer UI.
- `src/widgets/RestTimerLiveActivity.tsx`: iOS Lock Screen / Dynamic Island rest-timer layout. Keep Live Activity visual/state changes here, and keep lifecycle wiring in `src/utils/restTimerLiveActivity.ts`.
- `ProgramTile.tsx`: routine card in the programs list.
- `Swipeable.tsx`: shared swipe actions in history/stats lists.
- `src/components/Workout/SetRow.tsx`: canonical live-workout set input row. If weight/reps input behavior changes, change it here first.
- `src/components/Workout/ExerciseCard.tsx`: canonical live-workout exercise card.

## State Ownership
- `src/stores/workoutSessionStore.ts`: canonical workout state.
- Responsibilities:
- Active session lifecycle.
- Live set/exercise updates.
- History cache and history index.
- Dirty/deleted workout sync metadata.
- Rest timer state.
- Pinned exercise names.
- Shard merge logic and sync merge logic.
- `src/stores/activeSessionStore.ts`: selector wrapper for active session reads/writes.
- `src/stores/workoutHistoryStore.ts`: selector wrapper for workout history reads/writes.
- `src/stores/programStore.ts`: canonical routine/program state, pinning, tombstones, and program sync metadata.
- `src/stores/exerciseLibraryStore.ts`: custom exercise definitions and muscle metadata for custom exercises.
- Custom exercise renames must propagate through routines, active sessions, and history so typo fixes are global rather than local-only.
- `src/stores/uiPreferencesStore.ts`: UI-only preferences such as detailed muscle-group mode and analytics bodyweight settings.
- `src/stores/syncStore.ts`: user-facing sync actions and force-resync behavior.
- `src/stores/syncEffect.ts`: background sync trigger wiring based on dirty state.

## Persistence & Sync Architecture
- `zustandAsyncStorage` in `src/storage/mmkv.ts` is the persistence backend used by persisted stores.
- `workoutSessionStore` keeps only recent history plus metadata in the main persisted store; full workouts are sharded in `src/storage/workoutStorage.ts`.
- `src/storage/workoutStorage.ts` stores workouts as individual AsyncStorage keys prefixed with `workout_`.
- `src/storage/workoutStatsStorage.ts` maintains a derived stats index keyed by `WORKOUT_STATS_KEY`.
- Bodyweight exercise analytics now depend on the persisted analytics bodyweight preference in `uiPreferencesStore`.
- `src/lib/api/sync.ts` is the offline-first sync engine.
- Sync model:
- Push dirty local programs/workouts.
- Fetch remote deltas.
- Merge via last-write-wins using `updatedAt`.
- Respect tombstones via `deletedAt`.
- `src/lib/api/networkListener.ts` triggers sync when connectivity returns.
- `src/stores/syncStore.ts` `forceResync()` clears only app-owned keys, then reloads from server.

## Important Data Invariants
- `updatedAt` is the conflict-resolution field for both programs and workouts. Do not bypass it when mutating synced entities.
- `deletedAt` is a tombstone flag. Deletions are soft until sync cleanup completes.
- Workout history is split between:
- `history`: recent in-memory cache.
- `historyIndex`: global ID index.
- `workoutStorage`: shard backing store for full history.
- When editing data that can appear on old history screens, charts, or stats views, consider both in-memory history and shard-only sessions.
- Bodyweight strength analytics are not inferred from user identity or health APIs; they rely on the manually entered analytics bodyweight in Settings.
- For bodyweight strength exercises, analytics treat logged weight as additional external load on top of the saved analytics bodyweight baseline.
- `ProgramExercise` and `WorkoutExercise` should stay normalized through shared helpers in `shared/programs.js` and `src/utils/exerciseTracking.ts`.
- Exercise identity for analytics/search should prefer `exerciseDefinitionId` and fall back through canonicalized name matching. Avoid adding one-off string comparisons in screens.
- Tracking modes are `strength`, `timed`, and `cardio`. Set fields must remain compatible with the selected tracking mode.
- Custom exercise IDs are prefixed with `custom-`. If muscle metadata changes for custom exercises, keep `exerciseLibraryStore` and workout history in sync.

## API & Backend Notes
- Mobile API surface lives in:
- `src/lib/api/programs.ts`
- `src/lib/api/workouts.ts`
- `src/lib/api/converters.ts`
- Server entrypoint: `server/src/index.ts`.
- Main server routes:
- `server/src/routes/programs.ts`
- `server/src/routes/workouts.ts`
- Main server models:
- `server/src/models/Program.ts`
- `server/src/models/Workout.ts`
- Backend seeds:
- `npm run seed:year` / `seed:year:remove`
- `npm run seed:4day-split` / `seed:4day-split:remove`

## Build, Test, and Development Commands
- `npm install`: install mobile app dependencies.
- `npm run dev`: start Expo dev server.
- `npm run ios`: launch iOS Simulator (runs `expo start --ios`).
- `npm run routine-web`: launch the Routine Lab helper script.
- `npx tsc --noEmit --pretty false --incremental false`: strict app type check. No ESLint or Prettier configured.
- iOS Live Activities use `expo-widgets` and require a native/development build. They do not run in Expo Go.
- `cd server && npm install && npm run dev`: run backend locally.
- `cd server && npm run build && npm start`: build and run backend.
- `cd server && npm run seed:year`: seed year-long demo data.
- `cd server && npm run seed:4day-split`: seed 4-day split demo data.

## Coding Style & Naming Conventions
- TypeScript with strict mode; keep 2-space indentation.
- Use PascalCase for React components/screens and camelCase for stores/util files.
- Prefer `@/` path alias imports over deep relative paths.
- Keep route files thin when possible; place logic in `src/screens/` and reusable UI in `src/components/`.
- Reuse selector-wrapper stores (`activeSessionStore`, `workoutHistoryStore`) instead of scattering direct selectors in unrelated files.
- Prefer shared normalization helpers over duplicating program/workout sanitization logic.
- Keep Expo Router stack declarations aligned with actual route files. If a route file is added, removed, or renamed, update the relevant `_layout.tsx` in the same change.

## Engineering Standards (State & Performance)
- **The Primitive Rule**: Selectors must return primitive values or arrays of primitives wrapped in `useShallow`. Creating new objects `{...}` or running `.map()` directly inside a selector causes "Maximum update depth" errors.
- **JSX Sanitization**: Use "Minified JSX" (zero whitespace between component tags) for HUD components to prevent raw text node crashes on iOS. Dynamic strings must be strictly wrapped in `<Text>`.
- **Native Modal Prohibition**: Native `<Modal>` is prohibited for session HUDs. Use absolute-positioned `View`s with snappy `Animated.timing` (180ms) and `useNativeDriver: true`.
- **Backend Set Types**: Mongoose `WorkoutSetSchema` includes `type` field: `enum: ['working', 'warmup', 'dropset']`.
- **Session Continuity**: `activeExerciseId` must be persisted in MMKV for session continuity on app relaunch.

## Testing Guidelines
- Automated tests are not configured yet; rely on type checks and focused manual QA.
- Minimum checks for routine-related changes:
- Create routine flow.
- Edit routine flow.
- Save routine and save+start flow.
- Delete routine flow.
- Muscle picker and set/rest controls.
- Minimum checks for workout-related changes:
- Quick-start empty workout flow.
- Start-from-routine flow.
- Finish workout flow, including save-as-routine behavior.
- Decimal weight entry on live workout inputs and history-edit flows.
- Rest timer behavior when completing sets.
- Minimum checks for history/stats changes:
- History pagination.
- Pull-to-refresh sync.
- Exercise stats list.
- `exercises/[name]/volume` hydration for older shard-backed sessions.
- Muscle-category edits propagating to history/stats/trends.
- Validate sync-sensitive changes by confirming history/stats still update after save/edit/delete.

## Security & Configuration Tips
- No end-user auth is required in the current app mode; do not add auth dependencies unless explicitly requested.
- Keep runtime config behavior unchanged unless explicitly requested.
- Keep secrets in `.env`.
- Backend requires `MONGODB_URI`.
- Backend `PORT` defaults to `4000`.

## When `AGENTS.md` Must Be Updated
- Update this file whenever any of the following change:
- Route structure or stack layout.
- Store ownership or the canonical source of truth for a domain.
- Persistence keys, shard strategy, or force-resync behavior.
- Sync flow, merge rules, or tombstone handling.
- Core commands, seed scripts, or local dev workflow.
- Major feature ownership moved between screens/components/stores.
- Treat `AGENTS.md` updates as part of the same change that introduced the architectural change.
- Do not leave this file for later cleanup if the codebase shape changed in the current task.
