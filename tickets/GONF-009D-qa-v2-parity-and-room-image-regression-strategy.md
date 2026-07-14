# GONF-009D - QA V2 Parity and Room Image Regression Strategy

## Business Objective

Define and execute QA strategy that first proves full V1 parity in V2, then validates room image generation, retry/confirm, persistence, and load consistency.

## Business Rules

1. QA sequence is mandatory:
   - Stage 1: V1 parity verification (rooms/items/characters/map/save/load)
   - Stage 2: Room image feature validation
2. Merge is blocked if parity regressions are unresolved.
3. Image feature sign-off requires end-to-end validation of generation, retry, confirm, auto-finalize, and reload behavior.

## User Story

As QA
I want parity-first and image-feature integration coverage
So V2 adds visuals without destabilizing existing functionality.

## Acceptance Criteria

1. QA matrix maps GONF-009B and GONF-009C criteria to explicit tests.
2. Parity regression suite passes for rooms/items/characters workflows.
3. Save Room generation flow is validated.
4. Retry behavior and attempt increments are validated.
5. Checkmark finalization behavior is validated.
6. Save Gonf auto-finalization of unconfirmed images is validated.
7. Image path write behavior is validated against required path:
   - C:\gonf\\[gonf_name]\img\
8. Load behavior validates room-image association persistence.
9. Negative-path tests cover provider failures, missing files, and permissions errors.
10. QA evidence includes pass/fail cycles and defect links.

## Edge Cases and Error Handling

1. Legacy Gonf file without image metadata.
2. Room with many retries before finalization.
3. Save Gonf with multiple rooms in mixed image states.
4. Disk/path permission failure during image write.
5. Deleted/missing image file during load/open-details.

## Non-Functional Requirements

1. Tests are deterministic and reproducible.
2. CI pipeline includes parity and image-feature regression gates.
3. Manual exploratory checklist exists for image UI controls.

## Dependencies

1. Finalized rules from GONF-009A.
2. Backend implementation from GONF-009B.
3. Frontend implementation from GONF-009C.

## Out of Scope

1. Performance load testing beyond agreed baseline.
2. Cross-browser expansion beyond existing baseline.
3. Character/item image feature testing.

## Open Questions

1. Minimum automated coverage threshold for V2 release gate.
2. Whether visual snapshot tests are required for room details image panel.

## Architecture Notes

- Pair API contract tests with UI integration tests.
- Keep explicit assertions for parity and room-image persistence boundaries.

## QA Notes and Test Intent

1. Prove parity first, then image feature correctness.
2. Validate save/load consistency across repeated edit sessions.
3. Validate resilient user guidance on generation or file-system failures.

## Traceability

- Parent Ticket: GONF-009
- Related Tickets:
  1. GONF-009A
  2. GONF-009B
  3. GONF-009C
- Related Commits: [pending]
- Related PR/Code Review: [pending]
- QA Results: [pending]
- Bug Tickets: [pending]

## Status

- Current Status: Groomed
- Owner: QA
- Last Updated: 2026-07-14
- Branch Naming Target: feature/GONF-009D-qa-v2-parity-and-room-image-regression-strategy
