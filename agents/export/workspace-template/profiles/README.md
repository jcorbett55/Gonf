# Agent Profile Selector

Use this quick selector before importing the team kit.

## 30-Second Choice

Choose General when most answers are yes:

- Is this project mostly stable and reasonably modular?
- Do we have acceptable test confidence for normal delivery?
- Do we want standard speed and standard controls?

Choose Legacy when most answers are yes:

- Is the codebase tightly coupled or fragile?
- Are regression risks high or test confidence low?
- Do we need stricter discovery, compatibility, and rollback discipline?

## What Changes Between Profiles

Both profiles keep the same role structure and handoffs.

- General profile
  - Default constraints and normal delivery pace.
  - Best for most projects and mixed environments.

- Legacy profile
  - Adds discovery baseline, change budget, compatibility checks, rollback notes, and risk-based regression focus.
  - Best for high-risk or older systems.

## Import Commands

General profile (default):

```powershell
.\install-agent-kit.ps1 -TargetRepoPath C:\Path\To\Repo -ProjectName "My Project" -BackendPath "backend/MyApp.Api" -FrontendPath "frontend/src" -ProjectType General
```

Legacy profile:

```powershell
.\install-agent-kit.ps1 -TargetRepoPath C:\Path\To\Repo -ProjectName "My Project" -BackendPath "backend/MyApp.Api" -FrontendPath "frontend/src" -ProjectType Legacy
```

## If Unsure

Start with General. Move to Legacy when regressions, coupling, or rollback risk begins to slow delivery.
