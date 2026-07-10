# GONF-007D - QA Items Regression and Integration Strategy

## Business Objective

Define and execute QA coverage for item workflows while protecting existing Gonf room and save/load behavior.

## Business Rules

1. QA must verify items, rooms, map indicators, and save/load as a single integrated flow.
2. Regression checks for existing room workflows are required before merge.
3. Blocking defects halt merge unless explicitly accepted.

## User Story

As QA
I want item-enabled integration tests
So new item features do not break current Gonf functionality.

## Acceptance Criteria

1. QA matrix maps GONF-007B and GONF-007C acceptance criteria to tests.
2. Test coverage includes create item, clear item form, map icon behavior, and room item list display.
3. Save/load validation confirms both rooms and items persist/reload correctly.
4. Negative-path tests cover invalid item payloads and invalid location references.
5. Regression confirms room editing, room exits, and map rendering remain functional.
6. QA evidence includes pass/fail cycles and defect references.
7. QA verifies item location is optional, but when set must point to a valid room.
8. QA verifies all rooms are available in the item location dropdown regardless of floor.
9. QA verifies an item cannot be assigned to more than one room.

## Edge Cases and Error Handling

1. Room with many items.
2. Item with long description and large numeric values.
3. Legacy Gonf file with no items.
4. Item points to deleted/invalid room id.
5. Item has no room assignment.
6. Item payload attempts multiple room assignments.

## Non-Functional Requirements

1. Test outputs are deterministic and reproducible.
2. Manual checklist is explicit for UI interactions.
3. Integration suite is runnable locally and in CI.

## Dependencies

1. Rules finalized in GONF-007A.
2. Backend implementation in GONF-007B.
3. Frontend implementation in GONF-007C.

## Out of Scope

1. Performance benchmark testing at scale.
2. Security penetration testing.
3. Cross-browser matrix expansion beyond agreed baseline.

## Open Questions

1. Minimum coverage threshold for QA sign-off.
2. Whether UI snapshot testing is required for item icons.

## Architecture Notes

- Combine API validation tests with UI interaction tests.
- Keep explicit checks for C:\Gonf save behavior in item scenarios.

## QA Notes and Test Intent

1. Verify item indicator appears only for rooms with located items.
2. Verify icon click shows room-specific item list in details area.
3. Verify Save Gonf writes rooms + items in one payload.
4. Verify no regressions in prior GONF-006 behaviors.
5. Verify item location dropdown lists all rooms and does not filter by floor.

## Traceability

- Parent Ticket: GONF-007
- Related Tickets:
  1. GONF-007A
  2. GONF-007B
  3. GONF-007C
- Related Commits: [pending]
- Related PR/Code Review: [pending]
- QA Results: [pending]
- Bug Tickets: [pending]

## Status

- Current Status: Ready for QA
- Owner: QA
- Last Updated: 2026-07-10
- Branch Naming Target: feature/GONF-007D-qa-items-integration
