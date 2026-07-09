# GONF-001 - Thin Vertical Sprint: Upload JSON, Parse, Generate Minimal Schema, Preview

## Business Objective

Deliver an end-to-end first sprint increment that proves Gonf can convert uploaded JSON into a form schema preview.

## Business Rules

1. User can upload a JSON file from the UI.
2. API validates and parses uploaded JSON.
3. API generates a minimal schema from parsed JSON.
4. UI displays schema preview from API response.
5. Invalid JSON must not produce a schema and must show clear validation feedback.
6. Uploaded content for this ticket is processed in-memory only.
7. Null fallback mapping defaults are: empty string for string/date fields, 0 for numeric fields, and 0.00 for decimal fields.
8. Sprint 1 response payload includes minimal schema nodes for valid JSON.
9. Error handling must catch, log, and return user-friendly responses for 500, 404, and 502 error scenarios.

## User Story

As a form designer
I want to upload a JSON file and view a generated schema preview
So that I can quickly validate that Gonf can infer a usable form structure

## Acceptance Criteria

1. UI provides file upload input that accepts .json.
2. Uploading valid JSON calls backend endpoint successfully.
3. Backend returns minimal schema for valid JSON input.
4. Minimal schema includes field name, inferred type, and path.
5. UI renders returned schema in a readable preview list.
6. Invalid JSON returns a validation error response.
7. UI displays backend validation errors clearly.
8. API and UI handle empty upload gracefully with user-facing guidance.
9. No persistence is introduced for uploaded payloads in this ticket.
10. Root-level JSON arrays are supported and represented as repeatable fields (primitive items) or repeatable groups (object items).
11. Null values follow fallback defaults: empty string for string/date, 0 for numeric, and 0.00 for decimal.
12. Successful responses follow the expected Sprint 1 contract with code=200, success=true, errors as an empty array, and schema containing minimal schema nodes.
13. Error responses follow the expected contract with code set to the relevant error status, success=false, an errors array including code/message entries, and schema as an empty array.
14. Error scenarios 500, 404, and 502 are caught, logged, and presented in a user-friendly way.

## Edge Cases and Error Handling

1. Empty file upload returns validation error.
2. Malformed JSON returns parse error with safe message.
3. Nested objects are represented using stable property path notation.
4. Arrays of primitives are represented as repeatable fields.
5. Arrays of objects are represented as repeatable groups.
6. Root-level arrays are supported with the same repeatable mapping rules used for nested arrays.
7. Null values map using fallback defaults: empty string for string/date, 0 for numeric, and 0.00 for decimal.

## Non-Functional Requirements

1. For JSON files up to 1 MB, parse and schema generation completes within 2 seconds under normal local conditions.
2. API does not log full uploaded payload by default.
3. Validation and error messages are understandable to non-technical users.
4. UI preview is keyboard accessible for basic navigation.

## Dependencies

1. Backend endpoint in backend/Gonf.Api for upload/parse/schema generation.
2. Frontend upload and preview components in frontend/src.
3. Shared response contract between frontend and backend.

## Out of Scope

1. Editing generated schema.
2. Saving schemas.
3. Authentication/authorization.
4. Advanced inference (date detection, enum inference, custom validation rules).

## Open Questions

1. Root-level JSON arrays are supported in this first sprint.
  - Owner: Business Owner
  - Decision Date: 2026-07-08
2. What fallback mapping should be used for null values?
  - Decision: empty string for string/date, 0 for numeric, 0.00 for decimal
  - Owner: Business Owner
  - Decision Date: 2026-07-08

## Rework Required from Joint Review

This ticket was reviewed by BA, Dev Lead, and QA. Clarifications were completed and the ticket is approved for development.

1. Root-level array policy decision has been completed: supported in this sprint. Update Business Rules, AC, and Edge Cases to reflect this decision.
  - Owner: BA
  - Completed: 2026-07-08
2. Null fallback mapping must be explicitly defined and reflected in AC and Edge Cases.
  - Owner: BA
  - Completed: 2026-07-08
3. A single response schema contract for this ticket must be finalized with required fields only.
  - Owner: Business Owner
  - Completed: 2026-07-08
4. Minimum error response structure must be defined for malformed JSON and empty upload scenarios.
  - Owner: Business Owner
  - Completed: 2026-07-08
5. DoR evidence must match reality: open questions must be resolved or explicitly deferred with owner/date before dev start.
  - Owner: BA
  - Completed: 2026-07-08

## Architecture Notes

- Keep contract minimal and explicit: schema is a list of generated nodes.
- Expected successful response for this sprint:

```json
{
  "code": 200,
  "success": true,
  "errors": [],
  "schema": [
    {
      "path": "customer.firstName",
      "fieldName": "firstName",
      "inferredType": "string",
      "isArray": false,
      "isObject": false
    }
  ]
}
```

- Expected error response shape for this sprint:

```json
{
  "code": 400,
  "success": false,
  "errors": [
    {
      "code": "INVALID_JSON",
      "message": "Uploaded file is not valid JSON."
    }
  ],
  "schema": []
}
```

- Expected handled error classes in this sprint: 400, 404, 413, 500, 502.
- If contract shape changes across multiple tickets, create a dedicated architecture note and link it here.

## QA Notes and Test Intent

1. Validate happy path with flat JSON object.
2. Validate nested object and array handling.
3. Validate invalid JSON and empty file behavior.
4. Verify schema preview matches API response content.
5. Verify no persistence side effects from upload operation.

## Traceability

- Parent Ticket: GONF-001
- Branch: feature/GONF-001-thin-vertical-sprint
- Related Commits:
  1. 1cb5f70 - GONF-001: harden upload validation and malformed response handling
  2. 8b3fca9 - GONF-001: return client-appropriate error status codes
- Related PR/Code Review:
  1. Cross-functional review pass completed on feature branch
  2. Post-fix review pass completed after status-code correction
- Code Review Participants:
  1. Dev Lead: true
  2. Backend Developer: true
  3. Frontend Developer: true
- QA Results: In Progress
- Bug Tickets: [pending]

## Code Review Checklist (Cross-Functional)

1. API contract shape matches ticket expectations for success and error envelopes.
2. Frontend correctly handles API success, validation failure, and service error states.
3. Root-array and null fallback handling are consistent between backend inference and UI rendering.
4. Logging and user-facing error behavior remain user-friendly and non-leaky.
5. Unit tests cover new behavior and pass for both backend and frontend.
6. Build/test verification completed before review handoff.

## Delivery Gates

### Definition of Ready

- [x] Business objective/rules are clear
- [x] AC is testable and unambiguous
- [x] Scope and out-of-scope defined
- [x] Dependencies identified
- [x] Dev lead feasibility review complete
- [x] QA testability review complete
- [x] Open questions resolved or deferred with owner/date
- [x] Branch naming target defined

### Ready for QA

- [ ] Code merged after dev lead sign-off
- [x] Commit/review links added to ticket
- [x] Code reviewed by lead, backend dev, and frontend dev
- [ ] AC-to-change mapping provided
- [x] Developer test evidence attached
- [ ] Known limitations documented
- [x] QA test cases prepared
- [x] QA environment/config documented
- [x] Dev-review bugs fixed or tracked

## Status

- Current Status: QA Validation
- Owner: QA
- Last Updated: 2026-07-09
- Branch Naming Target: feature/GONF-001-thin-vertical-sprint
