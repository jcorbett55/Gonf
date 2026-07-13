# GONF-008 - Character Tab Expansion Epic

## Epic Objective

Expand Gonf Generator character management so users can define full character details, assign character location behavior, and visualize room-level character presence from the map workflow.

## Priority and Sequencing Decision

1. This epic extends delivered GONF-007 functionality.
2. Work should proceed through discovery, backend validation/persistence alignment, frontend interaction updates, and QA validation.
3. Existing room and item save/load behavior must remain backward compatible.

## Business Context

Business wants the Character tab to move beyond name-only entry and support complete character authoring, room placement behavior, and room-details visibility through map interactions.

## In Scope (Epic Level)

1. Character form fields: `Character Name`, `Description`, `Location`, `Wanderer`, and `Contains` (items carried).
2. Character save behavior where empty location defaults to `Secret Storage`, and `Secret Storage` is auto-created if missing.
3. Validation that explicit location must reference a valid room.
4. Item ownership normalization where an item can only be assigned in one place at a time (room location or one character), with prior references removed on reassignment.
5. Wanderer is persistence-only for this epic (no movement behavior).
6. Map room indicators showing presence of one or more characters.
7. Room Details panel behavior for character list display and carried-item details when character indicators are selected.
8. Save/Load persistence updates for expanded character data model.

## Out of Scope (Epic Level)

1. Character combat, dialog trees, or NPC AI behavior.
2. Turn-by-turn wander simulation and runtime movement engine.
3. Equipment rules beyond selecting carried items from existing item list.
4. New deployment infrastructure.

## BA Deliverables

1. Final character field definitions and validation rules.
2. Clarified interaction behavior for character icon/list selection in the room details panel.
3. Confirmation that character save auto-creates `Secret Storage` when required.
4. Finalized item reassignment rule where assigning an item to a character removes prior room/character references.
5. Confirmation that Wanderer is persistence-only for this epic.
6. Acceptance-ready decomposition for backend/frontend/QA child stories.

## Development Workflow Rule

1. For every active story, all code changes must be done on a dedicated branch named after the ticket being worked.
2. Example branch format: `feature/GONF-008C-ui-character-tab-map-indicators-and-room-details`.
3. Do not mix multiple story implementations on a single branch.

## Child Ticket Plan

1. GONF-008A - Discovery and character business rules [Draft]
2. GONF-008B - Backend character model and persistence alignment [Draft]
3. GONF-008C - UI character tab expansion, map indicators, and room details integration [Draft]
4. GONF-008D - QA integration and regression strategy for character workflows [Draft]

## Dependencies

1. Baseline Gonf Generator and item workflows from GONF-007.
2. Business validation of character location and carried-items behavior.
3. QA cycle completion and sign-off.

## Traceability

- Epic ID: GONF-008
- Parent: GONF-007 Delivered Baseline
- Related Tickets:
  1. GONF-007B
  2. GONF-007C
  3. GONF-007D
  4. GONF-008A
  5. GONF-008B
  6. GONF-008C
  7. GONF-008D

## Status

- Current Status: Ready for Dev
- Owner: Business Analyst
- Last Updated: 2026-07-13
- Branch Naming Target: feature/GONF-008-epic-character-expansion
