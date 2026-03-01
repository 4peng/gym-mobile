# GEMINI.md - Gym Tracking App

## Project Overview
This project is an offline-first gym and workout tracking application. It is built as a hybrid Next.js application that leverages `react-native-web` to share UI logic and components between web and potentially native platforms.

The core functionality includes:
- **Program Management:** Creating and managing workout templates (Programs).
- **Workout Tracking:** Logging active workout sessions, sets, reps, and weights.
- **Offline-First Sync:** A custom sync engine that uses a "last-write-wins" strategy based on `updatedAt` timestamps to synchronize local data (stored in MMKV) with a backend.
- **Notifications:** Integration with Expo Notifications for rest timers and other alerts.

## Tech Stack
- **Framework:** [Next.js](https://nextjs.org/) with [react-native-web](https://necolas.github.io/react-native-web/) for cross-platform UI.
- **State Management:** [Zustand](https://github.com/pmndrs/zustand) with [Immer](https://immerjs.github.io/immer/) for immutable state updates.
- **Storage:** [MMKV](https://github.com/mrousavy/react-native-mmkv) (via `react-native-mmkv`) for high-performance key-value storage.
- **UI Components:** [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/), and standard React Native primitives (`View`, `Text`, `Pressable`, `TextInput`).
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) for web-level layout and `StyleSheet` for React Native components.
- **Validation:** [Zod](https://zod.dev/) and [React Hook Form](https://react-hook-form.com/).

## Project Structure
- `app/`: Next.js App Router directory. Routes often serve as thin wrappers around screens located in `src/screens/`.
- `src/screens/`: The primary UI screens of the application (e.g., `WorkoutSessionScreen`, `EditProgramScreen`).
- `src/components/`: Domain-specific UI components (e.g., `ExerciseEditor`, `FloatingRestTimer`).
- `src/stores/`: Zustand stores managing `programStore`, `workoutSessionStore`, and `syncStore`.
- `src/lib/api/`: API client implementations (`client.ts`), converters, and the core `sync.ts` engine.
- `src/types/`: TypeScript definitions for Programs, Workouts, and Exercises.
- `src/storage/`: MMKV configuration for Zustand persistence.
- `components/ui/`: A collection of reusable base UI components (Shadcn/UI style).

## Key Commands
- **Start Development Server:** `npm run dev` or `pnpm dev`
- **Build for Production:** `npm run build` or `pnpm build`
- **Start Production Server:** `npm run start` or `pnpm start`
- **Linting:** `npm run lint` or `pnpm lint`

## Development Conventions
- **Hybrid UI:** Be mindful that many components use React Native primitives. When adding new UI, check if it should be a standard web component or a React Native component for cross-platform compatibility.
- **Offline-First:** All data mutations should happen in the Zustand stores first. The sync engine will handle propagation to the backend.
- **Type Safety:** Ensure all data models follow the interfaces defined in `src/types/index.ts`.
- **Sync Strategy:** Use the `updatedAt` (epoch-ms) field for conflict resolution. Tie-breaks favor local changes.
- **ID Generation:** Use `generateId()` from `@/utils/id` which uses `uuid v4`.
