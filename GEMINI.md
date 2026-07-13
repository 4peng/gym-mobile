# Project guide

The canonical architecture, conventions, route map, store ownership, and
engineering standards for this repository live in **[AGENTS.md](./AGENTS.md)**.

This file previously duplicated that content and had drifted out of sync with
the code (e.g. it described MMKV/synchronous persistence, but the app uses
async AsyncStorage). To keep a single source of truth, refer to `AGENTS.md`.
