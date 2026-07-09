# Gonf Ticket Template

## Title

[Ticket title]

## Business Objective

[What business value this ticket delivers]

## Business Rules

1. [Rule 1]
2. [Rule 2]
3. [Rule 3]

## User Story

As a [role]
I want [capability]
So that [business value]

## Acceptance Criteria

1. [Specific, testable condition]
2. [Specific, testable condition]
3. [Specific, testable condition]

## Edge Cases and Error Handling

1. [Edge case or failure scenario]
2. [Edge case or failure scenario]
3. [Edge case or failure scenario]

## Non-Functional Requirements

1. [Performance]
2. [Security]
3. [Accessibility]
4. [Reliability/observability]

## Dependencies

1. [Dependency]
2. [Dependency]

## Out of Scope

1. [Not included item]
2. [Not included item]

## Open Questions

1. [Question]
2. [Question]

## Architecture Notes

- [Short approach summary]
- [Contract or boundary notes]
- [Link to separate architecture note if needed]

## UI Mockup and Deck Artifacts (when UI is in scope)

- Static React mockup path: [frontend/src path]
- Figma file/frame link: [link]
- Deck image exports (PNG):
	1. [Empty state image]
	2. [Loading state image]
	3. [Success state image]
	4. [Error state image]

## QA Notes and Test Intent

1. [Test scenario]
2. [Test scenario]
3. [Test scenario]

## Traceability

- Parent Ticket: [id]
- Related Commits: [list]
- Related PR/Code Review: [list]
- QA Results: [link or summary]
- Bug Tickets: [list]

## Delivery Gates

### Definition of Ready

- [ ] Business objective/rules are clear
- [ ] AC is testable and unambiguous
- [ ] Scope and out-of-scope defined
- [ ] Dependencies identified
- [ ] Dev lead feasibility review complete
- [ ] QA testability review complete
- [ ] Open questions resolved or deferred with owner/date
- [ ] Branch naming target defined

### Ready for QA

- [ ] Code merged after dev lead sign-off
- [ ] Commit/review links added to ticket
- [ ] AC-to-change mapping provided
- [ ] Developer test evidence attached
- [ ] Unit tests for new development are present and passing
- [ ] Known limitations documented
- [ ] QA test cases prepared
- [ ] QA environment/config documented
- [ ] Dev-review bugs fixed or tracked

### Commit Guardrail

- [ ] Pre-commit test gate passed

### Unit Test Coverage Notes

- Backend test project(s): [path]
- Frontend test file(s): [path]
- New behavior covered: [summary]

## Status

- Current Status: [Draft | Rework | Ready for Development | In Development | In Review | Merged for QA | In QA | UAT Approved | Closed | Invalid]
- Owner: [role/person]
- Last Updated: [yyyy-mm-dd]
