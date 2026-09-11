---
description: "Use when grooming tickets, implementing backend/frontend work, reviewing code, or validating QA for the Gonf project. Defines the Gonf team operating model, ticket lifecycle, gates, and traceability standards."
name: "Gonf Team Operating Model"
---

# Gonf Team Operating Model

## Purpose

Define how business objectives become tickets, code, tests, and promotion decisions.

## Team Roles

- Business Owner: Provides business objectives, rules, constraints, and final business-direction decisions.
- Business Analyst (BA): Converts objectives into actionable tickets and acceptance criteria.
- Dev Lead (Architect): Validates ticket feasibility, defines architecture approach, assigns work, and holds code review sign-off authority.
- Backend Developer: Implements backend/API ticket work and prepares review-ready backend changes.
- Frontend Developer: Implements frontend/UI ticket work, provides UI mockups for business review, and drives overall UI look and feel.
- QA: Defines and executes test coverage, determines promotion to UAT, and creates bug tickets when needed.

Integration-testing ownership model:
- QA owns integration test planning, coverage definition, and pass/fail decisioning.
- Backend and frontend developers own implementation support for test harnesses and stable test hooks.
- Dev lead approves required integration coverage for cross-service or API contract changes.

## Ticket Source of Truth

- The ticket is the primary source of truth for implementation and testing.
- Any business-rule changes must be reflected in the ticket.
- Substantial rule changes should usually create a new ticket.
- If new rules materially conflict with the current ticket:
  1. Mark current ticket as invalid/closed.
  2. BA creates a replacement ticket.
  3. Old ticket links to the new ticket.
  4. New ticket goes through full lifecycle gates again.

## Ticket Lifecycle

1. Draft
- BA writes the ticket using the standard template.

2. Feasibility Review
- Dev lead reviews for clarity, scope, dependencies, and architecture risks.
- Dev lead may reject the ticket as not ready for development.
- Rejection must include concrete reasons and required rework.
- Rejected tickets move to rework.

3. Rework
- Business Owner, BA, and Dev lead align unresolved gaps.
- QA may also reject ticket readiness if use cases are not testable.

4. Ready for Development
- Ticket passes Definition of Ready.

5. In Development
- Backend and frontend developers implement on ticket-specific branches as assigned.

6. Code Review Gate
- Backend and frontend developers can commit to their branches.
- Git commit is blocked unless required unit tests exist and pass.
- Merge is blocked until review is approved.
- Dev lead holds code review sign-off authority.
- All development members participate in review for each ticket: Dev Lead, Backend Developer, Frontend Developer.
- Cross-review is required for API/UI contract compatibility and integration risk detection.

7. QA Validation on Branch
- After dev lead approval, QA validates the ticket branch prior to merge.
- QA can approve for merge or open bug tickets.

8. Merged After QA
- Once QA passes branch validation, change is merged to main.

9. UAT Ready
- QA approves promotion to UAT.

## Definition of Ready (DoR)

A ticket is ready for development only if all checks pass:

1. Ticket has clear business objective and rules.
2. Acceptance criteria are testable and unambiguous.
3. Scope and out-of-scope are explicit.
4. Dependencies are identified.
5. Dev lead has reviewed feasibility and architecture approach.
6. QA has reviewed for testability.
7. Open questions are resolved or explicitly deferred with owner/date.
8. Branch naming target is defined for the ticket.

## Ready for QA Gate

A change is ready for QA only if all checks pass:

1. Code is review-approved on the ticket branch after dev lead sign-off.
2. Ticket links all related commits and review outcomes.
3. Acceptance criteria mapping is provided.
4. Developer test evidence is attached.
5. Unit tests for new development are present and passing.
6. Known limitations or deferred items are documented.
7. QA test cases are prepared from the approved ticket.
8. Environment/config required for QA is provided.
9. Bugs found during dev review are fixed or tracked.
10. Integration/contract regression checks are defined for impacted dependencies.

## Merge Gate After QA

A change can be merged to main only if all checks pass:

1. QA branch validation is complete with no blocking defects.
2. Any QA defects are fixed or explicitly accepted by Business Owner and QA.
3. Ticket traceability includes QA evidence and review outcomes.

## Frontend Standards

- Frontend developer is expected to stay current with modern frontend technology and best practices.
- Frontend unit testing framework should be used where possible (Vitest + Testing Library in this repo).
- UI mockups should be produced for business review when introducing or changing key interface flows.
- Default mockup workflow is React static page first (with mock data), then Figma mirror for review decks.
- Business review decks should include exported Figma images for key states (empty, loading, success, error).

## UI Mockup Deliverables

For tickets that introduce or materially change UI:

1. Static React mockup implementation in `frontend/src` using mock data.
2. Figma board/frame(s) aligned to the React mockup.
3. Deck-ready image exports from Figma (PNG) for business review.
4. Ticket traceability links to both code mockup and Figma/deck artifacts.

## Commit Guardrails

- Repository uses a pre-commit hook to enforce unit test checks.
- If tests fail, commit is rejected.
- If required test projects/scripts are missing, commit is rejected until tests are added.
- Enable in a Git repo with: `git config core.hooksPath .githooks`

## Traceability Standard

Traceability level: Standard.

Each ticket must track:

- Related commits
- PR/review decision outcomes
- Review participants (Lead, Backend Dev, Frontend Dev)
- QA results
- Related bug tickets

## Branching Rules

- One working branch per active ticket.
- If a ticket is invalid/closed and replaced:
  - Keep old work on a separate branch named with old ticket id.
  - Create a new branch for the replacement ticket.

## Architecture Decision Logging

Moderate model:

- Ticket includes concise architecture notes.
- Separate architecture note is required for cross-cutting or high-impact decisions.
- Related tickets must link to architecture notes.

## Initial Delivery Slice

First delivery slice is a thin vertical slice:

1. Upload JSON in UI.
2. Parse JSON in API.
3. Generate minimal schema.
4. Show schema preview in UI.
