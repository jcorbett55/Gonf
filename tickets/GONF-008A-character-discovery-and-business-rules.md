# GONF-008A - Character Discovery and Business Rules

## Business Objective

Define the expanded character model and interaction rules so implementation is unambiguous and testable.

## Business Rules

1. A character has: name, description, location (optional roomId), wanderer (boolean), and contains (list of itemIds carried).
2. Character name is required.
3. Location can be empty at authoring time.
4. If location is provided, it must reference a valid existing roomId.
5. If location is empty at save time, character defaults to Secret Storage.
6. Contains values must reference valid existing itemIds.
7. A character can carry zero or more items in contains.
8. Character list shown for a room is derived from character location.

## User Story

As a business owner
I want character behaviors documented clearly
So backend and frontend teams implement the same rules.

## Acceptance Criteria

1. Character field definitions are finalized with types and requiredness.
2. Location behavior is finalized for optional assignment, defaulting to Secret Storage, and invalid roomId handling.
3. Contains behavior is finalized for valid item references and empty-list handling.
4. UI interaction behavior for character icon click and room-details listing is finalized.
5. Child tickets 008B/008C/008D inherit finalized rules.

## Edge Cases and Error Handling

1. Character location references a non-existent roomId.
2. Contains references one or more non-existent itemIds.
3. Secret Storage room is missing before character save with empty location.
4. Character with empty contains list.
5. Character with long description or name.

## Non-Functional Requirements

1. Rules are business-testable and deterministic.
2. Definitions are compatible with current Gonf JSON structure.
3. Rule set is complete enough for QA matrix creation.

## Dependencies

1. Business owner confirmation on character behavior details.
2. Dev lead review for technical feasibility.
3. QA review for testability.

## Out of Scope

1. NPC AI decision trees.
2. Combat and dialog systems.
3. Runtime movement simulation for wanderers.

## Open Questions

1. Are character names unique globally in a Gonf?
2. Should contains allow duplicate itemIds?
3. Maximum supported contains list size for UI display.

## Architecture Notes

- This story is requirements-only and should not include implementation.
- Backend/frontend contracts are detailed in 008B and 008C.

## QA Notes and Test Intent

1. Ensure each character rule maps to explicit test cases.
2. Ensure unresolved questions are closed before implementation.

## Traceability

- Parent Ticket: GONF-008
- Related Tickets:
  1. GONF-008B
  2. GONF-008C
  3. GONF-008D
- Related Commits: [pending]
- Related PR/Code Review: [pending]
- QA Results: [pending]
- Bug Tickets: [pending]

## Status

- Current Status: Ready for Dev
- Owner: Business Analyst
- Last Updated: 2026-07-13
- Branch Naming Target: feature/GONF-008A-character-discovery-and-business-rules
