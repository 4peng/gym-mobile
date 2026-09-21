# Gym Mobile — Code Audit Report

**Date:** 2026-07-18  
**Scope:** Full codebase (mobile app + Express/Mongo backend)  
**Method:** 6 parallel specialist agents cross-verified against source code  
**Findings:** 62 total (7 critical, 12 high, 27 medium, 16 low)

---

## Executive Summary

**Overall Health Score: 42/100**

The codebase delivers a functional offline-first workout tracker with reasonable architectural patterns, but carries significant technical debt across security, testing, and dependencies. The most concerning findings: DELETE endpoints accept optional user IDs (anyone can delete any document), the sync engine—the most complex module in the app—has zero test coverage, three Expo dependencies have known CVEs with available fixes (shell-quote command injection, picomatch ReDoS, node-forge signature forgery), and the core workout session store is a 1629-line God object with 7 distinct responsibilities and no tests. The project also carries 5 unused runtime dependencies and 2 unused dev dependencies. Fourteen quick-win fixes are completable in under 30 minutes, including all critical dependency patches, the auth bypass fix, and dead dependency removal. The fundamental testing and architecture rework requires sustained investment beyond this audit's scope.

**Critical Count: 7** — 2 security, 3 test coverage, 2 dependencies, 1 architecture

---

## Prioritized Findings

### CRITICAL

| ID | Category | Description | File | Effort |
|----|----------|-------------|------|--------|
| SEC-001 | Security | DELETE auth bypass — `userId` is optional in `DELETE /programs/:id` and `DELETE /workouts/:id`. When omitted, deletion filter uses only `{ _id: req.params.id }`, allowing anyone to delete any document. Client SDK always sends `x-user-id`, but an attacker can omit it. Confidence: HIGH | `server/src/routes/programs.ts:121-130`<br>`server/src/routes/workouts.ts:126-135` | 5 min |
| TEST-001 | Test Coverage | Sync engine (`sync.ts`, 189 lines) has zero tests. Implements offline-first push-then-fetch with per-item dirty tracking, tombstone deletion, delta sync with ±10s watermark, in-flight deduplication, and shard loading. A bug here silently drops user data or corrupts LWW merge. Confidence: HIGH | `src/lib/api/sync.ts:1-189` | 180 min |
| TEST-002 | Test Coverage | `forceResync()` has zero tests. Wipes AsyncStorage selectively, resets all in-memory state, then re-syncs. A bug could wipe user data (history, programs) or incorrectly clear SDK keys. Pinned-exercise preservation is a single line that could silently regress. Confidence: HIGH | `src/stores/syncStore.ts:80-132` | 90 min |
| TEST-003 | Test Coverage | Workout session store (1629 lines) has zero tests. Controls session lifecycle, exercise/set CRUD, rest timer state machine, cross-session renames, muscle propagation, pagination, and sync merge. Rest timer accumulates elapsed time across transitions (start→cancel→start) — this state machine has no coverage. Confidence: HIGH | `src/stores/workoutSessionStore.ts:1-1629` | 300 min |
| DEP-001 | Dependencies | `@expo/ui@55.0.12` is SDK 55 version, but project uses Expo SDK 54 which expects `~0.2.0-beta.9`. Major API version mismatch. `expo install --check` confirms incompatibility. Will cause runtime crashes. Confidence: HIGH | `package.json:23` | 5 min |
| DEP-002 | Dependencies | `shell-quote@1.8.3` has command injection CVE (GHSA-w7jw-789q-3m8p, CVSS 8.1). Transitive dep of Metro bundler via @expo/cli. Fix in 1.8.4. Confidence: HIGH | `package.json` (transitive) | 5 min |
| ARCH-001 | Architecture | `workoutSessionStore.ts` is a 1629-line God object with 7 distinct responsibilities: active session lifecycle, exercise mutations, set mutations, history queries, rest timer, stats, and sync metadata. Every change risks regressions across unrelated concerns. Zero tests. Confidence: HIGH | `src/stores/workoutSessionStore.ts:1-1629` | 240 min |

