# GONF-009 - Character Image Generation Epic

## Epic Objective

Add Character image generation to Gonf Generator using the same async provider flow used for rooms, including immediate placeholder visuals while final renders are generated.

## Priority and Sequencing Decision

1. This epic extends delivered room-image generation capabilities.
2. Character image generation should follow the same architecture: async queue/job polling, non-blocking UI, and persistence updates.
3. Item image generation is intentionally excluded and must be delivered in a separate epic ticket.

## Business Context

Business wants Characters to have generated image previews in the same way rooms do, so users can quickly visualize character identity while authoring Gonf data.

## In Scope (Epic Level)

1. Character image generation request flow using existing image provider integration.
2. Async job lifecycle for characters (queued, processing, completed, failed) aligned to room-image behavior.
3. Placeholder preview shown immediately while generation is in progress.
4. Retry and confirm interactions for character image candidates.
5. Save/Load persistence updates for character image metadata and file references.
6. Backward-compatible handling for existing Gonf files without character image data.
7. QA regression coverage for character image generation and related save/load flows.

## Out of Scope (Epic Level)

1. Item image generation.
2. Batch generation of all characters in a single operation.
3. New image provider infrastructure beyond current IMPS/A1111 integration.

## BA Deliverables

1. Final character-image acceptance rules for placeholder, retry, and confirm behavior.
2. UI behavior clarification for where character previews are shown and edited.
3. Validation and error-message expectations for long-running and failed image jobs.
4. Acceptance-ready decomposition for backend/frontend/QA child stories.

## Development Workflow Rule

1. For every active story, all code changes must be done on a dedicated branch named after the ticket being worked.
2. Example branch format: feature/GONF-009C-ui-character-image-workflow.
3. Do not mix multiple story implementations on a single branch.

## Child Ticket Plan

1. GONF-009A - Discovery and character image business rules [Draft]
2. GONF-009B - Backend character image generation and persistence [Draft]
3. GONF-009C - UI character image workflow and placeholder behavior [Draft]
4. GONF-009D - QA integration and regression strategy for character images [Draft]

## Planned Follow-On Epic

1. Item image generation will be handled in a separate future epic ticket (proposed: GONF-010 - Item Image Generation Epic).

## Dependencies

1. Existing room-image async job pipeline and IMPS provider integration.
2. Character domain model and tabs delivered in GONF-008.
3. Business validation and QA sign-off.

## Traceability

- Epic ID: GONF-009
- Parent: GONF-008 Delivered Character Baseline
- Related Tickets:
  1. GONF-008B
  2. GONF-008C
  3. GONF-008D
  4. GONF-009A
  5. GONF-009B
  6. GONF-009C
  7. GONF-009D

## Status

- Current Status: Ready for Dev
- Owner: Business Analyst
- Last Updated: 2026-07-16
- Branch Naming Target: feature/GONF-009-epic-character-image-generation
