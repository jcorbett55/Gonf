# GONF-005 - Missing File Validation Returns 500

## Business Objective

Ensure missing-upload requests are treated as user validation errors and return the expected client status code and error contract.

## Problem Statement

During QA Cycle 2 for GONF-001, sending a POST request to `/api/schema/preview` without a file returns:
- HTTP 500
- error code `SERVER_ERROR`

Expected behavior is:
- HTTP 400
- error code `FILE_REQUIRED`

## Impact

1. Breaks expected validation contract for client-side error handling.
2. Misclassifies user input issues as server failures.
3. Risks incorrect monitoring and retry behavior.

## Reproduction

1. Send `POST /api/schema/preview` with no multipart file payload.
2. Observe response currently returns 500 with `SERVER_ERROR`.

## Expected Result

Response should return:

```json
{
  "code": 400,
  "success": false,
  "errors": [
    {
      "code": "FILE_REQUIRED",
      "message": "Please choose a JSON file to continue."
    }
  ],
  "schema": []
}
```

## Acceptance Criteria

1. Missing file request returns HTTP 400.
2. Error envelope includes `FILE_REQUIRED` code and user-friendly message.
3. Existing valid/invalid/empty/oversize scenarios remain unchanged.
4. Add backend endpoint-level integration test proving missing file behavior.

## QA Notes

- Severity: High
- Source: GONF-001 QA Cycle 2
- Blocks QA pass for GONF-001 until fixed and retested.

## Traceability

- Parent Ticket: GONF-001
- Discovered In: QA Cycle 2 (2026-07-09)
- Branch Target: feature/GONF-005-missing-file-validation
- Related Commits:
  1. [pending push] GONF-005 fix + endpoint integration tests
- Developer Test Evidence:
  1. `dotnet test Gonf.slnx --nologo` -> PASS (9 passed, 0 failed)

## Status

- Current Status: In Review
- Owner: Dev Lead
- Last Updated: 2026-07-09
