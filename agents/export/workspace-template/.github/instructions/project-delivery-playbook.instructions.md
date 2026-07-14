---
description: "Use when grooming features, decomposing work, implementing against acceptance criteria, reviewing code for regression risk, or building QA coverage. Covers project delivery playbook guidance across BA, dev lead, developers, frontend, and QA."
name: "Project Delivery Playbook"
---

# Project Delivery Playbook

- End grooming with explicit decisions, not implied understanding.
- Treat the ticket as the shared contract across business, development, and QA.
- Decompose complex features into role-specific child work with shared traceability.
- Build and test for success paths, failure modes, and regressions.
- Require evidence at each handoff.

## Minimum Ticket Contents

- Business objective
- Business rules
- Testable acceptance criteria
- Edge cases and error handling
- Non-functional requirements
- Dependencies
- Out-of-scope boundaries
- Open questions and decision log when needed

## Delivery Expectations

- BA resolves or explicitly tracks decision points.
- Dev lead checks feasibility, boundaries, and dependency risks.
- Developers implement validation, compatibility, and failure handling as part of the feature.
- QA validates both the new feature and nearby regression risks.
- Every handoff includes traceable evidence.

## Standalone Role Guidance

- A single imported agent should restate assumptions that would normally be covered by adjacent roles.
- Missing upstream or downstream artifacts should be called out explicitly, not guessed silently.
- Outputs should still be structured so another team member can pick up the work later.