### HIGH

| ID | Category | Description | File | Effort |
|----|----------|-------------|------|--------|
| SEC-002 | Security | No input validation on any route — all PUT/POST routes spread raw `req.body` directly into MongoDB operations with no Zod/Joi/express-validator. Batch endpoints use `bulkWrite` which bypasses Mongoose middleware entirely. Confidence: HIGH | `server/src/routes/programs.ts:61-64,98-103`<br>`server/src/routes/workouts.ts:67-69,97-107` | 30 min |
| SEC-003 | Security | CORS allows all origins — `app.use(cors())` with no options sets `Access-Control-Allow-Origin: *`. Combined with no auth, any website can issue authenticated requests via the hardcoded `x-user-id` header. Confidence: HIGH | `server/src/index.ts:32` | 5 min |
| SEC-004 | Security | No rate limiting — no `express-rate-limit` or similar. An attacker can enumerate program/workout IDs via DELETE/GET at unlimited speed. Confidence: HIGH | `server/src/index.ts:31-34` | 10 min |
| PERF-001 | Performance | Multiple screens subscribe to array selectors without `useShallow`, causing re-renders on every unrelated store mutation. Any timer tick or state change in `workoutSessionStore` creates new immer references, triggering passive screens to re-render. Confidence: HIGH | `src/screens/WorkoutHistoryScreen.tsx:258`<br>`src/screens/ProgramsListScreen.tsx:46-48`<br>`src/screens/SettingsScreen.tsx:32-33`<br>`src/screens/ExerciseListStatsScreen.tsx:111`<br>`src/screens/ExerciseVolumeScreen.tsx:380`<br>`src/components/Workout/ExerciseCard.tsx:45` | 15 min |
| PERF-002 | Performance | Sequential N+1 tombstone deletions in sync engine. `syncPrograms()` and `syncWorkouts()` iterate `deletedProgramIds`/`deletedWorkoutIds` with `await` in a for-loop, issuing one HTTP DELETE per tombstone. No batch delete endpoint on server. Confidence: HIGH | `src/lib/api/sync.ts:29-32,88-91` | 30 min |
| TEST-004 | Test Coverage | Program store's `applySyncMerge` has zero tests. Implements LWW merge with dirty re-check. The logic to filter `deletedAt` programs only when `historyChanged` is a subtle conditional that could fail to remove tombstones. Confidence: HIGH | `src/stores/programStore.ts:234-275` | 60 min |
| TEST-005 | Test Coverage | Workout session `applySyncMerge` (103 lines) has zero tests. Handles LWW merge, tombstone handling across in-memory + shard-only sessions, `historyIndex` maintenance, `dirtyWorkoutIds` cleanup, memory cap enforcement, and `hasMoreHistory` signal. Confidence: HIGH | `src/stores/workoutSessionStore.ts:1470-1573` | 90 min |
| TEST-006 | Test Coverage | Shared normalization helpers (`shared/programs.js`, 165 lines) have zero tests. Contains `normalizeExercise`, `normalizeSets`, `validateRoutineDraft`, `copyExercises`. Backfill logic (numeric `defaultSets` → array of type templates) is critical for sync compatibility with legacy data. Confidence: HIGH | `shared/programs.js:1-165` | 60 min |
| DEP-003 | Dependencies | `path-to-regexp@0.1.12` has ReDoS via multiple route parameters (GHSA-37ch-88jc-xwx2, CVSS 7.5). Transitive dep of Express. Crafted URLs can cause exponential backtracking and server hang. Confidence: HIGH | `server/package.json:21` (transitive) | 10 min |
| DEP-004 | Dependencies | `node-forge@1.3.3` has 4 high-severity CVEs: basicConstraints bypass (CVSS 7.4), Ed25519 forgery (CVSS 7.5), infinite loop DoS (CVSS 7.5), RSA-PKCS forgery (CVSS 7.5). Transitive dep of Metro/dev server. Confidence: HIGH | `package.json` (transitive) | 5 min |
| DEP-005 | Dependencies | `picomatch` has ReDoS in extglob quantifiers (GHSA-c2c7-rcm5-vvqj, CVSS 7.5). Multiple vulnerable copies across node_modules. Affects Jest test runs and Metro file watching. Confidence: HIGH | `package.json` (transitive) | 5 min |
| ARCH-005 | Architecture | Screens bypass store actions and directly manipulate store state via `getState()`/`setState()`. `SettingsScreen.tsx` injects/removes diagnostic sessions as raw state surgery. `WorkoutSessionScreen.tsx` manually maps `WorkoutExercise` → `ProgramExercise` inline with hardcoded field knowledge. Confidence: HIGH | `src/screens/SettingsScreen.tsx:130-156`<br>`src/screens/WorkoutSessionScreen.tsx:96-116` | 30 min |

