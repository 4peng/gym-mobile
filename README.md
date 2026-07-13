# Gym Mobile: Noir Cockpit Architecture

This repository contains a high-performance "Technical Noir" mobile workout tracker built with **Expo Router (React Native)** and **Express/MongoDB**. The application follows a professional cockpit instrumentation aesthetic, optimized for data density and zero-latency interaction.

---

## 1. Technical Specification (The Gold Standard)

### 1.1 Data & Logic Layer
*   **State Management**: Zustand with AsyncStorage-backed persistence (async).
*   **Stability Rule**: All store selectors must return **stable primitives** (strings, numbers, booleans) or arrays of primitives wrapped in `useShallow`. Never generate new objects `{...}` inside a selector to prevent recursive render loops.
*   **Conflict Resolution**: Uses `updatedAt` timestamps for last-write-wins merging and `deletedAt` tombstones for soft deletions during offline-first synchronization.

### 1.2 Component Orchestration
*   **Decomposition**: Avoid "Master Components." Complex screens (like `WorkoutSessionScreen`) are decomposed into isolated, memoized HUD units in a local `/HUD` sub-directory.
*   **Zero-Latency Interaction**: Standard React Native `<Modal>` components are deprecated. All overlays are absolute-positioned `<Animated.View>` elements using `useNativeDriver: true` for 60fps transitions.
*   **Gesture Systems**: Overlapping interactions (e.g., swiping vs. scrubbing) are resolved using `Gesture.Race` or `Gesture.Exclusive`.

---

## 2. Design System (`/src/constants`)

All visual elements must derive from centralized constants. **Raw hex codes or magic pixel values are strictly prohibited in component files.**

*   **`colors.ts`**: OLED-Black (`#000000`) backgrounds, Neon Green (`#00FF99`) for success, Safety Red (`#FF3B30`) for danger/X, and Technical Blue (`#007AFF`) for instrumentation focus.
*   **`fonts.ts`**: All performance data (weights, reps, timers) **must** use monospaced fonts (`SpaceMono-Regular`).
*   **`ui.ts`**: Centralized `UI.SHARED` registry.
    *   **Radii**: 16px for primary containers, 12px for internal items.
    *   **Ghost UI**: All buttons are transparent with 1px to 1.5px solid technical outlines.

---

## 3. Migration Report: UI Overhaul Reference

This table documents the changes performed during the system-wide refactor to the "Noir" standard. Use this as a blueprint for refactoring future screens.

| Domain | Change Type | Technical Implementation |
| :--- | :--- | :--- |
| **Infrastructure** | Standardized | Centralized all colors, fonts, and shared UI styles. Deleted `android/` directory to specialize for high-performance iOS execution. |
| **Set Logging** | Refactored | Constrained 72px inputs. Implemented color-coded Set Types (Warmup/Working/Dropset) with hold-to-reveal legends. |
| **HUD Header** | New Sub-system | Created a scroll-interpolated "Condenser" header that collapses into a slim tactical bar during session execution. |
| **Navigation** | New Sub-system | Replaced standard pagination with a **Tactical Scrubber HUD**—a horizontal rail with shorthand IDs and live progress brackets. |
| **Modals** | Architectural | Moved `ExerciseNavMenu` and `ExerciseReorderModal` from native Modals to snappy absolute sheets (200ms translateY). |
| **Backend** | Synchronized | Updated MongoDB schema and API converters to support permanent persistence of the new `type` field in Workout Sets. |

---

## 4. Refactoring Protocol
Follow these steps mechanically when migrating any legacy component:
1.  **Style Mapping**: Replace local `StyleSheet` values with `UI.SHARED` constants.
2.  **Typography Standard**: Reassign all numeric/date variables to `FONT_FAMILIES.MONO`.
3.  **Ghost Refactor**: Remove background fills from buttons; set `borderWidth: 1`.
4.  **Color Alignment**: Standardize all "X" buttons to Red and all checkmarks to Green.
5.  **Selector Stabilize**: Refactor store data access to return stable primitives only.
6.  **Tight-Tag JSX**: Remove all whitespace/newlines between tags to prevent raw text node crashes.

---

## 5. User Work Style & Philosophy
*   **Instrument Logic**: Treat the UI as a professional cockpit instrument, not a consumer social app. Focus on data density and tactical visibility.
*   **Minimalist Filler**: No conversational fluff, immediate technical action, surgical code changes.
*   **Tactical Navigation**: Favor gestures like scrubbing, swiping, and rapid list-pops over slow native transitions.
