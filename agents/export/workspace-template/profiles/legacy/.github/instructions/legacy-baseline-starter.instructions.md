---
name: "Legacy Baseline Starter"
description: "Use at project start to build architecture and code-level legacy baseline artifacts before implementation work begins."
---

# Legacy Baseline Starter

Use this checklist to establish a practical legacy baseline without stalling delivery.

## 1. Architecture Baseline

- Identify primary modules and boundaries.
- List external integrations and dependent systems.
- Mark high-coupling or fragile areas.
- Capture deployment and operational constraints.

Output:
- Architecture boundary map.
- Dependency and risk hotspot list.

## 2. Code Ownership Baseline

- Map key API routes to handlers, services, repositories, and models.
- Map critical business workflows to concrete code paths.
- Identify validation, mapping, and persistence touchpoints.
- Identify current automated tests covering these paths.

Output:
- Endpoint-to-code ownership map.
- Critical flow code-path index.

## 3. Contract and Data Baseline

- Document current request and response contracts for critical endpoints.
- Identify consumers and compatibility constraints.
- Identify data model and schema assumptions tied to those endpoints.
- Mark likely rollback concerns for contract or data changes.

Output:
- Contract baseline summary.
- Data compatibility and rollback notes.

## 4. Regression Baseline

- Define must-run smoke tests for critical user and system flows.
- Define high-risk regression checks for fragile boundaries.
- Map each critical flow to at least one automated validation path.
- Capture known test gaps with severity and owner.

Output:
- Legacy regression matrix.
- Test-gap backlog list.

## 5. Delivery Gate Activation

Before implementation work starts for any high-impact ticket, confirm:

- Affected boundaries are identified.
- Expected change surface is documented.
- Compatibility expectations are explicit.
- Rollback notes are prepared when risk is high.
- Required CI checks are listed.

## 6. Maintenance Cadence

- Update only touched areas of baseline artifacts per completed ticket.
- Review risk hotspots and regression matrix on a regular cadence.
- Track recurring defects by boundary and feed results into test prioritization.
- Remove stale assumptions and obsolete entries during each review cycle.

## Done Criteria

Baseline setup is complete when all outputs exist and are usable by BA, dev lead, developers, and QA without requiring guesswork for the next ticket.
