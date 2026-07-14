# {{PROJECT_NAME}} Team Operating Model

## Purpose

Define how business objectives become tickets, code, tests, and promotion decisions.

## Delivery Principles

- End grooming with explicit decisions, not implied understanding.
- Treat the ticket as the shared contract across BA, development, and QA.
- Decompose features into role-specific work that still traces back to one parent objective.
- Build and test against success paths, failure modes, and regression risks.
- Preserve traceability from decision to implementation to validation.

## Team Roles

- Business Owner: Provides business objectives, rules, constraints, and final business-direction decisions.
- Business Analyst (BA): Converts objectives into actionable tickets and acceptance criteria.
- Dev Lead (Architect): Validates ticket feasibility, defines architecture approach, assigns work, and holds code review sign-off authority.
- Backend Developer: Implements backend or service ticket work and prepares review-ready changes.
- Frontend Developer: Implements frontend or UX ticket work, provides mockups for business review when needed, and drives visual consistency.
- QA: Defines and executes test coverage, determines promotion readiness, and creates bug tickets when needed.

## Ticket Source of Truth

- The ticket is the primary source of truth for implementation and testing.
- Any business-rule changes must be reflected in the ticket.
- Substantial rule changes should usually create a new ticket.

## Ticket Lifecycle

1. Draft
- BA writes the ticket using the standard template.

2. Feasibility Review
- Dev lead reviews for clarity, scope, dependencies, and architecture risks.
- Rejections must include concrete reasons and required rework.

3. Rework
- Business Owner, BA, and Dev lead align unresolved gaps.
- QA may reject ticket readiness if use cases are not testable.

4. Ready for Development
- Ticket passes Definition of Ready.

5. In Development
- Backend and frontend developers implement on ticket-specific branches as assigned.

6. Code Review Gate
- Dev lead holds review sign-off authority.
- Required unit tests must exist and pass before commit.
- Cross-review is required for contract compatibility and integration risks.

7. QA Validation on Branch
- QA validates ticket branch behavior before merge.

8. Merged After QA
- Once QA passes branch validation, change is merged to main.

9. Promotion Ready
- QA approves promotion readiness for the next environment.

## Definition of Ready (DoR)

A ticket is ready for development only if all checks pass:

1. Ticket has clear business objective and rules.
2. Acceptance criteria are testable and unambiguous.
3. Failure modes and edge cases are identified.
4. Scope and out-of-scope are explicit.
5. Dependencies are identified.
6. Dev lead has reviewed feasibility and architecture approach.
7. QA has reviewed for testability.
8. Open questions are resolved or explicitly deferred with owner and date.
9. Blocking questions are clearly separated from non-blocking questions.

## Ready for QA Gate

A change is ready for QA only if all checks pass:

1. Code is review-approved on the ticket branch after dev lead sign-off.
2. Acceptance criteria mapping is provided.
3. Failure-mode and regression expectations are documented.
4. Developer test evidence is attached.
5. Unit tests for new development are present and passing.
6. Known limitations or deferred items are documented.
7. QA test cases are prepared from the approved ticket.

## Merge Gate After QA

A change can be merged only if all checks pass:

1. QA branch validation is complete with no blocking defects.
2. QA defects are fixed or explicitly accepted by the business owner and QA.
3. Ticket traceability includes QA evidence and review outcomes.

## Role-to-Path Mapping

- Backend implementation path: {{BACKEND_PATH}}
- Frontend implementation path: {{FRONTEND_PATH}}

Replace these values when adopting the model in a new repository.

