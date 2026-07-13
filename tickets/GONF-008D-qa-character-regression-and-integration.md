# GONF-008D - QA Character Regression and Integration Strategy

## Business Objective

Define and execute QA coverage for expanded character workflows while protecting existing Gonf room, item, and save/load behavior.

## Business Rules

1. QA must verify characters, rooms, items, map indicators, and save/load as a single integrated flow.
2. Regression checks for existing room and item workflows are required before merge.
3. Blocking defects halt merge unless explicitly accepted.

## User Story

As QA
I want character-enabled integration tests
So new character features do not break current Gonf functionality.

## Acceptance Criteria

1. QA matrix maps GONF-008B and GONF-008C acceptance criteria to tests.
2. Test coverage includes create character, clear character form, location validation/defaulting, map icon behavior, and room character list display.
3. Save/load validation confirms rooms, items, and characters persist/reload correctly.
4. Negative-path tests cover invalid character location and invalid contains references.
5. Regression confirms room editing, item workflows, room exits, and map rendering remain functional.
6. QA evidence includes pass/fail cycles and defect references.
7. QA verifies empty character location defaults to Secret Storage and auto-creates Secret Storage when missing.
8. QA verifies item reassignment rules: assigning an item to a character removes prior room location and prior character references.
9. QA verifies wanderer field persistence only (save/load), with no movement behavior expectations.
10. QA verifies character icon click shows room-specific character list and carried items details.

## Edge Cases and Error Handling

1. Room with many characters.
2. Character with long description and large contains list.
3. Legacy Gonf file with missing character fields.
4. Character points to deleted/invalid room id.
5. Contains references deleted/invalid item id.
6. Item moves from room location to character contains assignment.
7. Item moves from one character to another character assignment.

## Non-Functional Requirements

1. Test outputs are deterministic and reproducible.
2. Manual checklist is explicit for UI interactions.
3. Integration suite is runnable locally and in CI.

## Dependencies

1. Rules finalized in GONF-008A.
2. Backend implementation in GONF-008B.
3. Frontend implementation in GONF-008C.

## Out of Scope

1. Performance benchmark testing at scale.
2. Security penetration testing.
3. Cross-browser matrix expansion beyond agreed baseline.

## Open Questions

1. Minimum coverage threshold for QA sign-off.
2. Whether UI snapshot testing is required for character indicators.

## Architecture Notes

- Combine API validation tests with UI interaction tests.
- Keep explicit checks for C:\Gonf save behavior in character scenarios.

## QA Notes and Test Intent

1. Verify character indicator appears only for rooms with located characters.
2. Verify icon click shows room-specific character list in details area.
3. Verify carried items are shown under each character details block.
4. Verify Save Character with empty location creates Secret Storage when needed and assigns character to it.
5. Verify item reassignment removes previous room/character references and leaves one active owner per item.
6. Verify wanderer save/load persistence without movement assertions.
7. Verify Save Gonf writes rooms + items + characters in one payload.
8. Verify no regressions in prior GONF-006 and GONF-007 behaviors.

## Traceability

- Parent Ticket: GONF-008
- Related Tickets:
  1. GONF-008A
  2. GONF-008B
  3. GONF-008C
- Related Commits: [pending]
- Related PR/Code Review: [pending]
- QA Results: [pending]
- Bug Tickets: [pending]

## Status

- Current Status: Ready for QA
- Owner: QA
- Last Updated: 2026-07-13
- Branch Naming Target: feature/GONF-008D-qa-character-regression-and-integration
