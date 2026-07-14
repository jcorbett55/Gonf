# Portable Agent Export

This folder packages the reusable agent kit in the VS Code workspace format expected for import into any repository.

## What Is Included

- `workspace-template/.github/agents/*.agent.md`
- `workspace-template/.github/instructions/project-delivery-playbook.instructions.md`
- `install-agent-kit.ps1`

## Import Options

### Option 1: Manual Copy

1. Copy `workspace-template/.github` into the target repository root.
2. Replace these tokens in the copied markdown files:
   - `{{PROJECT_NAME}}`
   - `{{BACKEND_PATH}}`
   - `{{FRONTEND_PATH}}`

### Option 2: Scripted Install

Run the installer from this folder:

```powershell
.\install-agent-kit.ps1 -TargetRepoPath C:\Path\To\Repo -ProjectName "My Project" -BackendPath "backend/MyApp.Api" -FrontendPath "frontend/src"
```

The script copies the `.github` folder into the target repository and replaces the token placeholders.

## Why This Format Works

VS Code custom agents are workspace-scoped when placed under `.github/agents`, and on-demand instructions are workspace-scoped when placed under `.github/instructions`.
