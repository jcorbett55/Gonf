# Gonf Generator (frontend)

React + Vite application used to author and generate a Gonf JSON file (rooms, characters, items, and image controls). This is the authoring side of Gonf — to play a generated Gonf as a text adventure, use `frontend-player` instead.

See the root [README.md](../README.md) for prerequisites, install, run, and test instructions.

## Scripts

- `npm run dev` — start the Vite dev server (default `http://localhost:5173`)
- `npm run build` — production build
- `npm run test:run` — run the Vitest suite once (CI-friendly)
- `npm run lint` — run Oxlint

## Key Source Areas

- `src/GonfGenerator.jsx` — main authoring UI
- `src/gonf/` — domain helpers for rooms, characters, items, image controls, and shared parsing/loading logic