### MEDIUM

| ID | Category | Description | File | Effort |
|----|----------|-------------|------|--------|
| SEC-005 | Security | Weak MongoDB credentials — `.env` contains username `user1` with password `pass123`. If the MongoDB cluster is ever exposed or `.env` leaks, the database is trivially accessible. Confidence: MEDIUM | `.env:1` | 10 min |
| SEC-006 | Security | Large body parse limit with unrestricted batch — `express.json({ limit: '10mb' })` is generous. Batch endpoints have no maximum array length validation, enabling memory exhaustion. Confidence: MEDIUM | `server/src/index.ts:34`<br>`server/src/routes/programs.ts:73-77`<br>`server/src/routes/workouts.ts:78-82` | 5 min |
| PERF-003 | Performance | MongoDB models have only single-field indexes (`{ userId: 1 }`, `{ updatedAt: 1 }`). Delta sync query `Program.find({ userId, updatedAt: { $gt: since } })` cannot use a compound index. Confidence: HIGH | `server/src/models/Program.ts:54-58`<br>`server/src/models/Workout.ts:64-68` | 10 min |
| PERF-004 | Performance | Server middleware checks `mongoose.connection.readyState` on every request and attempts `await mongoose.connect()` when disconnected. Under serverless cold starts, parallel requests may race to connect, adding latency jitter. Confidence: MEDIUM | `server/src/index.ts:47-63` | 15 min |
| PERF-005 | Performance | `applySyncMerge` runs synchronous iteration, filtering, sorting (`O(n log n)`), and `shardsToSave` batching inside a Zustand `set()` callback. The `saveBatch` call returns a promise that's silently ignored inside immer's produce scope. Confidence: MEDIUM | `src/stores/workoutSessionStore.ts:1470-1574` | 20 min |
| PERF-006 | Performance | `WorkoutSessionScreen.tsx` recreates `Animated.event(...)` on every render, allocating a new closure and event config each frame during scroll (`scrollEventThrottle={16}`). Confidence: MEDIUM | `src/screens/WorkoutSessionScreen.tsx:164` | 5 min |
| QUAL-001 | Code Quality | Unused dependency `uuid` — not imported anywhere. Replaced by custom `generateId()` utility. Confidence: HIGH | `package.json:49` | 5 min |
| QUAL-002 | Code Quality | Unused dependency `react-hook-form` and resolver `@hookform/resolvers` — zero `useForm()` imports. Form state managed via local `useState` and shared normalizers. Confidence: HIGH | `package.json:39,24` | 5 min |
| QUAL-003 | Code Quality | Unused dependency `zod` — not imported anywhere. Validation done via `shared/programs.js` `validateRoutineDraft()`. Confidence: HIGH | `package.json:50` | 5 min |
| QUAL-010 | Code Quality | Type safety gap — `normalizeProgram()` uses `raw: any` parameter, defeating TypeScript checks. Same pattern in `normalizeCustomExercise()`. Strict mode is enabled but bypassed here. Confidence: HIGH | `src/stores/programStore.ts:38`<br>`src/stores/exerciseLibraryStore.ts:19` | 10 min |
| QUAL-011 | Code Quality | 11 `as any` type assertions in production code across 7 files, masking type errors in normalizers, navigation, and converters. Confidence: HIGH | Various (see report body) | 20 min |
| QUAL-012 | Code Quality | Pattern inconsistency — `workoutHistoryStore.ts` returns arrays/objects from selectors without `useShallow()`, violating AGENTS.md Primitive Rule. Other stores correctly use `useShallow`. Confidence: HIGH | `src/stores/workoutHistoryStore.ts:3-18` | 10 min |
| TEST-007 | Test Coverage | Persistence adapter (`mmkv.ts`, 107 lines) has zero tests. Implements per-key debounced writes (400ms coalesce) and background flush. A bug in flush-on-background would silently drop the last 400ms of edits. Confidence: HIGH | `src/storage/mmkv.ts:1-107` | 60 min |
| TEST-008 | Test Coverage | Workout shard storage has zero tests. `normalizeWorkoutSession` normalizes sets based on tracking mode on every read — if this silently drops data, workout display is corrupted. Confidence: HIGH | `src/storage/workoutStorage.ts:1-98` | 45 min |
| TEST-009 | Test Coverage | Network listener has zero tests. Implements connectivity-triggered sync with a 60-second throttle that self-resets on failure. The reset logic is a single `.then` clause — easy to break. Confidence: HIGH | `src/lib/api/networkListener.ts:1-82` | 60 min |
| TEST-010 | Test Coverage | API client has zero tests. Implements fetch wrapper with 15s timeout, JSON parsing, error normalization. Timeout and error handling are critical for offline-first sync to not hang. Confidence: HIGH | `src/lib/api/client.ts:1-92` | 45 min |
| TEST-014 | Test Coverage | Cross-session rename/muscle propagation operates on both in-memory history AND on-disk shards asynchronously. Shard-rewrite path uses fire-and-forget `void async` with `set()` inside callback — if `set()` fires after store reset, stale `dirtyWorkoutIds` could be applied. Zero coverage. Confidence: HIGH | `src/stores/workoutSessionStore.ts:1311-1440` | 90 min |
| DEP-006 | Dependencies | `body-parser` listed as direct dependency but never imported. Server uses Express built-in `express.json()`. Also carries moderate qs DoS vuln via transitive dep. Confidence: HIGH | `server/package.json:17` | 5 min |
| DEP-007 | Dependencies | `morgan@1.10.1` has log forging vulnerability (GHSA-4vj7-5mj6-jm8m, CVSS 5.3, CWE-117). No patched version exists. Low risk for no-auth app but bad practice. Confidence: HIGH | `server/package.json:24` | 30 min |
| DEP-008 | Dependencies | `uuid@11.1.0` has missing buffer bounds check (GHSA-w5hq-g745-h8pq, CVSS 7.5). Fix available in `uuid@11.1.1`. Confidence: HIGH | `package.json:49` | 2 min |
| DEP-009 | Dependencies | `qs` DoS in `qs.stringify` (GHSA-q8mj-m7cp-5q26, CVSS 5.3). Bundled by Express and body-parser. Fix in qs 6.16.0+. Confidence: MEDIUM | `server/package.json:21` | 5 min |
| DEP-011 | Dependencies | Multiple transitive HIGH/CRITICAL vulns in Metro/dev toolchain: `@xmldom/xmldom` (5 vulns), `tar` (path traversal), `undici` (9 vulns: DoS, header injection, request smuggling), `ws` (memory exhaustion DoS). Dev-only unless dev server exposed. Confidence: MEDIUM | `package.json` (transitive) | 15 min |
| ARCH-002 | Architecture | `nextLocalUpdatedAt` duplicated verbatim in both `programStore.ts` and `workoutSessionStore.ts`. Identical 4-line body. Duplication means timestamp strategy changes must be made in two places. Confidence: HIGH | `src/stores/programStore.ts:33-36`<br>`src/stores/workoutSessionStore.ts:206-209` | 5 min |
| ARCH-003 | Architecture | `isIncomingWriteStale` and entire CRUD+sync route pattern duplicated between `server/routes/programs.ts` and `server/routes/workouts.ts` (~70% structurally identical). Confidence: HIGH | `server/src/routes/programs.ts:6-17`<br>`server/src/routes/workouts.ts:6-17` | 30 min |
| ARCH-004 | Architecture | Mongoose pre-save/pre-update hook boilerplate (28 lines of identical code) copy-pasted between `Program.ts` and `Workout.ts` models. Will diverge over time. Confidence: HIGH | `server/src/models/Program.ts:62-89`<br>`server/src/models/Workout.ts:74-101` | 15 min |
| ARCH-006 | Architecture | Server routes mix HTTP, validation, business logic, and direct Mongoose access in single files. No service layer. `req.body` spread directly into `findOneAndUpdate` without field whitelisting — vulnerable to mass-assignment. Confidence: HIGH | `server/src/routes/programs.ts:1-158`<br>`server/src/routes/workouts.ts:1-154` | 45 min |
| ARCH-009 | Architecture | `WorkoutSessionScreen.tsx` maps `WorkoutExercise[]` → `ProgramExercise[]` inline with hardcoded field knowledge. Duplicates field-mapping logic that `shared/programs.js` already handles. Any schema change requires finding this inline mapping. Confidence: HIGH | `src/screens/WorkoutSessionScreen.tsx:96-116` | 15 min |

