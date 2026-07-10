# GONF-007C - UI Items Tab, Map Indicators, and Room Item List

## Business Objective

Add item management UX to Gonf Generator, including an Items tab, room map item indicators, and room item listing behavior.

## Business Rules

1. Gonf controls (`Create New Gonf`, `Load Existing Gonf`, Gonf Name, `Save Gonf`) are placed above tabs.
2. `Rooms` tab contains the existing room form workflow.
3. `Items` tab contains an item form with:
   - Item Name
   - Weight
   - Description
   - Value
   - Can Hold Items (boolean)
   - Can Be Carried (boolean)
   - Location (roomId)
4. `Clear` in Items tab resets only the item form.
5. `Save Item` saves item state and updates map indicators.
6. Rooms with at least one located item show an icon in the room square.
7. Clicking a room item icon shows list of items in that room in the details area.
8. `Save Gonf` persists both rooms and items via existing save flow.

## User Story

As a user
I want to manage items in a dedicated tab and view room items from the map
So I can build richer Gonf content and verify item placement quickly.

## Acceptance Criteria

1. Gonf controls appear in top controls section above `Rooms` and `Items` tabs.
2. Existing room form remains functional under `Rooms` tab.
3. Items tab form supports all defined item fields.
4. `Save Item` creates or updates item records.
5. `Clear` in Items tab resets only item fields.
6. Map room icon appears when room has one or more located items.
7. Clicking room item icon renders item list for that room in details panel.
8. `Save Gonf` payload includes both rooms and items.
9. Load existing Gonf repopulates both rooms and items.
10. UX messaging is clear for item save/load failures.

## Edge Cases and Error Handling

1. Item saved without valid location.
2. Location references room on different floor (still valid but visible by room).
3. Multiple items in the same room.
4. Item icon click when room has zero items.

## Non-Functional Requirements

1. Map remains responsive when item counts increase.
2. Item interactions are keyboard accessible.
3. Existing room workflows do not regress.

## Dependencies

1. Finalized rules from GONF-007A.
2. Backend item persistence from GONF-007B.
3. QA cycle from GONF-007D.

## Out of Scope

1. Drag-and-drop item placement on map.
2. Rich item icon customization.
3. Item trading/equipment mechanics.

## Open Questions

1. Icon style and tooltip detail level for item indicators.
2. Maximum number of items shown before truncation/scroll policy.

## Architecture Notes

- Keep room and item state synchronized through shared Gonf model.
- Reuse existing status/error banner patterns.

## QA Notes and Test Intent

1. Validate Rooms tab and Items tab coexistence.
2. Validate item icon/list behavior by room.
3. Validate Save Gonf includes full dataset.

## Traceability

- Parent Ticket: GONF-007
- Related Tickets:
  1. GONF-007A
  2. GONF-007B
  3. GONF-007D
- Related Commits: [pending]
- Related PR/Code Review: [pending]
- QA Results: [pending]
- Bug Tickets: [pending]

## Status

- Current Status: Draft
- Owner: Frontend Developer
- Last Updated: 2026-07-10
- Branch Naming Target: feature/GONF-007C-ui-items-tab-map-indicators
