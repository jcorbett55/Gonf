# GONF-009 Grooming Outcomes (Dev + QA)

## Session Summary

Date: 2026-07-14  
Attendees: Dev lead perspective, backend perspective, frontend perspective, QA perspective (ticket review pass)  
Scope reviewed: GONF-009, GONF-009A, GONF-009B, GONF-009C, GONF-009D

## Readiness Assessment

1. Scope clarity: Mostly clear.
2. Requirement clarity: Partially clear.
3. Acceptance-criteria testability: Good baseline, but several criteria need measurable definitions.
4. Overall status: Conditionally Ready (requires clarifications below before implementation begins).

## Findings (Ordered by Risk)

1. Blocking: Parity acceptance gate is not objectively defined.
- Impact: Teams can disagree on whether V1 parity is complete before room-image work begins.
- Affected tickets: GONF-009, GONF-009A, GONF-009D.
- Needed clarification: Define a parity checklist artifact and explicit sign-off rule (for example, all existing V1 automated tests passing plus QA parity checklist complete).

2. Blocking: Image candidate lifecycle storage is underspecified.
- Impact: Unclear where candidate images live before Checkmark and what gets persisted on Save Gonf auto-finalize.
- Affected tickets: GONF-009A, GONF-009B, GONF-009C.
- Needed clarification: Define candidate storage location/policy and cleanup behavior.

3. Blocking: Save Gonf during in-flight generation has no deterministic rule.
- Impact: Race condition; different implementations may finalize different images or fail inconsistently.
- Affected tickets: GONF-009A, GONF-009B, GONF-009C, GONF-009D.
- Needed clarification: Choose one behavior:
  - Wait for in-flight generation then finalize latest candidate.
  - Cancel in-flight generation and finalize last completed candidate.
  - Fail Save Gonf with actionable message.

4. High: Retry semantics are ambiguous for "different image".
- Impact: QA cannot write deterministic pass/fail if retry may return nearly identical output.
- Affected tickets: GONF-009B, GONF-009C, GONF-009D.
- Needed clarification: Define acceptable retry behavior (for example, different seed recorded and attempt index increments, without visual uniqueness guarantee).

5. High: File naming rule conflicts with room rename behavior.
- Impact: If room name changes, mapping may drift or produce duplicate naming.
- Affected tickets: GONF-009A, GONF-009B.
- Needed clarification: Include stable room identifier in filename (recommended: r[roomId]_[slug]_[attempt].png) while keeping roomId as canonical key in JSON.

6. Medium: API contract is referenced but not explicitly listed.
- Impact: Frontend/backend integration risk and rework.
- Affected tickets: GONF-009B, GONF-009C.
- Needed clarification: Define request/response DTOs and error codes for generate, retry, confirm, and save-gonf auto-finalize outcomes.

7. Medium: QA release gate thresholds are unresolved.
- Impact: Release readiness can become subjective.
- Affected tickets: GONF-009D.
- Needed clarification: Define minimum automated test pass threshold and whether snapshot tests are required.

## Grooming Decisions Proposed

1. Parity gate: V2 image feature work cannot start until parity checklist is signed off by QA.
2. Retry behavior: Retry must increment attempt index and record seed/model metadata; visual uniqueness is best effort.
3. Save Gonf during generation: Save waits for active generation to finish, then auto-finalizes the newest candidate.
4. Naming rule: Use roomId + room slug + attempt index.
5. JSON backward compatibility: Missing image metadata on legacy files must default to "no image" and load without warnings.

## Ticket Update Recommendations

1. Update GONF-009A open questions into finalized decisions.
2. Add explicit API/DTO acceptance criteria to GONF-009B.
3. Add explicit UI state-machine acceptance criteria to GONF-009C (idle, generating, candidate-ready, finalized, error).
4. Add parity checklist artifact requirement to GONF-009D and release gate thresholds.

## Ready/Not-Ready by Ticket

1. GONF-009 Epic: Ready with noted clarifications.
2. GONF-009A: Not ready until open questions are resolved.
3. GONF-009B: Conditionally ready; API contract details needed.
4. GONF-009C: Conditionally ready; state transition specifics needed.
5. GONF-009D: Conditionally ready; release thresholds needed.

## Action Items

1. BA/Owner: Resolve blocking clarifications and convert to final decisions in 009A.
2. Backend: Draft DTO/error contract for generate/retry/confirm/auto-finalize.
3. Frontend: Draft UI state model and disable/guard behavior for in-flight actions.
4. QA: Publish parity checklist and V2 release gate thresholds.
