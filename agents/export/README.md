# Portable Agent Export

This folder packages the reusable agent kit in the VS Code workspace format expected for import into any repository.

## What Is Included

- `workspace-template/profiles/general/.github/agents/*.agent.md`
- `workspace-template/profiles/general/.github/instructions/project-delivery-playbook.instructions.md`
- `workspace-template/profiles/legacy/.github/agents/*.agent.md`
- `workspace-template/profiles/legacy/.github/instructions/project-delivery-playbook.instructions.md`
- `workspace-template/profiles/legacy/.github/instructions/legacy-baseline-starter.instructions.md`
- `install-agent-kit.ps1`

## Project Type Selection

- `General`: default profile for most projects.
- `Legacy`: profile with additional discovery, compatibility, and regression controls.

Both profiles preserve the same team role model, so either profile still operates in mixed project environments.

## Import Options

### Option 1: Manual Copy

1. Choose one profile folder under `workspace-template/profiles`.
2. Copy that profile's `.github` directory into the target repository root.
3. Replace these tokens in the copied markdown files:
   - `{{PROJECT_NAME}}`
   - `{{BACKEND_PATH}}`
   - `{{FRONTEND_PATH}}`

### Option 2: Scripted Install

Run the installer from this folder:

```powershell
.\install-agent-kit.ps1 -TargetRepoPath C:\Path\To\Repo -ProjectName "My Project" -BackendPath "backend/MyApp.Api" -FrontendPath "frontend/src" -ProjectType Legacy
```

`-ProjectType` accepts `General` or `Legacy` and defaults to `General`.

The script copies the selected profile `.github` folder into the target repository and replaces token placeholders.

## Why This Format Works

VS Code custom agents are workspace-scoped when placed under `.github/agents`, and on-demand instructions are workspace-scoped when placed under `.github/instructions`.
