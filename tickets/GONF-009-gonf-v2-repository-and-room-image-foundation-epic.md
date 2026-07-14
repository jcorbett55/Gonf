# GONF-009 - Gonf V2 Repository and Room Image Foundation Epic

## Epic Objective

Create Gonf V2 in a separate repository with full V1.0 feature parity (rooms, items, characters, map, save/load), then add room image generation and persistence as the first V2 enhancement.

## Priority and Sequencing Decision

1. V2 must be developed in a separate repository so V1 remains intact.
2. V2 implementation is strictly sequenced:
   - Phase 1: V1.0 parity in V2 repo.
   - Phase 2: Room image generation workflow.
3. Phase 2 begins only after parity acceptance is complete.

## Business Context

Business wants to preserve the stable V1 baseline while enabling a visual evolution path where rooms can have generated images tied to room records and reused consistently during load/play/edit workflows.

## In Scope (Epic Level)

1. Create V2 repository and migrate full V1 behavior:
   - Rooms
   - Items
   - Characters
   - Existing map and side-panel behavior
   - Existing save/load and validations
2. Add room image preview/generation workflow:
   - Generate image from room description after Save Room
   - Show generated image in room details panel
   - Support Retry icon and Checkmark icon
3. Persist finalized room images under required folder path:
   - C:\gonf\\[gonf_name]\img\
4. Save Gonf auto-finalizes any unconfirmed generated room image.
5. Gonf JSON save/load must preserve room-to-image association.

## Out of Scope (Epic Level)

1. Character image generation and overlay behavior.
2. Item image generation and overlay behavior.
3. Interactive graphical hotspots beyond room image display.
4. Runtime walkthrough engine implementation.

## BA Deliverables

1. Finalized V2 scope boundaries and parity definition.
2. Finalized room image lifecycle rules (generated, retried, finalized, auto-finalized).
3. Finalized naming and storage conventions for image files.
4. Finalized decomposition into backend/frontend/QA child tickets.

## Development Workflow Rule

1. For every active story, all code changes must be done on a dedicated branch named after the ticket being worked.
2. Example branch format: feature/GONF-009C-ui-room-image-preview-and-controls.
3. Do not mix multiple story implementations on a single branch.

## Child Ticket Plan

1. GONF-009A - V2 discovery and finalized parity/image business rules [Groomed]
2. GONF-009B - Backend parity migration plus room image generation/persistence [Groomed]
3. GONF-009C - UI parity verification plus room image preview/retry/confirm flow [Groomed]
4. GONF-009D - QA parity regression and room image integration strategy [Groomed]

## Dependencies

1. Delivered V1 baseline behavior from GONF-006, GONF-007, and GONF-008.
2. Business owner confirmation on image-generation acceptance behavior.
3. QA sign-off for parity before room image release.

## Traceability

- Epic ID: GONF-009
- Parent: Existing V1 baseline (GONF-006/007/008)
- Related Tickets:
  1. GONF-006A
  2. GONF-006B
  3. GONF-006C
  4. GONF-006D
  5. GONF-007A
  6. GONF-007B
  7. GONF-007C
  8. GONF-007D
  9. GONF-008A
  10. GONF-008B
  11. GONF-008C
  12. GONF-008D
  13. GONF-009A
  14. GONF-009B
  15. GONF-009C
  16. GONF-009D

## Status

- Current Status: Groomed
- Owner: Business Analyst
- Last Updated: 2026-07-14
- Branch Naming Target: feature/GONF-009-epic-v2-repo-and-room-image-foundation
