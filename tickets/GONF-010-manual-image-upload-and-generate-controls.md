```markdown
# GONF-010 - Manual Image Upload and Generate Controls (Rooms, Characters, Items)

## Business Objective

Replace automatic image-candidate generation on Save with explicit user-triggered controls, and extend image support (upload and generate) to items for the first time. Users choose either "Upload Image" or "Generate Image" per room, character, or item instead of Gonf automatically calling the image generation provider on save.

## Supersession Notice

This ticket **supersedes** the following business rules from [GONF-009C](./GONF-009C-ui-parity-and-room-image-preview-controls.md):

- Rule 2: "Save Room keeps current behavior (room saved + map updated) and then requests room image candidate generation." - No longer automatic; image generation is now only requested when the user clicks "Generate Image".
- Rule 6: "Save Gonf triggers backend auto-finalization for rooms with unconfirmed candidates." - Superseded to the extent it assumed an automatically-started candidate; auto-finalization of an existing in-flight/unconfirmed candidate (started manually) may still apply and should be re-confirmed during implementation.

GONF-009C is left unmodified as a historical record. This ticket is the authoritative source for the new manual-trigger behavior going forward, for rooms, characters, and (newly) items.

## Business Rules

1. Automatic image-candidate generation on Save Room / Save Character (and any future Save Item) is removed. Saving an entity no longer implicitly requests an image.
2. Each room, character, and item detail panel displays two explicit controls: "Upload Image" and "Generate Image".
3. "Generate Image" uses the existing async provider job workflow (queue, poll, candidate-ready, retry, confirm) unchanged in mechanics - it is simply now user-triggered instead of automatic.
4. "Upload Image" allows the user to select a local image file of type `.png`, `.jpeg`, or `.gif`, with a maximum size of 2MB.
5. Uploaded files are validated client-side (extension allow-list and size) before submission; the server performs a minimal authoritative check (size and content-type/extension) before accepting the file.
6. On successful upload, the image is saved using the same storage location and naming convention currently used for generated images (`C:\gonf\[gonf_name]\img\`).
7. An uploaded image enters the same `candidate-ready` state used by generated images and requires the existing retry/confirm controls to finalize - it does not skip directly to `finalized`.
8. Retry is not applicable to an uploaded candidate in the same way as generation retry; re-uploading a new file while a candidate is unconfirmed replaces the pending candidate the same way a generation retry would.
9. Item image support (upload and generate) is introduced for the first time in this ticket, mirroring the existing room/character async job architecture and state machine.
10. Existing Gonf files saved before this change (with only generated-image metadata) continue to load and behave correctly; a `source` discriminator (`generated` vs `uploaded`) is added to image metadata, defaulting to `generated` for backward compatibility.

## User Story

As a user
I want to choose between uploading my own image or generating one with AI for any room, character, or item
So that I can use my own artwork when I have it, and avoid waiting on slow or low-quality AI generation when I don't need it.

## Acceptance Criteria

1. Saving a room or character no longer automatically triggers image generation.
2. Room, character, and item detail panels each show "Upload Image" and "Generate Image" buttons.
3. Clicking "Generate Image" behaves the same as the current automatic flow did (queue, placeholder/candidate, retry, confirm).
4. Clicking "Upload Image" opens a file picker restricted to `.png`, `.jpeg`, `.gif`.
5. Client-side validation rejects files over 2MB or of an unsupported type before any network call is made, with a clear error message.
6. Server-side validation independently rejects oversized or invalid-type files even if client validation is bypassed.
7. A valid uploaded file is saved to the same `img` folder location used today and is associated with the room/character/item the same way a generated image is.
8. Uploaded images appear in `candidate-ready` state and require the checkmark/confirm control to finalize, consistent with generated images.
9. Item panels support both Upload Image and Generate Image using the same architecture pattern as rooms/characters.
10. Existing saved Gonf files without a `source` field continue to load without errors, treated as `generated`.
11. Existing V1/V2 parity test flows for rooms/items/characters continue to pass except where intentionally changed by this ticket (removal of auto-generation on save).

## Edge Cases and Error Handling

1. User selects a file over 2MB - clear client-side rejection message, no request sent.
2. User selects an unsupported file type (e.g., `.bmp`, `.webp`, `.svg`) - clear client-side rejection message.
3. Server receives a request bypassing client validation (e.g., direct API call) with an oversized or invalid file - request is rejected with an appropriate error code, not silently accepted.
4. User uploads a new image while a previous upload or generation candidate is still unconfirmed - new candidate replaces the pending one.
5. Upload succeeds but file system write fails (permissions/disk) - user sees an actionable error, consistent with existing generation failure handling.
6. User clicks "Generate Image" and "Upload Image" in quick succession - only the most recent action's resulting candidate should be tracked; earlier in-flight requests should not overwrite a later result.
7. Item image job fails (new provider integration) - error handling parity with room/character failure states.

## Non-Functional Requirements

1. No change to existing generate/poll/retry/confirm mechanics or timing beyond removing the automatic trigger.
2. Upload flow should feel near-instant compared to the multi-minute generation flow; no artificial delay.
3. UI remains responsive during both upload and generate operations.
4. New item image endpoints and job service follow the same coding patterns as the existing room/character equivalents for maintainability.

## Dependencies

1. Existing room image async job pipeline and state machine (delivered under GONF-009B/GONF-009C).
2. Existing character image async job pipeline (delivered under GONF-009 character epic).
3. Existing `GetGonfImage` file-serving endpoint, which may need to be extended to serve non-PNG content types for uploaded images.

## Out of Scope

1. Image editing/cropping/resizing tools.
2. Content moderation of uploaded images.
3. Changing the underlying IMPS/Automatic1111 generation provider or its performance characteristics.
4. Batch upload or batch generation across multiple entities at once.

## Open Questions

1. Should uploaded non-PNG files be converted to PNG on save, or should the image-serving endpoint be made content-type aware to serve `.jpeg`/`.gif` directly? Needs a decision during implementation.
2. Does "Save Gonf triggers backend auto-finalization for unconfirmed candidates" (GONF-009C Rule 6) still apply to a manually-started, still-pending candidate? Assumed yes (finalization behavior for an in-flight candidate is unchanged; only the trigger to start generation changes), to be confirmed during implementation.

## Architecture Notes

- Reuse the existing room/character image state shape (`imageStatus`, `previewDataUrl`/finalized path, `generationSeed`, `attemptIndex`) with an added `source` field (`generated` | `uploaded`).
- New item image support should introduce `ItemImageGenerationModels`, an `ItemImageGenerationJobService`, and corresponding endpoints mirroring the room/character implementations.
- Shared "Upload Image" / "Generate Image" button UI component should be built once and reused across room, character, and item panels rather than duplicated per entity type.

## QA Notes and Test Intent

1. Validate that Save Room / Save Character no longer trigger automatic generation.
2. Validate Upload Image flow end-to-end for all three entity types: client validation, server validation, storage, candidate-ready state, confirm.
3. Validate Generate Image flow still works identically to the prior automatic behavior, just user-triggered.
4. Validate backward compatibility for Gonf files saved before the `source` field existed.
5. Validate item image generate/upload parity with room/character behavior, since this is new functionality.

## Traceability

- Parent Ticket: GONF-009 (Character Image Generation Epic)
- Related Tickets:
  1. GONF-009A
  2. GONF-009B
  3. GONF-009C (superseded rules noted above)
  4. GONF-009D
- Related Commits: [pending]
- Related PR/Code Review: [pending]
- QA Results: [pending]
- Bug Tickets: [pending]

## Status

- Current Status: Ready for Dev
- Owner: Frontend Developer / Backend Developer
- Last Updated: 2026-07-15
- Branch Naming Target: feature/GONF-010-manual-image-upload-and-generate-controls
```
