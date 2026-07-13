# GONF-008B - Backend Character Model, Validation, and Persistence

## Business Objective

Extend backend save/load behavior to persist expanded character data with Gonf JSON while preserving existing room and item functionality.

## Business Rules

1. Save Gonf writes rooms, items, and characters into [gonf-name].json under C:\Gonf.
2. Save creates C:\Gonf if it does not exist.
3. Character location is optional in request payload.
4. If character location is provided, it must reference a valid roomId.
5. If character location is omitted or empty, persisted character location defaults to Secret Storage roomId, and Secret Storage is created if missing.
6. Character contains is optional and defaults to an empty list.
7. If contains is provided, every itemId must reference a valid item in the same Gonf.
8. Item assignment is one-place only; an itemId may be referenced either by a room location or one character contains list, never multiple places simultaneously.
9. On item reassignment to a character, backend removes prior room location and prior character contains references for that itemId.
10. Wanderer is persisted as data only in this epic, with no backend movement behavior.
11. Validation errors return machine-readable code plus user-facing guidance.

## User Story

As a user
I want saved Gonfs to include expanded character data and location defaults
So character placement and carried items are preserved across sessions.

## Acceptance Criteria

1. Save endpoint accepts and persists character collection with expanded fields.
2. Load path returns character collection with Gonf payload.
3. Validation rejects invalid character location references.
4. Validation rejects invalid contains item references.
5. Empty character location is normalized to Secret Storage on save, including auto-create of Secret Storage when missing.
6. Item reassignment is normalized so each itemId has a single active assignment after save.
7. Wanderer value persists and reloads unchanged.
8. Persistence remains backward compatible for legacy files with missing character fields.
9. Save success response includes user-facing confirmation.
10. Error handling includes user-friendly messages for file-system failures.
11. Automated tests cover positive/negative character save/load paths.

## Edge Cases and Error Handling

1. Character location roomId does not exist.
2. Character contains list includes unknown itemIds.
3. Payload includes malformed wanderer values.
4. Secret Storage does not yet exist when defaulting location.
5. Item is in a room and becomes assigned to a character in the same save.
6. Item is reassigned from one character to another in the same save.
7. Save fails because access denied or disk full.

## Non-Functional Requirements

1. Save/load behavior remains deterministic.
2. Data format supports future character feature expansion.
3. Existing room/item saves continue to function.

## Dependencies

1. Finalized rules from GONF-008A.
2. Frontend payload alignment from GONF-008C.
3. QA verification from GONF-008D.

## Out of Scope

1. Server-side character AI behavior.
2. Multi-user concurrency controls.
3. Cloud sync behavior.

## Open Questions

1. Whether empty description should be normalized to empty string or null.

## Architecture Notes

- Preserve envelope/error response consistency with current API behavior.
- Keep save path policy aligned with existing C:\Gonf requirement.

## QA Notes and Test Intent

1. Validate save/load parity for rooms + items + characters.
2. Validate invalid location and invalid contains handling.
3. Validate backward compatibility with existing Gonf files.

## Traceability

- Parent Ticket: GONF-008
- Related Tickets:
  1. GONF-008A
  2. GONF-008C
  3. GONF-008D
- Related Commits: [pending]
- Related PR/Code Review: [pending]
- QA Results: [pending]
- Bug Tickets: [pending]

## Status

- Current Status: Ready for Dev
- Owner: Backend Developer
- Last Updated: 2026-07-13
- Branch Naming Target: feature/GONF-008B-backend-character-model-and-persistence
