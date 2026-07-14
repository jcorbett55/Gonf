# Project Delivery Playbook

This playbook captures reusable lessons learned for how a project should be groomed, developed, and tested overall.

## Core Rules

1. End grooming with decisions, not discussion.
2. Treat the ticket as the shared contract across business, development, and QA.
3. Decompose complex features into role-specific child work with shared traceability.
4. Build and test for success paths, failure modes, and regressions.
5. Require evidence at each handoff.

## Project Profile Model

Use one of two profile modes per project while keeping common team behavior intact:

1. Generalized profile
- Default constraints and standard delivery pace.
- Suitable for new and mixed codebases.

2. Legacy profile
- Adds discovery, compatibility, and risk controls.
- Optimized for systems with high coupling, fragile dependencies, or limited test confidence.

Both profiles should remain operational in either environment by preserving the same role handoffs and quality gates.

## Grooming Standard

Every implementation-ready ticket should include:

1. Business objective.
2. Business rules.
3. User story.
4. Testable acceptance criteria.
5. Edge cases and error handling.
6. Non-functional requirements.
7. Dependencies.
8. Out-of-scope boundaries.
9. Open questions.
10. Decision log when business rules were clarified over time.

## Delivery Lifecycle

1. Discovery
- Clarify rules, terms, and boundaries.
- Separate confirmed decisions from unresolved questions.

2. Feasibility Review
- Dev lead checks implementability, dependency impact, and risk.
- QA checks whether the feature can be validated with objective evidence.

3. Decomposition
- Split work into implementation slices by responsibility.
- Keep one parent objective and trace every child ticket back to it.

4. Implementation
- Developers map code changes to acceptance criteria.
- Developers implement validation, compatibility, and failure handling as part of the feature.
- Developers add focused tests for success and failure paths.

5. Review
- Review verifies requirement fidelity, architectural boundaries, and regression risk.
- Missing test evidence is treated as a delivery gap.

6. QA Validation
- QA validates the new feature and the previously working flows it could affect.
- Integration checks are required for changed boundaries or contracts.

7. Merge and Promotion
- Merge requires review evidence, test evidence, and QA outcome.
- Promotion requires defect disposition and traceability.

## Role-Specific Lessons

### Business Analyst

- Convert rules into observable outcomes.
- Capture failure conditions early.
- Mark open questions as blocking or non-blocking.
- Produce requirements that can be implemented without guessing.

### Dev Lead

- Reject vague but plausible tickets.
- Normalize cross-layer behavior into one canonical rule statement.
- Break work into slices that can be proven independently.
- Review code for requirement fit and regression risk, not just style.

### Developers

- Build against acceptance criteria plus failure modes, not just the happy path.
- Treat validation, error handling, and backward compatibility as first-class work.
- Expose contract changes early.
- Prefer small increments with focused validation.

### QA

- Test the feature in the context of the system it changes.
- Derive coverage from explicit rules, edge cases, and regression risks.
- Keep execution evidence reproducible.
- Write defects so developers can reproduce and retest quickly.

## Standalone Agent Use

Any role file should still be useful when used alone in another project.

To support that:

1. Each agent should restate its mission, inputs, outputs, workflow, and quality gates.
2. Each agent should include a standalone mode for missing upstream or downstream artifacts.
3. Each agent should document assumptions normally handled by adjacent roles.
4. Each agent should emit outputs that can seed the next role even when the next role file is absent.

## Minimum Handoff Package

Use these minimum artifacts between roles:

1. BA to Dev Lead: business rules, acceptance criteria, edge cases, open questions, dependencies.
2. Dev Lead to Developers: approved scope, architecture constraints, sequencing, contract notes, risk callouts.
3. Developers to QA: acceptance criteria mapping, test evidence, known limitations, changed boundaries.
4. QA to Team: pass or fail outcome, evidence, defect list, regression status, retest notes.

## Traceability Standard

Each ticket should link to:

1. Parent objective or epic.
2. Child tickets.
3. Commits or changesets.
4. Review outcomes.
5. QA results.
6. Defects.

## Adoption Guidance

When using this playbook in a new project:

1. Keep the structure stable even if the stack changes.
2. Replace tool-specific examples with the project's actual toolchain.
3. Set explicit quality thresholds early, such as required automation scope or branch gates.
4. Update the role files only when the operating model changes, not on every feature.

## Legacy Delivery Additions

Apply these additions when operating in legacy mode:

1. Discovery baseline before implementation
- Capture current behavior, boundaries, unsafe areas, and dependency hotspots.

2. Change budget discipline
- Default to smallest safe diff and smallest boundary crossing set.

3. Compatibility and rollback requirements
- Require explicit API and data compatibility checks plus rollback notes.

4. Risk-based regression selection
- Prioritize smoke and high-risk paths when full legacy suites are expensive.

5. Observability-first completion
- Include logs, metrics, traces, and runbook deltas for changed critical flows.

## Legacy Team Setup 1-4

Use this setup to make the team effective in legacy systems without guess-driven changes.

1. Legacy Baseline Discovery
- Build an architecture map: modules, boundaries, dependencies, and external integrations.
- Build a code ownership map: endpoints to handlers, services, repositories, models, and tests.
- Publish a top-risk list: fragile areas, hidden coupling, and known incident-prone paths.
- Define a baseline artifact set to keep current: change-surface map, contract map, regression matrix.

2. Ticket Gating and Delivery Rules
- No implementation starts until ticket scope, affected boundaries, and compatibility expectations are explicit.
- Every ticket must include change-surface notes: what files and contracts are expected to change.
- Require compatibility notes for API, data, and consumer behavior in non-trivial tickets.
- Require rollback notes for high-risk or contract-touching tickets.

3. CI and Verification Controls
- Run required checks for changed surfaces: build, targeted unit tests, and impacted integration tests.
- Add contract drift checks where applicable for request and response schema changes.
- Enforce smoke tests for critical legacy flows on merge candidates.
- Fail delivery when required evidence is missing for compatibility or regression validation.

4. Ongoing Maintenance Cadence
- Update architecture and code ownership maps as part of definition of done.
- Run periodic legacy map reviews to remove stale assumptions and confirm dependency boundaries.
- Track recurring defects by changed boundary to improve risk-based test selection.
- Keep the setup lightweight by updating only touched areas instead of full rewrites.
