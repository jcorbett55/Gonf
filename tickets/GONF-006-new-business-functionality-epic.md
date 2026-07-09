# GONF-006 - New Business Functionality Epic

## Epic Objective

Capture and deliver newly requested business functionality that takes priority over currently queued GONF-002 and GONF-003 work.

## Priority and Sequencing Decision

1. This epic is now the highest priority business initiative.
2. Work on GONF-002 and GONF-003 is paused until this epic is decomposed and initial delivery tickets are in progress.
3. BA team will create and refine child tickets under this epic.

## Business Context

New business functionality has been requested and approved to precede remaining planned hardening and UX backlog items.

## In Scope (Epic Level)

1. BA-led discovery and requirement capture for the new functionality.
2. Definition of business rules, constraints, and acceptance boundaries.
3. Ticket decomposition into implementation-ready stories.
4. Cross-functional review for feasibility and testability before development begins.

## Out of Scope (Epic Level)

1. Direct implementation details in this epic document.
2. Technical design specifics that belong in child tickets.
3. Reprioritizing unrelated closed tickets.

## BA Deliverables

1. Epic brief with clear business value statement.
2. Child ticket set with acceptance criteria and dependencies.
3. Sequenced delivery plan (MVP-first where possible).
4. Open questions register with owner and decision date.
5. Traceability map from epic to child tickets.

## Development Guidance (Readability)

1. Add brief intent-focused comments for non-obvious logic and behavior changes.
2. Comments should explain why the change exists and reference the ticket when relevant.
3. Prefer concrete wording patterns such as:
  - "Updated this function for GONF-0012 by adding null checks to avoid runtime failures."
  - "This method renders the Gonf map view and connection overlays."
4. Avoid noisy comments that restate obvious syntax; prioritize comments that help reviewers and future maintainers.

## Child Ticket Plan

1. GONF-006A - Discovery and finalized business rules [Draft]
2. GONF-006B - Core backend/API scope [In Progress (Dev)]
3. GONF-006C - Core frontend/UI scope [In Progress (Dev)]
4. GONF-006D - QA and integration coverage scope [Draft]

## Dependencies

1. Business Owner confirmation of functional boundaries.
2. Dev Lead feasibility review.
3. QA testability review.

## Traceability

- Epic ID: GONF-006
- Parent: Program Backlog Prioritization Update (2026-07-09)
- Related Tickets:
  1. GONF-002 (Paused)
  2. GONF-003 (Paused)
  3. GONF-006A
  4. GONF-006B
  5. GONF-006C
  6. GONF-006D

## Status

- Current Status: In Progress (BA Discovery)
- Owner: Business Analyst
- Last Updated: 2026-07-09
- Branch Naming Target: feature/GONF-006-epic-intake
