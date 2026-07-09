# GONF-006D - Gonf Generator QA and Integration Strategy

## Business Objective

Define and execute QA strategy for Gonf Generator to ensure save/load correctness, map integrity, and non-regression across existing Gonf capabilities.

## Business Rules

1. QA must validate both functional behavior and graph-consistency outcomes.
2. Integration checks must run on branch before merge.
3. Blocking defects must prevent merge until fixed or explicitly accepted.
4. QA evidence must be recorded in ticket traceability.

## User Story

As QA
I want integration-focused coverage for Gonf Generator
So that new builds do not break existing behavior or room-graph consistency.

## Acceptance Criteria

1. QA test matrix maps all GONF-006B and GONF-006C AC to test cases.
2. Integration tests validate critical paths:
   - load existing Gonf
   - create room
   - save room with exits
   - bidirectional link integrity
   - map render by floor
3. Negative-path tests cover invalid file type, invalid Gonf JSON, duplicate room names, and missing Gonf Name.
4. Regression checks confirm existing schema preview workflow still operates.
5. QA publishes pass/fail cycles with defect references and retest outcomes.

## Edge Cases and Error Handling

1. Up/down transitions violate finalized floor constraints (-5, -4, -3, -2, -1, 1, 2, 3, 4, 5).
2. Exit links become one-way after edit.
3. Duplicate room names introduced by load + edit.
4. Save succeeds but map fails to render expected connections.

## Non-Functional Requirements

1. Integration suite is runnable in local and CI contexts.
2. Test outputs are deterministic and suitable for gate decisions.
3. Critical failures provide actionable diagnostics.
4. QA cycle reports include blockers, severity, and resolution state.

## Dependencies

1. GONF-006A finalized decisions.
2. GONF-006B backend contracts implemented.
3. GONF-006C frontend workflows implemented.

## Out of Scope

1. Load/performance benchmarking at scale.
2. Security penetration testing.
3. Browser matrix expansion beyond agreed baseline.

## Open Questions

1. Minimum integration coverage threshold for merge approval.
2. Snapshot strategy for map visualization verification.
3. Required manual exploratory checklist for each QA cycle.

## Architecture Notes

- QA suite should include endpoint integration tests and UI interaction tests.
- Add targeted contract assertions for save/load envelopes.
- Ensure branch-based QA evidence gates merge to main.

## QA Notes and Test Intent

1. Verify graph consistency invariants after each save/edit.
2. Verify error-to-guidance messaging quality.
3. Verify no regression in existing Gonf upload/schema preview flow.

## Traceability

- Parent Ticket: GONF-006
- Related Tickets:
  1. GONF-006A
  2. GONF-006B
  3. GONF-006C
- Related Commits: [pending]
- Related PR/Code Review: [pending]
- QA Results: [pending]
- Bug Tickets: [pending]

## Status

- Current Status: Draft
- Owner: QA
- Last Updated: 2026-07-09
- Branch Naming Target: feature/GONF-006D-qa-integration