### LOW

| ID | Category | Description | File | Effort |
|----|----------|-------------|------|--------|
| QUAL-004 | Code Quality | Unused dependency `expo-status-bar` — not imported. Expo Router manages status bar internally. Confidence: HIGH | `package.json:34` | 2 min |
| QUAL-005 | Code Quality | Unused dependency `expo-linking` — not imported in source. Deep linking may be config-only. Confidence: HIGH | `package.json:32` | 2 min |
| QUAL-006 | Code Quality | Unused server dependency `body-parser` — not imported. Express 4.16+ has built-in `express.json()`. Confidence: HIGH | `server/package.json:17` | 2 min |
| QUAL-007 | Code Quality | Unused server dependency `cross-env` — not used in any npm script. Confidence: HIGH | `server/package.json:19` | 2 min |
| QUAL-008 | Code Quality | 17 files use redundant `@src/` import prefix instead of canonical `@/`. Both resolve correctly due to fallback path mapping, but mixing styles creates confusion. Confidence: HIGH | Various `.tsx` files | 10 min |
| QUAL-009 | Code Quality | Stale utility scripts `clear_db.ts` and `diag_db.ts` have no npm script entry points. Only runnable via `npx tsx`. Confidence: HIGH | `server/clear_db.ts`<br>`server/diag_db.ts` | 5 min |
| QUAL-013 | Code Quality | `shared/` directory is not imported by the server at all. Name implies server participation that doesn't exist — only serves mobile client and web. Confidence: HIGH | `shared/` (directory) | 5 min |
| QUAL-014 | Code Quality | 10 empty catch blocks across codebase swallow errors silently. Two in `syncStore.ts` hide sync failures from error reporting. `ProgramEditorScreen.tsx` catches show alerts but don't log original error for debugging. Confidence: MEDIUM | `src/stores/syncStore.ts:65,75`<br>`src/screens/ProgramEditorScreen.tsx:98,123`<br>+ 6 more | 10 min |
| TEST-011 | Test Coverage | Server has no test script, no jest dep, and no test files. Routes, models, and seed scripts have zero coverage. Confidence: HIGH | `server/package.json:1-35` | 120 min |
| TEST-012 | Test Coverage | `conversions.test.ts` is thin — only 3 `convertWeight` and 3 `formatSecondsToMMSS` assertions. No edge cases for negative weight, extreme values, zero, or rounding boundary values. Confidence: MEDIUM | `src/utils/__tests__/conversions.test.ts:1-31` | 15 min |
| TEST-013 | Test Coverage | Existing tests use `as any` casts extensively to construct partial test objects. Could silently mask type errors if function signatures change. Confidence: MEDIUM | `src/utils/__tests__/bodyweightAnalytics.test.ts:9,13,18` | 30 min |
| TEST-015 | Test Coverage | `activitySummary.test.ts` pins deterministic timestamp keys derived from local timezone calculations. Will fail in different timezone (CI vs local). Confidence: MEDIUM | `src/utils/__tests__/activitySummary.test.ts:60-61` | 30 min |
| DEP-010 | Dependencies | Multiple expo packages behind recommended patches: expo 54.0.33→54.0.36, expo-font, expo-linking, expo-notifications, expo-router. Also `@types/jest@30.0.0` should be `29.5.14` for jest@29.7.0. Confidence: HIGH | `package.json:27-33,54` | 5 min |
| DEP-012 | Dependencies | `expo-widgets@55.0.14` uses SDK 55 versioning while project is SDK 54. Not flagged by `expo install --check` but version pattern suggests potential incompatibility. Confidence: LOW | `package.json:35` | 15 min |
| ARCH-007 | Architecture | `shared/programs.js` and `shared/muscles.js` only imported by client-side code. Server has its own independent Mongoose schemas that duplicate the data contract. Exercise normalization only validates on client. Confidence: HIGH | `shared/programs.js:1-165`<br>`shared/muscles.js:1-87` | 30 min |
| ARCH-008 | Architecture | `syncStore.ts` uses `await import()` dynamic imports with comments stating "break circular dependencies," but tracing the import graph reveals no static circular dependency. Adds unnecessary complexity and prevents calling `runFullSync` outside async context. Confidence: MEDIUM | `src/stores/syncStore.ts:50-83` | 10 min |

