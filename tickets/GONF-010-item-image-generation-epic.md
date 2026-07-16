# GONF-010 - Item Image Generation Epic

## Epic Objective

Add Item image generation to Gonf Generator using the same async provider workflow established for room and character images, including immediate placeholder previews while final images are generated.

## Priority and Sequencing Decision

1. This epic follows completion of character image generation patterns.
2. Item image generation should reuse the established async job architecture and UI interaction model where practical.
3. Existing room and character image workflows must remain stable and backward compatible.

## Business Context

Business wants authored items to have visual previews so game designers can quickly understand and validate item identity and tone while editing Gonf content.

## In Scope (Epic Level)

1. Item image generation request flow using existing IMPS/A1111 provider path.
2. Async job lifecycle for items (queued, processing, completed, failed).
3. Immediate placeholder preview while item image generation is in progress.
4. Retry and confirm behavior for item image candidates.
5. Save/Load persistence updates for item image metadata and image file references.
6. Compatibility handling for existing Gonf files that do not include item image fields.
7. QA regression coverage for item image generation and save/load integrity.

## Out of Scope (Epic Level)

1. Bulk image generation for every item in one action.
2. Prompt-engineering UI for custom negative prompts per item.
3. New provider infrastructure beyond current image pipeline.

## BA Deliverables

1. Final item-image acceptance rules for placeholder, retry, and confirm lifecycle.
2. Clarified UX behavior for item image preview placement in item workflows.
3. Error-handling expectations for long-running generation jobs and failed provider responses.
4. Acceptance-ready decomposition for backend/frontend/QA child stories.

## Development Workflow Rule

1. For every active story, all code changes must be done on a dedicated branch named after the ticket being worked.
2. Example branch format: feature/GONF-010C-ui-item-image-workflow.
3. Do not mix multiple story implementations on a single branch.

## Child Ticket Plan

1. GONF-010A - Discovery and item image business rules [Draft]
2. GONF-010B - Backend item image generation and persistence [Draft]
3. GONF-010C - UI item image workflow and placeholder behavior [Draft]
4. GONF-010D - QA integration and regression strategy for item images [Draft]

## Dependencies

1. Existing async image generation architecture from room/character implementations.
2. Item domain and persistence baseline from GONF-007.
3. Business validation and QA sign-off.

## Traceability

- Epic ID: GONF-010
- Parent: GONF-009 Delivered Character Image Baseline
- Related Tickets:
  1. GONF-007B
  2. GONF-007C
  3. GONF-007D
  4. GONF-010A
  5. GONF-010B
  6. GONF-010C
  7. GONF-010D

## Status

- Current Status: Ready for Dev
- Owner: Business Analyst
- Last Updated: 2026-07-16
- Branch Naming Target: feature/GONF-010-epic-item-image-generation
