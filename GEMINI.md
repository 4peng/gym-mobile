# Noir Cockpit: Hyperdetailed Technical Specification

This document serves as the absolute technical source of truth for the **Technical High-Performance Noir** architecture. It defines the directory orchestration, design systems, and engineering protocols required for 100% architectural consistency.

---

## 1. Module & Directory Orchestration

### 1.1 Routing & Entry (`/app`)
*   **Purpose**: Expo Router entry points.
*   **Architecture**: Files in this directory must remain "Lean Wrappers." They import a screen from `src/screens/` and export it as the route. No heavy business logic or complex styling belongs here.
*   **Key Files**:
    *   `_layout.tsx`: The Root Provider stack. Handles font preloading via `FONT_ASSETS` and global theme defaults.
    *   `workout/index.tsx`: Entry point for the live training cockpit.

### 1.2 Screen Controllers (`/src/screens`)
*   **Purpose**: Route-level logic orchestrators.
*   **Responsibility**: Connects Zustand stores to UI components. Handles navigation callbacks, global alerts (e.g., Discard Workout), and integrates modular HUD components.
*   **File Standard**: Screen files should not exceed 300 lines. If larger, UI must be extracted to modular components.

### 1.3 Modular HUD Instrumentation (`/src/components/Workout/HUD`)
*   **Purpose**: Isolated, high-performance tactical units.
*   **Architecture**: Specialized organisms that handle their own internal animations and gesture responders.
*   **Components**:
    *   `HUDHeader.tsx`: Manages the scroll-responsive "Condenser" logic.
    *   `ScrubberRail.tsx`: Mathematical centering logic for movement IDs.
    *   `HUDPillNav.tsx`: Centralized gesture race handler (Fling vs. Pan).

### 1.4 State Infrastructure (`/src/stores`)
*   **Purpose**: Low-latency data containers.
*   **Files**:
    *   `workoutSessionStore.ts`: The primary store for live training state and history indexing.
    *   `activeSessionStore.ts`: **Strict Requirement**. Contains memoized selector-wrappers for the main store to prevent re-render loops in components.
    *   `programStore.ts`: Management of saved routines and training templates.

### 1.5 Data Transfer Layer (`/src/lib/api`)
*   **Purpose**: Boundary management between Client and Server.
*   **Files**:
    *   `converters.ts`: **Crucial Mapping**. Handles the transformation of frontend `WorkoutSession` objects to backend `WorkoutServer` documents (converting set types, date formats, and IDs).
    *   `sync.ts`: Offline-first synchronization engine using `updatedAt` conflict resolution.

### 1.6 Shared Logic (`/shared`)
*   **Purpose**: Logic shared between App, Server, and Web-scripts.
*   **Key File**: `programs.js`. The canonical normalization boundary for routine definitions and exercise drafting.

---

## 2. Design System: Atomic Registry (`/src/constants`)

### 2.1 The "Noir" Color Palette (`colors.ts`)
*   **OLED Foundation**: `BG: "#000000"`, `CARD_BG: "#121212"`.
*   **Success (Neon Green)**: `ACCENT_GREEN: "#00FF99"`. For checkmarks, progress bars, and "Dropset" status.
*   **Danger (Safety Red)**: `DANGER: "#FF3B30"`. For all "X" buttons, delete swipes, and discard actions.
*   **Focus (Technical Blue)**: `ACCENT_BLUE: "#007AFF"`. For targeting brackets and "Working Set" status.
*   **Warning (Safety Orange)**: `ACCENT_YELLOW: "#FFCC00"`. For "Warmup Set" status.

### 2.2 Geometric Standards (`ui.ts`)
*   **Radii**: `16px` for containers (Cards, HUDs); `12px` for items (Buttons, table rows).
*   **Outlines**: Strictly `1px` or `1.5px` (Ghost UI). No internal fills permitted on buttons.

### 2.3 Tactical Typography (`fonts.ts`)
*   **Performance Metrics**: `MONO: 'SpaceMono-Regular'` or `'FiraCode-Bold'`. (Weights, reps, timers).
*   **Functional Labels**: `MEDIUM: 'NeoGramTrial-BoldCondensed'`. (Uppercase HUD labels).

---

## 3. Engineering & Performance Standards

### 3.1 State Stability (The Primitive Rule)
To prevent "Maximum update depth" errors:
*   Selectors **must** return primitive values or arrays of primitives wrapped in `useShallow`.
*   **Banned**: Creating new objects `{...}` or running `.map()` directly inside a selector.

### 3.2 JSX Sanitization ("Tight-Tag")
*   Use "Minified JSX" (zero whitespace between component tags) for all HUD components to prevent raw text node crashes on iOS.
*   Dynamic strings must be strictly wrapped in `<Text>`.

### 3.3 Zero-Latency Interaction
*   Native `<Modal>` is prohibited for session HUDs. Use absolute-positioned `View`s with snappy `Animated.timing` (180ms) and `useNativeDriver: true`.

---

## 4. Backend & Sync Integrity
*   **Mongoose Schema**: `WorkoutSetSchema` includes `type` field: `enum: ['working', 'warmup', 'dropset']`.
*   **Tombstones**: Soft deletions via `deletedAt` timestamp.
*   **Persistence**: `activeExerciseId` must be persisted in MMKV to ensure session continuity on app relaunch.

---

## 5. Refactoring Protocol: "Noir" Migration Workflow
Follow this sequence mechanically for every screen refactor:
1.  **Registry Mapping**: Map all colors and spacing to `/src/constants`.
2.  **Typography Sweep**: Reassign all numeric variables to `FONT_FAMILIES.MONO`.
3.  **Ghost Refactor**: Strip background fills; apply 1px technical outlines.
4.  **HUD Decomposition**: Extract sticky/fixed elements to a local `/HUD` folder.
5.  **Logic Sanitization**: Move manual list-processing into store selectors.

---

## 6. User Philosophy & Style of Work
*   ** Cockpit First**: Focus on data density and tactical visibility over whitespace.
*   **High-Speed Instrumentation**: Favor zero-latency gestures (Scrubbing, Swiping) and Haptic Ticks over traditional tap navigation.
*   **Surgical Implementation**: Immediate technical action. No conversational fluff. High signal-to-noise ratio.
