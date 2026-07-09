# GONF-004 - Integration Test Foundation and Regression Gates

## Business Objective

Establish integration testing that detects breaking behavior across API/UI boundaries before merge and before QA/UAT promotion.

## User Story

As a QA lead
I want repeatable integration tests for critical flows and dependencies
So that new builds do not break existing behavior or dependent connections.

## Scope

1. Define integration coverage matrix for current critical flows:
   - JSON upload -> API parse -> schema preview rendering
2. Add backend API integration tests for key response contracts and status codes.
3. Add frontend integration-style tests for API contract compatibility and malformed responses.
4. Add CI/local gate command(s) for integration test execution.
5. Document troubleshooting guidance for failed integration checks.

## Acceptance Criteria

1. A documented integration coverage matrix exists and is linked in this ticket.
2. Backend integration tests validate endpoint-level status behavior for:
   - invalid JSON -> 400
   - empty/missing file -> 400
   - oversized payload -> 413
3. Backend integration tests validate success envelope contract for valid JSON upload.
4. Frontend integration tests validate graceful handling of:
   - validation errors
   - malformed successful payloads
   - network failures
5. Integration test command(s) are documented and runnable locally.
6. Integration checks are included in pre-merge quality evidence.

## Out of Scope

1. Full end-to-end browser automation.
2. Performance/load testing.
3. External service dependency testing (none in current sprint).

## Dependencies

1. GONF-001 implementation branch and contracts.
2. Existing backend xUnit and frontend Vitest setup.

## Ownership

- QA: Defines coverage matrix and pass/fail criteria.
- Backend Developer: Implements backend integration test harness.
- Frontend Developer: Implements frontend integration/contract checks.
- Dev Lead: Signs off integration coverage completeness.

## Test Intent

1. Protect API contract stability.
2. Prevent accidental status-code regressions.
3. Catch UI/API compatibility breaks early.

## Traceability

- Parent Initiative: Quality and Release Safety
- Related Tickets:
  1. GONF-001

## Status

- Current Status: Draft
- Owner: QA
- Last Updated: 2026-07-09
- Branch Naming Target: feature/GONF-004-integration-test-foundation
