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
4. Validation includes signature/version checks for `format=Gonf` and `schemaVersion=1.0`, with unknown versions rejected.
5. Regression checks confirm existing schema preview workflow still operates.
6. QA publishes pass/fail cycles with defect references and retest outcomes.

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
4. Verify east/west linkage behavior is symmetric and rendered correctly.
5. Verify vertical exit filtering and linkage skip floor 0 using +/-2 fallback.
6. Verify save path behavior uses C:\Gonf, including folder auto-create when missing.
7. Verify invalid signature/version payloads return correct machine error codes and user guidance.

## QA Execution Checklist (Live)

Execution Date: 2026-07-09

1. [x] Automated: Frontend tests pass (`npm.cmd run test:run`)
2. [x] Automated: Backend integration tests pass (`dotnet test backend/Gonf.Api.Tests/Gonf.Api.Tests.csproj`)
3. [x] Environment: Local API and frontend are running for manual QA
4. [ ] Manual: Open `Gonf Generator` section from main app navigation
5. [ ] Manual: Click `Create New Gonf` and verify form reset/start state
6. [ ] Manual: Add room details (name, description, floor, exits) and verify field behavior
7. [ ] Manual: Verify floor tabs filter map and room popup details update on click
8. [ ] Manual: Verify connector lines render between connected rooms on same floor
9. [ ] Manual: Verify `Save Room` and `Clear` behavior messaging and outcomes
10. [ ] Manual: Load a valid Gonf JSON and verify state population
11. [ ] Manual: Negative test invalid file type and invalid Gonf payload handling
12. [ ] Regression: Confirm schema preview workflow still works

## QA Defect Log (Live)

1. [pending] No defects logged yet.

## Official Review Cycle

1. Review Date: 2026-07-10
2. Scope: GONF-006B and GONF-006C branch implementation
3. Result: In Progress (no new defects identified in current pass)
4. Evidence:
  - Frontend tests passing (`npm.cmd run test:run`)
  - Backend tests validated when API process lock is cleared
5. Follow-up: Complete manual QA checklist items and log pass/fail + defects.
6. Intake Update: GONF-006B and GONF-006C moved to QA handoff after passing dev review gate on 2026-07-10.

## Traceability

- Parent Ticket: GONF-006
- Related Tickets:
  1. GONF-006A
  2. GONF-006B
  3. GONF-006C
- Related Commits: [pending]
- Related PR/Code Review: In Progress (Official review cycle opened 2026-07-10)
- QA Results: In Progress (see live checklist above)
- Bug Tickets: [pending]

## Status

- Current Status: In Progress (QA Execution)
- Current Status: In Progress (QA Execution + Official Review)
- Owner: QA
- Last Updated: 2026-07-10
- Branch Naming Target: feature/GONF-006D-qa-integration
