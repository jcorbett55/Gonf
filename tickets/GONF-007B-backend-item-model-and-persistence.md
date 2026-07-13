# GONF-007B - Backend Item Model, Validation, and Persistence

## Business Objective

Extend backend save/load behavior to persist item data with Gonf JSON while preserving existing room functionality.

## Business Rules

1. Save Gonf writes both rooms and items into `[gonf-name].json` under `C:\Gonf`.
2. Save creates `C:\Gonf` if it does not exist.
3. Item location is optional.
4. If item location is provided, it must reference a valid roomId.
5. An item may be assigned to at most one room.
4. Validation errors return machine-readable code plus user-facing guidance.

## User Story

As a user
I want saved Gonfs to include items and their room locations
So item placement is preserved across sessions.

## Acceptance Criteria

1. Save endpoint accepts and persists item collection.
2. Load path returns item collection with Gonf payload.
3. Validation rejects invalid item location references.
4. Validation rejects malformed item payloads (type/required field issues).
5. Persistence remains backward compatible for legacy files with no items.
6. Save success response includes user-facing confirmation.
7. Error handling includes user-friendly messages for file-system failures.
8. Automated tests cover positive/negative item save/load paths.
9. Payload validation allows items with no room assignment.
10. Payload validation rejects items assigned to multiple rooms or multiple room ids.

## Edge Cases and Error Handling

1. Item location roomId does not exist.
2. Item payload present but missing required fields.
3. Invalid numeric values for weight or value.
4. Item has no room assignment.
5. Item is sent with more than one room assignment.
6. Save fails because access denied or disk full.

## Non-Functional Requirements

1. Save/load behavior remains deterministic.
2. Data format supports future item feature expansion.
3. Existing room-only saves continue to function.

## Dependencies

1. Finalized rules from GONF-007A.
2. Frontend payload alignment from GONF-007C.
3. QA verification from GONF-007D.

## Out of Scope

1. Server-side item search/indexing features.
2. Multi-user concurrency controls.
3. Cloud sync behavior.

## Open Questions

1. Weight/value allowed precision and minimums.
2. Whether empty string descriptions are valid.

## Architecture Notes

- Preserve envelope/error response consistency with current API behavior.
- Keep save path policy aligned with existing `C:\Gonf` requirement.

## QA Notes and Test Intent

1. Validate save/load parity for rooms + items.
2. Validate invalid location and malformed item handling.
3. Validate backward compatibility with existing Gonf files.

## Traceability

- Parent Ticket: GONF-007
- Related Tickets:
  1. GONF-007A
  2. GONF-007C
  3. GONF-007D
- Related Commits: [pending]
- Related PR/Code Review: [pending]
- QA Results: [pending]
- Bug Tickets: [pending]

## Status

- Current Status: Ready for Dev
- Owner: Backend Developer
- Last Updated: 2026-07-10
- Branch Naming Target: feature/GONF-007B-backend-item-model-and-persistence
