# GONF-007A - Items Discovery and Business Rules

## Business Objective

Define the item model and interaction rules so implementation is unambiguous and testable.

## Business Rules

1. An item has: name, weight, description, value, can hold items (boolean), can be carried (boolean), and optional location (roomId).
2. `location` is optional.
3. If `location` is provided, it must reference a valid existing roomId.
4. An item can be assigned to zero or one room only.
5. Item records are part of a Gonf and persist with rooms.
6. Item list shown for a room is derived from item location.

## User Story

As a business owner
I want item behaviors documented clearly
So that backend and frontend teams implement the same rules.

## Acceptance Criteria

1. Item field definitions are finalized with types and requiredness.
2. Location behavior is finalized for optional room assignment and invalid roomId handling.
3. Save/load JSON contract includes items alongside rooms.
4. UI behavior for room dropdown selection, map item indicator, and click-to-list is finalized.
5. Child tickets 007B/007C/007D inherit finalized rules.

## Edge Cases and Error Handling

1. Item references a non-existent roomId.
2. Room is deleted or changed while items still reference it.
3. Empty item list for a room.
4. Items with large descriptions or long names.

## Non-Functional Requirements

1. Rules are business-testable and deterministic.
2. Definitions are compatible with current Gonf JSON structure.
3. Rule set is complete enough for QA matrix creation.

## Dependencies

1. Business owner confirmation on item behavior details.
2. Dev lead review for technical feasibility.
3. QA review for testability.

## Out of Scope

1. Nested inventory semantics beyond boolean flag.
2. Item animation/advanced visual effects.
3. Cross-Gonf item transfers.

## Open Questions

1. Are item names unique globally in a Gonf or only by room?
2. Numeric bounds for `weight` and `value`.

## Architecture Notes

- This story is requirements-only and should not include implementation.
- Backend/frontend contracts are detailed in 007B and 007C.

## QA Notes and Test Intent

1. Ensure each item rule maps to explicit test cases.
2. Ensure unresolved questions are closed before implementation.

## Traceability

- Parent Ticket: GONF-007
- Related Tickets:
  1. GONF-007B
  2. GONF-007C
  3. GONF-007D
- Related Commits: [pending]
- Related PR/Code Review: [pending]
- QA Results: [pending]
- Bug Tickets: [pending]

## Status

- Current Status: Ready for Dev
- Owner: Business Analyst
- Last Updated: 2026-07-10
- Branch Naming Target: feature/GONF-007A-items-discovery-and-business-rules
