# GONF-009B - Backend Parity Migration and Room Image Generation/Persistence

## Business Objective

Deliver backend support for V2 by preserving full V1 parity and adding room image generation, retry handling, finalization, and Gonf JSON persistence of room-image associations.

## Business Rules

1. Backend behavior for V1 features (rooms/items/characters/save/load/validation) must remain equivalent in V2.
2. Save Room triggers candidate room-image generation from room description.
3. Retry requests generate a new candidate and increment attempt index.
4. Confirm requests finalize current candidate image for the room.
5. Save Gonf auto-finalizes any existing unconfirmed candidate image for each room.
6. Finalized image files are written under required folder path:
   - C:\gonf\\[gonf_name]\img\
7. Missing folders are auto-created before image write.
8. Gonf JSON save includes room image metadata and finalized file association.
9. Load Gonf returns room image metadata so frontend can display associated image.
10. Backward compatibility:
   - Legacy files without room image fields continue to load successfully.

## User Story

As a user
I want room images to be generated and persisted with my Gonf
So room visuals are stable across save/load cycles.

## Acceptance Criteria

1. Existing V1 backend tests for rooms/items/characters pass in V2 repo.
2. Save Room image candidate generation endpoint/path is implemented.
3. Retry operation returns a new candidate and updated attempt index.
4. Confirm operation persists selected image and marks room image as finalized.
5. Save Gonf auto-finalizes pending image candidates.
6. System creates required directory path before image save if needed.
7. Saved Gonf JSON includes room image metadata fields.
8. Load returns image associations accurately for each room.
9. Errors return machine-readable code plus user guidance.
10. Automated tests cover parity regression + room image positive/negative flows.

## Edge Cases and Error Handling

1. Image generation provider timeout/failure.
2. Retry invoked with no prior candidate.
3. Concurrent retries for same room.
4. Image write failure due to permission/file lock.
5. Gonf name contains invalid filename characters.
6. Save Gonf called while candidate generation is still in flight.

## Non-Functional Requirements

1. Save Room response remains responsive; generation path should avoid blocking unrelated operations.
2. File writes are atomic and do not leave partial image files.
3. Error taxonomy is stable for frontend handling.

## Dependencies

1. Finalized rules from GONF-009A.
2. Frontend workflow implementation from GONF-009C.
3. QA integration coverage from GONF-009D.

## Out of Scope

1. Character/item image generation.
2. Hotspot coordinate generation and rendering.
3. Third-party storage providers.

## Open Questions

1. Provider-specific model/seed strategy for deterministic retries.
2. Retention policy for previous retry image files after finalization.

## Architecture Notes

- Keep current validation/error envelope consistency.
- Add explicit DTOs for candidate image, retry, confirm, and auto-finalize outcomes.

## QA Notes and Test Intent

1. Verify parity endpoints and payloads remain stable.
2. Verify generation/retry/confirm/save-gonf auto-finalize behavior.
3. Verify persisted image association survives reload.

## Traceability

- Parent Ticket: GONF-009
- Related Tickets:
  1. GONF-009A
  2. GONF-009C
  3. GONF-009D
- Related Commits: [pending]
- Related PR/Code Review: [pending]
- QA Results: [pending]
- Bug Tickets: [pending]

## Status

- Current Status: Groomed
- Owner: Backend Developer
- Last Updated: 2026-07-14
- Branch Naming Target: feature/GONF-009B-backend-parity-migration-and-room-image-persistence
