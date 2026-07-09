# Gonf

Gonf is a full-stack web application that takes JSON input and generates a form-oriented schema preview.

## Tech Stack

- Backend: .NET 10 Web API (`backend/Gonf.Api`)
- Backend tests: xUnit (`backend/Gonf.Api.Tests`)
- Frontend: React + Vite (`frontend`)
- Frontend tests: Vitest + Testing Library

## Repository Layout

- `backend/Gonf.Api`: API implementation
- `backend/Gonf.Api.Tests`: backend unit tests
- `frontend`: React application
- `agents`: role definitions for BA, Lead, Backend Dev, Frontend Dev, QA
- `docs`: operating model and templates
- `tickets`: project ticket artifacts
- `.githooks/pre-commit`: commit quality gate script

## 1) Checkout the Code

```powershell
git clone <your-repo-url> Gonf
Set-Location Gonf
```

## 2) Prerequisites

- .NET SDK 10.x
- Node.js 20+ and npm
- Git

Verify:

```powershell
dotnet --version
node --version
npm --version
git --version
```

## 3) IDE Setup (VS Code Recommended)

Recommended extensions:

- C#
- C# Dev Kit
- ESLint (optional if your team standardizes on it)
- Vitest Explorer (optional)

Open the repo root in VS Code.

## 4) Install Dependencies

Backend restore:

```powershell
dotnet restore Gonf.slnx
```

Frontend install:

```powershell
Set-Location frontend
npm install
Set-Location ..
```

## 5) Run Locally

Backend (API):

```powershell
Set-Location backend/Gonf.Api
dotnet run
```

Frontend (UI):

```powershell
Set-Location frontend
npm run dev
```

Frontend defaults to `http://localhost:5173` and backend defaults to `http://localhost:5131` in development.

## 6) Run Tests

Backend tests:

```powershell
dotnet test Gonf.slnx --nologo
```

Frontend tests:

```powershell
Set-Location frontend
npm run test:run
```

## Quality Gates

The project enforces these gates for development work:

1. Unit tests are required for new development.
2. Unit tests must pass before commit is allowed.
3. Code still requires dev lead review approval before merge.
4. QA validates merged code before UAT promotion.

### Pre-Commit Gate

The repository includes `.githooks/pre-commit` to enforce test checks.

Enable hooks in your local clone:

```powershell
git config core.hooksPath .githooks
```

What the hook checks:

1. Backend test project exists (`*Tests.csproj` under `backend`).
2. Frontend has a test script in `frontend/package.json`.
3. `dotnet test Gonf.slnx --nologo` passes.
4. `npm run test -- --run` (frontend) passes.

If any check fails, commit is blocked.

## Expectations for Future Development

For every ticket:

1. Implement feature code plus matching unit tests.
2. Keep ticket traceability updated (commits, review, QA, bugs).
3. Ensure backend and/or frontend tests for touched scope pass locally.
4. Keep API/UI contracts consistent and update tests when contract changes.
5. Follow role workflow in `agents` and gate rules in `docs/team-operating-model.md`.

## UI Mockup Workflow (Business Review)

When a ticket introduces or changes key UI flows:

1. Build a static React mockup first in `frontend/src` using mock data.
2. Mirror the approved visual direction in Figma.
3. Export deck-ready PNG images from Figma for business review.
4. Capture links or artifact references in the ticket traceability section.

Recommended deck image set:

1. Empty/default state
2. Loading/in-progress state
3. Success state
4. Error state