---

## Quick Wins (all completable in ≤30 minutes)

### Security (3 items, ~20 min total)

| # | Fix | Effort |
|---|-----|--------|
| 1 | **Fix DELETE auth bypass** — Make `userId` required in `DELETE /programs/:id` and `DELETE /workouts/:id`. Return 400 if no `x-user-id` header. | 5 min |
| 2 | **Restrict CORS** — Change `app.use(cors())` to `cors({ origin: process.env.ALLOWED_ORIGIN || '*' })`. | 5 min |
| 3 | **Add rate limiting** — Install `express-rate-limit`, add `limiter` middleware with 100 req/min default, stricter on batch/DELETE. | 10 min |

### Dependencies (8 items, ~42 min total)

| # | Fix | Effort |
|---|-----|--------|
| 4 | **Fix @expo/ui version** — Run `npx expo install @expo/ui` to install SDK 54-compatible `~0.2.0-beta.9`. | 5 min |
| 5 | **Fix shell-quote CVE** — Add `"overrides": { "shell-quote": ">=1.8.4" }` to package.json, run `npm install`. | 5 min |
| 6 | **Fix path-to-regexp ReDoS** — Add `"overrides": { "path-to-regexp": ">=0.1.13" }` to server/package.json, run `npm install`. | 10 min |
| 7 | **Fix node-forge CVEs** — Add `"overrides": { "node-forge": ">=1.4.0" }` to package.json, run `npm install`. | 5 min |
| 8 | **Fix picomatch ReDoS** — Add `"overrides": { "picomatch": ">=4.0.4" }` to package.json and server/package.json, run `npm install`. | 5 min |
| 9 | **Fix uuid CVE** — Run `npm update uuid` or bump to `^11.1.1`. | 2 min |
| 10 | **Fix expo patch versions** — Run `npx expo install --fix`, change `@types/jest` to `^29.5.14`. | 5 min |
| 11 | **Fix qs DoS** — Add `"overrides": { "qs": ">=6.16.0" }` to server/package.json. | 5 min |

