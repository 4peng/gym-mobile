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
second bundle id (`com.x4peng.gym-mobile.ExpoWidgetsTarget`). When signing the IPA with your
sideloading tool, keep app extensions enabled so the extension is signed alongside the app;
if the tool asks whether to strip extensions, say no. The timer runs on `timerInterval`, so no
push token or server is involved.

The app hands the activity's layout to the extension through an App Group, so both bundles must
end up entitled to the same group after re-signing:

- CI ad-hoc signs the app and the extension with the `group.<bundle id>` entitlement (an unsigned
  app has no entitlements and AltStore only re-signs the ones it finds).
- AltStore renames the group per team (`group.<bundle id>.<TEAMID>`). `patches/expo-widgets+*.patch`
  makes `expo-widgets` look up the entitled group at runtime (`ALTAppGroups` in Info.plist, then the
  embedded provisioning profile) instead of trusting the build-time constant. `npm install` applies
  the patch via `patch-package`.

If the Live Activity appears but renders as an empty card, the two bundles are not sharing a
group: check the tool kept App Groups when it signed.

## Layout

See `AGENTS.md` for the route map, ownership, data invariants and coding standards.
