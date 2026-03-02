# GEMINI.md - Gym Tracking App

## Project Overview
This project is an offline-first gym and workout tracking application. It is built as a hybrid Next.js application that leverages `react-native-web` to share UI logic and components between web and potentially native platforms.

## Recent Architectural Changes (March 2026)
- **High-Performance Component Architecture:** Broke down complex screens into specialized, memoized components (`ProgramTile`, `ExerciseCard`, `SetRow`) to minimize re-renders.
- **Optimized Sync Engine:** Refactored "Last-Write-Wins" merge logic to mutate state arrays in-place, drastically reducing memory usage as workout history grows.
- **Silent Background Sync:** Introduced `backgroundSync` for automatic data updates (pinning, completing sets) to prevent UI flickering, reserving the loading spinner for manual pull-to-refresh.
- **Daily Data Aggregation:** Analytics and history now consolidate multiple sessions on the same date into a single daily volume total using local timezone keys (`YYYY-MM-DD`).
- **Tactile UX:** Integrated `expo-haptics` for physical feedback on swipe gestures, set completion, and workout finishing.

## Tech Stack
- **Framework:** [Next.js](https://nextjs.org/) with [react-native-web](https://necolas.github.io/react-native-web/) / [Expo](https://expo.dev/).
- **State Management:** [Zustand](https://github.com/pmndrs/zustand) with [Immer](https://immerjs.github.io/immer/).
- **Storage:** [AsyncStorage](https://react-native-async-storage.github.io/async-storage/) (migrated for wider compatibility).
- **Feedback:** [Expo Haptics](https://docs.expo.dev/versions/latest/sdk/haptics/).
- **API:** REST API with Delta Sync support.

## Environment Configuration
- **Server Switching:** Managed in `src/lib/api/client.ts` via the `ENV` constant.
- **Production:** Points to Vercel backend.
- **Local:** Automatically detects host machine IP for physical device testing (iPhone/Android on same Wi-Fi).

## Development Conventions
- **Haptics:** Always use the `HapticFeedback` utility from `@/utils/haptics` for consistent tactile patterns.
- **Analytics:** Data grouping must always use local date strings (`YYYY-MM-DD`) to ensure sessions aren't split by UTC offsets.
- **Offline-First:** All mutations happen in Zustand first; sync engine handles propagation silently in the background.
- **Schema Updates:** Ensure `weightUnit` is preserved in all converters and backend Mongoose schemas.
- **Performance:** Keep screen-level components lean; delegate complex UI to memoized sub-components.