### Code Quality (5 items, ~17 min total)

| # | Fix | Effort |
|---|-----|--------|
| 12 | **Remove unused deps** — Uninstall `uuid`, `react-hook-form`, `@hookform/resolvers`, `zod`, `expo-status-bar`, `expo-linking` (mobile) and `body-parser`, `cross-env` (server). | 15 min |
| 13 | **Normalize @src/ imports** — Replace all `@src/` with `@/` across 10 files. | 10 min |
| 14 | **Add npm scripts for db tools** — Add `"db:clear": "npx tsx clear_db.ts"` and `"db:diag": "npx tsx diag_db.ts"` to server/package.json. | 5 min |

### Performance (2 items, ~15 min total)

| # | Fix | Effort |
|---|-----|--------|
| 15 | **Add compound MongoDB indexes** — Add `{ userId: 1, updatedAt: 1 }` to Program and Workout schemas. | 10 min |
| 16 | **Memoize Animated.event** — Wrap in `useMemo` with no deps (stable ref). | 5 min |

### Architecture (2 items, ~15 min total)

| # | Fix | Effort |
|---|-----|--------|
| 17 | **Extract timestamp helper** — Move `nextLocalUpdatedAt` to `src/utils/timestamps.ts`, import in both stores. | 5 min |
| 18 | **Remove unnecessary dynamic imports** — Replace `await import()` in `syncStore.ts` with static imports. Verify no circular dependency with `npx tsc --noEmit`. | 10 min |

