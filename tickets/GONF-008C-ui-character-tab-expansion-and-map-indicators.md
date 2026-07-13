# GONF-008C - UI Character Tab Expansion, Map Indicators, and Room Character List

## Business Objective

Expand the Character tab UX to support full character authoring, room placement visibility on the map, and room-details character listing with carried items.

## Business Rules

1. Character tab contains fields:
   - Character Name
   - Description
   - Location (optional roomId)
   - Wanderer (boolean)
   - Contains (multi-select from items)
2. Character tab includes buttons:
   - Save Character
   - Clear
3. Clear in Character tab resets only character form fields.
4. Save Character creates or updates character state.
5. If Location is empty at Save Character time, character is assigned to Secret Storage.
6. If Location is provided, it must be a valid room from available rooms.
7. Rooms with one or more characters show one character icon in the room square.
8. Clicking a room character icon causes the side panel to display the character(s) found in that room in place of room information.
9. Character details in the side panel include carried items list from contains.
10. Save Gonf persists rooms, items, and characters via existing save flow.

## User Story

As a user
I want to manage full character details and room placement from the Character tab
So I can build richer Gonf content and verify character presence quickly.

## Acceptance Criteria

1. Character tab shows all required fields and both action buttons.
2. Contains options are populated from existing items.
3. Save Character creates or updates characters with valid data.
4. Clear resets only character fields and does not modify room/item forms.
5. Empty Location defaults character to Secret Storage on save.
6. Invalid Location selections are prevented or surfaced with clear error messaging.
7. Map character indicator appears once for rooms containing one or more characters.
8. Clicking character indicator renders room character list in details panel.
9. Character list entries show carried items under each character details block.
10. Load existing Gonf repopulates characters and map indicators.
11. Existing Rooms and Items workflows do not regress.

## Edge Cases and Error Handling

1. Save Character with no rooms explicitly assigned and no location selected.
2. Contains selected when item is later removed.
3. Multiple characters in same room.
4. Character icon click when room has zero characters.

## Non-Functional Requirements

1. Map remains responsive when character counts increase.
2. Character interactions are keyboard accessible.
3. Existing room and item workflows do not regress.

## Dependencies

1. Finalized rules from GONF-008A.
2. Backend character persistence from GONF-008B.
3. QA cycle from GONF-008D.

## Out of Scope

1. Drag-and-drop character placement on map.
2. Character sprite/portrait customization.
3. Character movement simulation for wanderer behavior.

## Open Questions

1. Character icon style and tooltip detail level.
2. Maximum number of characters shown before truncation/scroll policy.
3. Whether contains list in room details should be expandable/collapsible.

## Architecture Notes

- Keep room, item, and character state synchronized through shared Gonf model.
- Reuse existing status/error banner patterns.

## QA Notes and Test Intent

1. Validate Character tab form behavior and defaults.
2. Validate character icon/list behavior by room.
3. Validate Save Gonf includes full dataset with characters.

## Traceability

- Parent Ticket: GONF-008
- Related Tickets:
  1. GONF-008A
  2. GONF-008B
  3. GONF-008D
- Related Commits: [pending]
- Related PR/Code Review: [pending]
- QA Results: [pending]
- Bug Tickets: [pending]

## Status

- Current Status: Ready for Dev
- Owner: Frontend Developer
- Last Updated: 2026-07-13
- Branch Naming Target: feature/GONF-008C-ui-character-tab-expansion-and-map-indicators
