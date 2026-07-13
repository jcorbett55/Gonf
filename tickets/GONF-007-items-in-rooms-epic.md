# GONF-007 - Items In Rooms Epic

## Epic Objective

Add item management to Gonf Generator so users can define, place, and review items by room while preserving existing room/map workflows.

## Priority and Sequencing Decision

1. This epic extends delivered GONF-006 functionality.
2. Work should proceed through discovery, backend, frontend, and QA child tickets.
3. Existing save/load behavior must remain backward compatible for room data.

## Business Context

Business wants rooms to support item placement and room-level item visibility from the map experience.

## In Scope (Epic Level)

1. Item domain definition and constraints.
2. UI split into `Rooms` and `Items` tabs under Gonf Generator.
3. Save/Load persistence updates so Gonf JSON includes rooms and items.
4. Map indicator and room-level item list interaction.
5. QA coverage for item workflows and regressions.

## Out of Scope (Epic Level)

1. Inventory transfer gameplay actions between rooms.
2. Item stacking rules beyond explicit business requirements.
3. New deployment infrastructure.

## BA Deliverables

1. Final item field definitions and validation rules.
2. Clarified behavior for item icon/list interaction on map.
3. Acceptance-ready decomposition for backend/frontend/QA.
4. Traceability from this epic to all child stories.

## Development Workflow Rule

1. For every active story, all code changes must be done on a dedicated branch named after the ticket being worked.
2. Example branch format: `feature/GONF-007C-ui-items-tab-and-map-indicators`.
3. Do not mix multiple story implementations on a single branch.

## Child Ticket Plan

1. GONF-007A - Discovery and item business rules [Draft]
2. GONF-007B - Backend item model, validation, and persistence [Draft]
3. GONF-007C - UI item tab, map indicators, and room item list [Draft]
4. GONF-007D - QA integration and regression strategy for items [Draft]

## Dependencies

1. Baseline Gonf Generator from GONF-006.
2. Business validation of item interaction behavior.
3. QA cycle completion and sign-off.

## Traceability

- Epic ID: GONF-007
- Parent: GONF-006 Delivered Baseline
- Related Tickets:
  1. GONF-006B
  2. GONF-006C
  3. GONF-006D
  4. GONF-007A
  5. GONF-007B
  6. GONF-007C
  7. GONF-007D

## Status

- Current Status: Ready for Dev
- Owner: Business Analyst
- Last Updated: 2026-07-10
- Branch Naming Target: feature/GONF-007-epic-items-in-rooms
