# GONF-006C - Gonf Generator UI, Form Workflow, and Map Visualization

## Business Objective

Deliver the Gonf Generator frontend experience so users can create/load Gonfs, manage rooms, and visualize connected room maps by floor.

## Business Rules

1. UI must provide navigation to a new section named `Gonf Generator`.
2. Landing actions:
   - Create New Gonf
   - Load Existing Gonf (JSON upload)
3. On successful load, Gonf Name defaults to filename without extension and map/form data is populated.
4. Save requires Gonf Name.
5. Clear resets form to initial state.
6. Up/Down exits remain disabled until Room Floor is selected.

## User Story

As a user
I want to create and visualize a Gonf through forms and floor tabs
So that I can understand and edit room navigation structure quickly.

## Acceptance Criteria

1. User can navigate from main app to `Gonf Generator` section.
2. UI presents Gonf Name field and create/load options on landing state.
3. Load rejects non-JSON and invalid-Gonf JSON with visible error guidance.
4. Room form supports:
   - Room ID (hidden/system-managed display)
   - Room Name
   - Room Description
   - Room Floor (-5 through 10)
   - Directional exits using room-name labels with room-id values
5. Save sends data and shows success or actionable error messages.
6. On successful save, form clears and map refreshes from latest Gonf data.
7. Lower map area provides floor tabs and renders only rooms for selected floor.
8. Room visualization uses square nodes with room names and connector lines for exits.
9. Hover/click on room shows popup with name, description, and exits.

## Edge Cases and Error Handling

1. Missing Gonf Name on save.
2. Duplicate room name validation message.
3. Loaded Gonf includes unknown or orphaned exit references.
4. Room name too long for square node display.
5. No rooms on selected floor tab.

## Non-Functional Requirements

1. UI remains responsive during map re-render and save/load operations.
2. Error messages are accessible and keyboard/screen-reader friendly.
3. Visualization remains readable for moderate room counts.
4. Tab and popup interactions are accessible without mouse-only usage.

## Dependencies

1. Discovery decisions from GONF-006A.
2. Backend save/load and validation contract from GONF-006B.
3. QA coverage from GONF-006D.

## Out of Scope

1. Advanced graph editing interactions (drag/drop layouts).
2. Export formats beyond Gonf JSON.
3. Real-time collaboration.

## Open Questions

1. Final behavior for east exit (included vs omitted in intake form example).
2. Preferred default map layout algorithm for room positioning by exits.
3. Maximum room-name length before truncation/tooltip policy.

## Architecture Notes

- Keep form state and map state synchronized through a shared Gonf model.
- Separate mapping utilities for `room-id` values vs `room-name` labels.
- Use deterministic rendering strategy so QA snapshots remain stable.

## UI Mockup and Deck Artifacts (when UI is in scope)

- Static React mockup path: frontend/src (new GG route/components)
- Figma file/frame link: [pending]
- Deck image exports (PNG):
  1. [pending] Empty state
  2. [pending] Load/Create state
  3. [pending] Saved map state
  4. [pending] Error state

## QA Notes and Test Intent

1. Validate create/load/save/clear flows.
2. Validate tab-based floor filtering and room popup details.
3. Validate accessibility for form, tabs, and popups.
4. Validate resilience to invalid or partial data.

## Traceability

- Parent Ticket: GONF-006
- Related Tickets:
  1. GONF-006A
  2. GONF-006B
  3. GONF-006D
- Related Commits: [pending]
- Related PR/Code Review: [pending]
- QA Results: [pending]
- Bug Tickets: [pending]

## Status

- Current Status: Draft
- Owner: Frontend Developer
- Last Updated: 2026-07-09
- Branch Naming Target: feature/GONF-006C-ui-gonf-generator
