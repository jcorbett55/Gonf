# GONF-006A - Gonf Generator Discovery and Finalized Business Rules

## Business Objective

Finalize business rules and decision points for Gonf Generator (GG) so implementation tickets are unambiguous and testable.

## Business Rules

1. GG is a new navigable section in the Gonf web application.
2. GG must support creating a new Gonf and loading an existing Gonf JSON file.
3. A Gonf consists of rooms, floor assignments, directional exits, and map-level metadata.
4. Room names must be unique within a Gonf.
5. Save behavior must preserve two-way room connections.

## User Story

As a business owner
I want the BA team to capture and finalize GG rules
So that implementation can proceed without requirement ambiguity.

## Acceptance Criteria

1. Discovery output captures all requested GG behaviors from intake notes.
2. Decision log resolves directional, floor, and file-handling ambiguities.
3. BA publishes finalized glossary and field definitions for Gonf/Room/Exit/Floor.
4. BA confirms decomposition boundaries for backend, frontend, and QA tickets.
5. Child tickets GONF-006B/006C/006D are updated with resolved decisions.

## Edge Cases and Error Handling

1. Uploaded file is not `.json`.
2. Uploaded JSON is valid JSON but not valid Gonf schema.
3. Duplicate room names are attempted.
4. Room exits reference missing rooms.

## Non-Functional Requirements

1. Rules are written in business-testable language.
2. Decision log includes owner and decision date for each unresolved item.
3. Ticket outputs are sufficient for dev lead feasibility and QA testability review.
4. Traceability links all child tickets back to GONF-006.

## Dependencies

1. Business Owner decisions on open questions.
2. Dev lead feasibility review.
3. QA testability review.

## Out of Scope

1. Code implementation.
2. UI visual polish decisions not required for MVP behavior.
3. Deployment and hosting model changes.

## Open Questions

1. What defines a valid "Gonf JSON" signature/schema for load validation?

## Decision Log

1. Floors are finalized as 10 floors total with no floor 0:
  -5, -4, -3, -2, -1, 1, 2, 3, 4, 5
  - Owner: Business Owner
  - Decision Date: 2026-07-09
  - Notes: Negative values represent subground floors.

2. East exit is required on the room form and in room-linking behavior.
  - Owner: Business Owner
  - Decision Date: 2026-07-09
  - Notes: Horizontal directions are north, east, south, and west.

3. Vertical floor transition rule skips floor 0:
  - Up candidates: current floor + 1; if result is 0 then use +2.
  - Down candidates: current floor - 1; if result is 0 then use -2.
  - Owner: Business Owner
  - Decision Date: 2026-07-09
  - Notes: Floor 0 does not exist in GG.

4. Save destination is server-side folder C:\Gonf.
  - If C:\Gonf does not exist, the application creates it before save.
  - Subsequent saves always target C:\Gonf.
  - Owner: Business Owner
  - Decision Date: 2026-07-09

## Architecture Notes

- This ticket defines business-rule truth and decision log only.
- Technical implementation detail is delegated to GONF-006B and GONF-006C.
- QA validation strategy is delegated to GONF-006D.

## QA Notes and Test Intent

1. Ensure each finalized rule can be mapped to at least one test case.
2. Ensure ambiguity list is fully resolved before implementation starts.
3. Ensure child tickets inherit resolved decisions consistently.

## Traceability

- Parent Ticket: GONF-006
- Related Tickets:
  1. GONF-006B
  2. GONF-006C
  3. GONF-006D
- Related Commits: [pending]
- Related PR/Code Review: [pending]
- QA Results: [pending]
- Bug Tickets: [pending]

## Status

- Current Status: Draft (BA Discovery)
- Owner: Business Analyst
- Last Updated: 2026-07-09
- Branch Naming Target: feature/GONF-006A-discovery
