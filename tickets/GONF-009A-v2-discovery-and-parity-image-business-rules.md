# GONF-009A - V2 Discovery and Parity/Image Business Rules

## Business Objective

Finalize V2 rules so teams can implement a separate V2 repository with complete V1.0 parity and then add room image generation with deterministic save/load behavior.

## Business Rules

1. V2 is a separate repository; V1 remains unchanged.
2. V2 parity includes all V1.0 functionality delivered to date:
   - Rooms
   - Items
   - Characters
   - Existing map and detail-panel behavior
   - Existing save/load and validation behavior
3. Room image generation trigger:
   - Save Room generates a candidate image from room description.
4. Room details panel behavior:
   - Candidate image is displayed at the top of room details.
   - Retry icon requests a new candidate image.
   - Checkmark icon finalizes current candidate image.
5. Save Gonf behavior:
   - If room has an unconfirmed candidate image, Save Gonf finalizes that current candidate automatically.
6. Image storage path requirement:
   - C:\gonf\\[gonf_name]\img\
7. Folder creation behavior:
   - If path components do not exist, system creates them before writing image files.
8. File naming behavior:
   - Name must tie image to room and retry attempt count (example: kitchen_00.png).
9. Gonf JSON contract includes room-to-image association and retry/finalization metadata needed for reload consistency.

## User Story

As a business owner
I want V2 requirements finalized for parity and room image behavior
So backend, frontend, and QA can deliver against one unambiguous definition.

## Acceptance Criteria

1. Discovery output defines parity checklist for rooms/items/characters/map/save/load.
2. Discovery output defines room image lifecycle states and transitions.
3. Path and naming rules are finalized, including required folder path literal.
4. Save Gonf auto-finalization rule is finalized.
5. JSON field definitions for room image metadata are finalized.
6. Child tickets 009B/009C/009D inherit finalized rules with no unresolved ambiguity.

## Edge Cases and Error Handling

1. Image generation fails after Save Room.
2. Retry repeatedly requested for same room.
3. Room renamed after image was finalized.
4. Save Gonf occurs while image generation is in progress.
5. Path exists but file write is denied.

## Non-Functional Requirements

1. Rules are deterministic and business-testable.
2. Rule set supports backward compatibility for legacy Gonf files with no image data.
3. Definitions are sufficient for automated and manual QA coverage.

## Dependencies

1. Business owner confirmation on retry/confirm UX behavior.
2. Dev lead feasibility confirmation for generation workflow and persistence.
3. QA review for testability and regression coverage.

## Out of Scope

1. Character and item image generation.
2. Graphical hotspot interactions.
3. Runtime gameplay engine.

## Open Questions

1. Maximum retry attempts allowed per room in V2.0 (or unlimited).
2. Whether previous attempts are retained or pruned after finalization.

## Architecture Notes

- This ticket is requirements-only and does not include implementation.
- Backend/frontend implementation details are in 009B and 009C.

## QA Notes and Test Intent

1. Ensure each finalized rule maps to one or more test cases.
2. Ensure parity criteria are closed before room image criteria execution.

## Traceability

- Parent Ticket: GONF-009
- Related Tickets:
  1. GONF-009B
  2. GONF-009C
  3. GONF-009D
- Related Commits: [pending]
- Related PR/Code Review: [pending]
- QA Results: [pending]
- Bug Tickets: [pending]

## Status

- Current Status: Groomed
- Owner: Business Analyst
- Last Updated: 2026-07-14
- Branch Naming Target: feature/GONF-009A-v2-discovery-and-parity-image-business-rules
