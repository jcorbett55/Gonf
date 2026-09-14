# Gonf Player (frontend-player)

React + Vite application used to load a generated Gonf JSON file and play it as a text adventure: navigating rooms, viewing character overlays, and holding LLM-backed conversations with characters.

See the root [README.md](../README.md) for prerequisites, install, run, and test instructions.

## Scripts

- `npm run dev` — start the Vite dev server (default `http://localhost:5174`)
- `npm run build` — production build
- `npm run test:run` — run the Vitest suite once (CI-friendly)
- `npm run lint` — run Oxlint

## Conversation Feature Dependency

The in-room conversation panel calls the backend's `POST /api/conversation/turn` endpoint, which requires a configured chat provider. Follow [`backend/Gonf.Api/CHAT_PROVIDER_SETUP.md`](../backend/Gonf.Api/CHAT_PROVIDER_SETUP.md) to point the backend at a local Ollama instance (or another OpenAI-compatible endpoint) before testing conversations. Without this, conversation requests fail with `503 CHAT_PROVIDER_NOT_CONFIGURED`.

## Key Source Areas

- `src/GonfPlayerApp.jsx` — main player runtime: room navigation, character overlays, conversation transcript, and speaker-color assignment
- `src/gonf/gonfEngine.js` — maps loaded Gonf JSON into player state (rooms, characters, carried items)
- `src/gonf/conversationClient.js` — builds and sends conversation requests to the backend