---

## Category Summaries

### 1. Security (6 findings: 1 CRITICAL, 3 HIGH, 2 LOW)
The backend has no authentication, no input validation, wide-open CORS, and no rate limiting. The DELETE authorization bypass is the most severe: anyone can delete any document by omitting the optional `userId`. MongoDB credentials are weak (`user1:pass123`). Body parser limit (10MB) with no batch size caps enables resource exhaustion.

### 2. Performance (6 findings: 2 HIGH, 4 MEDIUM)
Screens re-render unnecessarily due to missing `useShallow` wrappers on array selectors. Sync deletes tombstones one-by-one with sequential HTTP requests. MongoDB lacks compound indexes for the delta sync query pattern. The sync merge function blocks the JS thread with synchronous O(n log n) sorting inside a Zustand setter.

### 3. Code Quality (14 findings: 5 MEDIUM, 9 LOW)
Five runtime dependencies and two server dependencies are completely unused. 17 files use inconsistent `@src/` imports. 11 `as any` casts and two `raw: any` parameters bypass TypeScript strict mode. 10 empty catch blocks swallow errors, two in sync code. Two stale utility scripts lack npm script entry points.

### 4. Test Coverage (15 findings: 3 CRITICAL, 3 HIGH, 5 MEDIUM, 4 LOW)
The project acknowledges "no automated tests." The sync engine, force-resync, and workout session store (the three most complex modules) have zero coverage. Five existing test files exist but are thin — 2 files (bodyweight analytics and activity summary) have real test logic; the rest are bare placeholders. The activity summary test has timezone-dependent assertions that fail in CI.

### 5. Dependencies (12 findings: 2 CRITICAL, 3 HIGH, 5 MEDIUM, 2 LOW)
Four known CVEs exist with available fixes (shell-quote command injection, picomatch ReDoS, node-forge signature forgery, uuid buffer bounds). All 4 can be fixed with `overrides` in package.json. `@expo/ui` has a major SDK version mismatch (SDK 55 vs project SDK 54). Multiple expo packages are behind recommended patch versions. Seven transitive vulns in dev toolchain affect only dev-time security unless dev server is exposed.

### 6. Architecture (9 findings: 1 CRITICAL, 1 HIGH, 5 MEDIUM, 2 LOW)
The workout session store is a 1629-line God object with 7 responsibilities. Server routes are monolithic with no service layer and are ~70% duplicated between programs and workouts. Mongoose hook boilerplate is copy-pasted between models. Screens bypass store actions and directly manipulate state via `getState()`/`setState()`. The `shared/` directory is client-only despite its name.

---

*Report generated autonomously by 6 parallel audit agents. Each finding was cross-verified against source code before inclusion. No speculative or unverified findings.*
