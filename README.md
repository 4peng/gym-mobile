# Gym Mobile

Personal, single-device workout tracker. Expo Router (iOS only) with SQLite on the phone and an
Express + Mongo mirror in the cloud so data survives reinstalling a sideloaded build.

## How data flows

- **Local first.** Completed sessions live in SQLite (`src/db`); routines, preferences and the live
  session live in small Zustand stores persisted to AsyncStorage. Every screen reads local data.
- **Cloud is a backup, not a sync.** Edits queue by id and are pushed shortly after they happen
  (and on reconnect). A fresh install with no local data pulls everything back. There is no
  merging: this phone is the source of truth. Settings has *Back up now*, *Back up everything*
  and *Restore from cloud*.
- **Custom exercises and pinned exercises are local only** and are never touched by a restore.

## Run it

```bash
npm install
npm run dev            # Expo dev server
npm run typecheck      # tsc
npm run lint           # eslint (raw colour literals outside the theme are errors)
npm run format:check   # prettier, app + server
npm test               # jest; repository SQL runs on Node's built-in sqlite

cd server && npm install && npm run dev   # backend, needs MONGODB_URI in ../.env
```

CI runs all of the above on every push. `ios-build.yml` produces an unsigned IPA on `main`.

## Sideloading with the Live Activity

The rest-timer Live Activity is a widget extension (`expo-widgets`). It ships inside the IPA as a
second bundle id (`com.x4peng.gym-mobile.RestTimerLiveActivity`). When signing the IPA with your
sideloading tool, keep app extensions enabled so the extension is signed alongside the app;
if the tool asks whether to strip extensions, say no. Nothing else is needed: the timer runs on
`timerInterval`, so no push token or server is involved.

## Layout

See `AGENTS.md` for the route map, ownership, data invariants and coding standards.
