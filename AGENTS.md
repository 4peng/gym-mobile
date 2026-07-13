# Repository Guidelines

## Purpose
Expo Router workout tracker with Express + Mongo backend. Core: routine creation, live workouts, history, offline sync.

## Project Structure
- `app/`: Expo Router routes
- `src/screens/`: Screen implementations
- `src/components/`: Reusable UI
- `src/stores/`: Zustand stores
- `src/storage/`: Persistence helpers
- `src/lib/api/`: API client, sync, converters
- `src/utils/`: Shared helpers
- `src/widgets/`: Expo widgets/Live Activities
- `src/constants/`, `src/data/`: Constants and exercise catalog
- `shared/`: Cross-boundary JS helpers
- `server/`: Express + TypeScript backend

## Route Map
- `app/index.tsx` → redirect
- `app/programs/index.tsx` → programs list
- `app/programs/create.tsx` → create routine
- `app/programs/[id].tsx` → edit routine
- `app/workout/index.tsx` → live workout
- `app/history/index.tsx` → history
- `app/stats/index.tsx` → stats
- `app/exercises/[name]/volume.tsx` → exercise volume
- `app/settings/index.tsx` → settings
- `app/mock-data.tsx` → mock data
- `app/_layout.tsx` → root stack
- `app/programs/_layout.tsx` → programs stack

## Screen/Component/State Ownership
- `ProgramsListScreen`: home/dashboard
- `ProgramEditorScreen`: routine create/edit
- `CreateProgramScreen`, `EditProgramScreen`: wrappers to `ProgramEditorScreen`
- `WorkoutSessionScreen`: live session
- `WorkoutHistoryScreen`: history list
- `ExerciseListStatsScreen`: exercise index
- `ExerciseVolumeScreen`: exercise stats
- `SettingsScreen`: settings
- `RoutineEditorScreen.tsx`: routine form UI
- `ExerciseEditor.tsx`: exercise row editor
- `ExercisePickerModal.tsx`/`ExercisePickerField.tsx`: exercise picker
- `ActivityComboChart.tsx`: activity chart
- `MuscleSelector.tsx`: muscle picker
- `ExerciseTrackingModeSelector.tsx`: tracking mode switch
- `FloatingRestTimer.tsx`, `LiveWorkoutTimer.tsx`, `RestTimerPicker.tsx`: timers
- `RestTimerLiveActivity.tsx`: iOS Live Activity
- `ProgramTile.tsx`: program card
- `Swipeable.tsx`: swipe actions
- `SetRow.tsx`, `ExerciseCard.tsx`: live-workout components
- `workoutSessionStore.ts`: workout state, history, sync metadata
- `activeSessionStore.ts`, `workoutHistoryStore.ts`: selector wrappers
- `programStore.ts`: program state, tombstones
- `exerciseLibraryStore.ts`: custom exercises
- `uiPreferencesStore.ts`: UI preferences
- `syncStore.ts`, `syncEffect.ts`: sync actions and triggers

## Persistence & Sync
- `zustandAsyncStorage` (AsyncStorage adapter in `src/storage/mmkv.ts`) for persisted stores
- Workouts sharded in `workoutStorage.ts`, recent in `workoutSessionStore`
- `src/lib/api/sync.ts`: offline-first sync (push dirty → fetch deltas → merge via `updatedAt` → respect `deletedAt`)
- `networkListener.ts` triggers sync on reconnect
- `forceResync()` clears app keys, reloads from server

## Data Invariants
- `updatedAt` is conflict-resolution field; `deletedAt` is tombstone flag
- History: `history` (cache), `historyIndex` (IDs), `workoutStorage` (shards)
- Bodyweight analytics use `uiPreferencesStore` preference
- Normalize `ProgramExercise`/`WorkoutExercise` via `shared/programs.js`
- Exercise identity: prefer `exerciseDefinitionId`, fallback to canonical name
- Tracking modes: `strength`, `timed`, `cardio`
- Custom exercise IDs: `custom-` prefix; propagate renames globally

## API & Backend
- Mobile API: `src/lib/api/programs.ts`, `workouts.ts`, `converters.ts`
- Server: `server/src/index.ts`, routes (`programs.ts`, `workouts.ts`), models (`Program.ts`, `Workout.ts`)
- Seeds: `seed:year`, `seed:4day-split` (with `:remove` variants)

## Build Commands
- `npm install`: install dependencies
- `npm run dev`: start Expo
- `npm run ios`: iOS Simulator
- `npx tsc --noEmit --pretty false --incremental false`: type check
- `cd server && npm install && npm run dev`: backend local
- `cd server && npm run build && npm start`: backend prod
- `cd server && npm run seed:year` / `seed:4day-split`: seed data

## Coding Style
- TypeScript strict, 2-space indent
- PascalCase: components/screens; camelCase: stores/utils
- Prefer `@/` imports; thin routes; reuse selector-wrapper stores
- Use shared normalization helpers; keep `_layout.tsx` aligned with routes

## Engineering Standards
- **Primitive Rule**: Selectors return primitives via `useShallow`; no inline `.map()`/`{...}`
- **JSX Sanitization**: Minified JSX for HUDs; wrap dynamic strings in `<Text>`
- **Native Modal Prohibition**: Use absolute `View` + `Animated.timing` (180ms, `useNativeDriver`)
- **Backend Set Types**: `enum: ['working', 'warmup', 'dropset']`
- **Session Continuity**: Persist `activeExerciseId` via the persisted store (AsyncStorage)

## Testing Guidelines
- No automated tests; rely on type checks + manual QA
- Routine: create, edit, save, delete, muscle picker, set/rest controls
- Workout: quick-start, start-from-routine, finish, decimal weight, rest timer
- History/Stats: pagination, pull-to-refresh, stats list, volume hydration, muscle edits, sync validation

## Security
- No auth required; secrets in `.env`; `MONGODB_URI` required; `PORT` defaults to `4000`

## When `AGENTS.md` Must Be Updated
- Route structure or stack layout
- Store ownership or source of truth
- Persistence keys, shard strategy, force-resync
- Sync flow, merge rules, tombstones
- Core commands, seed scripts, dev workflow
- Major feature ownership changes
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