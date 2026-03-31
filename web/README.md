# Routine Lab

Standalone routine editor for the existing gym database.

## Quick start

Use either of these from the repo root:

- Double-click `Start-RoutineLab.cmd`
- Run `npm run routine-web`

That opens the backend and web app in separate PowerShell windows and then opens the browser.

## Manual run

1. Start the backend from `server/` with `npm run dev`.
2. Start the web app from `web/` with `npm start`.
3. Open `http://127.0.0.1:4173`.

The web app talks directly to the existing `/programs` API at `http://localhost:4000` and edits routines for `default-user`.
