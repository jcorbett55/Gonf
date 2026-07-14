# GONF-009C - UI Parity and Room Image Preview/Retry/Confirm Controls

## Business Objective

Deliver V2 frontend with full V1 parity and add room image preview controls in room details so users can retry, confirm, and persist room visuals.

## Business Rules

1. Existing V1 UI behavior for rooms/items/characters/map/save/load remains intact in V2.
2. Save Room keeps current behavior (room saved + map updated) and then requests room image candidate generation.
3. Room details panel (on room-square click) displays:
   - Candidate/finalized room image at top
   - Retry icon
   - Checkmark icon
4. Retry icon requests a new candidate image for the current room.
5. Checkmark icon confirms/finalizes current candidate image.
6. Save Gonf triggers backend auto-finalization for rooms with unconfirmed candidates.
7. Reloaded Gonf displays associated finalized room image when room details open.
8. UX should clearly indicate states: generating, candidate ready, finalized, error.
9. Save Gonf clicked during image generation must show "finalizing image" progress and complete after backend wait/finalize behavior finishes.
10. Retry during in-flight generation is disabled until current generation resolves.

## User Story

As a user
I want to preview and approve room images from the room details panel
So room visuals are consistent and under my control before and after saving.

## Acceptance Criteria

1. Existing V1 UI test flows for rooms/items/characters continue to pass.
2. Save Room initiates image generation request with room context.
3. Room details panel shows image preview region at top.
4. Retry icon issues retry request and updates preview.
5. Checkmark icon finalizes current preview and updates state indicator.
6. Save Gonf from UI works even if user did not click Retry or Checkmark, with backend auto-finalize behavior reflected in UI.
7. Loading an existing Gonf repopulates room image associations.
8. Error states are actionable and do not break room editing workflow.
9. Accessibility support is present for preview controls (keyboard and labels).
10. UI state machine is explicitly implemented and testable for states:
  - idle (no image)
  - generating
  - candidate-ready
  - finalized
  - error
11. Retry control is disabled while generating and enabled only in candidate-ready or finalized states.
12. Save Gonf flow surfaces wait/finalize progress when room generation is in-flight.

## Edge Cases and Error Handling

1. User opens room details before first candidate is available.
2. Retry clicked repeatedly while generation is pending.
3. User switches rooms while generation is pending.
4. Save Gonf clicked during generation.
5. Missing image file on disk when opening room details.

## Non-Functional Requirements

1. UI remains responsive during image generation and retry operations.
2. State transitions are deterministic and testable.
3. Existing map rendering readability remains unchanged.

## Dependencies

1. Finalized rules from GONF-009A.
2. Backend generation/finalization APIs from GONF-009B.
3. QA verification from GONF-009D.

## Out of Scope

1. Character/item image overlays.
2. Hotspot authoring and rendering.
3. In-canvas image editing tools.

## Open Questions

1. Final icon artwork for Retry and Checkmark controls.
2. Whether to show retry attempt count in details panel.

## Architecture Notes

- Keep room state and image state in a unified room-details model.
- Reuse current status/error message patterns for consistency.

## QA Notes and Test Intent

1. Validate parity workflows plus room image UI states.
2. Validate retry/confirm controls and save-gonf auto-finalize visibility.
3. Validate load behavior for previously finalized images.

## Traceability

- Parent Ticket: GONF-009
- Related Tickets:
  1. GONF-009A
  2. GONF-009B
  3. GONF-009D
- Related Commits: [pending]
- Related PR/Code Review: [pending]
- QA Results: [pending]
- Bug Tickets: [pending]

## Status

- Current Status: Ready for Dev
- Owner: Frontend Developer
- Last Updated: 2026-07-14
- Branch Naming Target: feature/GONF-009C-ui-parity-and-room-image-preview-controls
