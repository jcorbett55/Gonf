# GONF-006B - Gonf Generator Backend, Validation, and Save/Load Behavior

## Business Objective

Deliver backend behavior for Gonf Generator so users can load, validate, save, and persist Gonf room maps safely and consistently.

## Business Rules

1. Save requires Gonf Name and valid room data.
2. Room ID is system-managed and assigned on save when creating new rooms.
3. Room Name must be unique within a Gonf.
4. Exits (north, east, south, west, up, down) must reference valid room IDs.
5. Saving a room must maintain bidirectional connection consistency.
6. Vertical transitions must skip floor 0 using rule: if floor +/- 1 = 0, use floor +/- 2.
7. Invalid uploads or invalid Gonf payloads must return actionable errors.
8. Save destination is C:\Gonf for all Gonf JSON files.
9. If C:\Gonf does not exist, it must be created automatically before save.
10. Load validation must enforce Gonf signature fields (`format=Gonf`, `schemaVersion=1.0`).
11. Unknown schema versions must be rejected.

## User Story

As a user of Gonf Generator
I want save/load to correctly preserve room graph relationships
So that my Gonf can be edited over time without broken navigation links.

## Acceptance Criteria

1. Backend supports loading existing Gonf JSON and validating Gonf schema.
2. Load validation rejects payloads missing required signature fields (`format`, `schemaVersion`) or with unsupported `schemaVersion`.
3. Backend save operation assigns `roomId = max(existing) + 1` for new room inserts.
4. Backend enforces unique room names.
5. Backend updates opposite-direction links when an exit is set:
   - north <-> south
   - east <-> west
   - up <-> down
6. Backend applies floor-0 skip behavior for vertical exits:
   - up target floor = current + 1, except when result is 0 then current + 2
   - down target floor = current - 1, except when result is 0 then current - 2
7. Backend allows blank exits (no connection).
8. Save writes to C:\Gonf\[gonf-name].json.
9. If C:\Gonf does not exist, save operation creates the folder and then writes file.
10. Save overwrites existing C:\Gonf\[gonf-name].json if found; otherwise creates it.
11. Save returns success envelope with user-facing confirmation message.
12. Validation and persistence errors return machine code + user guidance.
13. Error taxonomy includes at minimum:
   - `INVALID_FILE_TYPE`
   - `INVALID_GONF_SIGNATURE`
   - `UNSUPPORTED_GONF_SCHEMA_VERSION`
   - `DUPLICATE_ROOM_NAME`
   - `INVALID_ROOM_FLOOR`
   - `INVALID_EXIT_REFERENCE`
14. Automated tests cover load validation, signature/version checks, ID assignment, link synchronization, folder auto-create, and overwrite/create behavior.

## Edge Cases and Error Handling

1. Upload extension is `.json` but schema is not Gonf-compliant.
2. Gonf name contains invalid filename characters.
3. Circular room references.
4. Exit points to room on disallowed floor transition (outside -5, -4, -3, -2, -1, 1, 2, 3, 4, 5).
5. Concurrent saves to same Gonf name.
6. Save fails due to folder permission or file lock in C:\Gonf.

## Non-Functional Requirements

1. Save and load complete within acceptable local baseline for moderate room counts.
2. Data writes are atomic to avoid partially-written Gonf files.
3. Validation errors are deterministic and stable for UI handling.
4. Logging avoids leaking sensitive local file system details to users.

## Dependencies

1. Resolved discovery decisions from GONF-006A.
2. Frontend contract alignment with GONF-006C.
3. QA integration coverage from GONF-006D.

## Out of Scope

1. Multi-user collaboration/locking.
2. Cloud storage integration.
3. Authorization model changes.

## Open Questions

1. Maximum allowed room count per Gonf for MVP.
2. Conflict strategy when a save would overwrite externally modified file content.

## Architecture Notes

- Treat Gonf as graph + floor metadata with normalized room entities.
- Introduce explicit DTOs/contracts for load/save requests and responses.
- Include graph consistency checks before persisting output.

## QA Notes and Test Intent

1. Validate bidirectional link synchronization across all directions.
2. Validate ID assignment sequence and uniqueness.
3. Validate file overwrite and create paths.
4. Validate load failures for invalid schema.

## Traceability

- Parent Ticket: GONF-006
- Related Tickets:
  1. GONF-006A
  2. GONF-006C
  3. GONF-006D
- Related Commits: [pending]
- Related PR/Code Review: Passed (Dev review gate 2026-07-10)
- QA Results: Ready for QA (handoff 2026-07-10)
- Bug Tickets: [pending]

## Status

- Current Status: Ready for QA
- Owner: Backend Developer
- Last Updated: 2026-07-10
- Branch Naming Target: feature/GONF-006B-backend-save-load
