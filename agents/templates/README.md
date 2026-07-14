# Reusable Project Agent Kit

This folder contains project-agnostic role definitions and operating model guidance.

Use this kit when starting a new project where you want the same collaborative team pattern used in Gonf, without product-specific wording.

## Project Profiles

Two profile variants are provided:

- `general/`: Default profile for most projects.
- `legacy/`: Adds discovery, compatibility, and regression controls for legacy-heavy systems.

Both profiles keep the same role handoffs and quality gates so either profile remains usable across mixed codebases.

## Files

- `general/*.agent.md`
- `general/project-delivery-playbook.md`
- `legacy/*.agent.md`
- `legacy/project-delivery-playbook.md`
- `team-operating-model.template.md`

## Token Replacement

Before using these files in a new repository, replace the following tokens:

- `{{PROJECT_NAME}}`: Human-readable project name.
- `{{BACKEND_PATH}}`: Primary backend implementation path (for example, `backend/MyApp.Api`).
- `{{FRONTEND_PATH}}`: Primary frontend implementation path (for example, `frontend/src`).

## Suggested Adoption Steps

1. Create an `agents` directory in the target project.
2. Choose one profile folder: `general` or `legacy`.
3. Copy the selected profile files into the target `agents` directory.
4. Replace tokens in all copied files.
5. Align role descriptions with stack-specific tools if needed.
6. Share the adopted workflow with your team before ticket execution starts.
7. Keep `project-delivery-playbook.md` next to the role files so individual agents can operate with the same assumptions even when used alone.

## Notes

- The templates are intentionally implementation-light and domain-neutral.
- Keep acceptance criteria, quality gates, and handoff discipline consistent across projects.
- Each agent template now includes a standalone mode so a single imported role can still operate effectively without the full team set.
- A ready-to-import workspace package is available under `agents/export/workspace-template`.


