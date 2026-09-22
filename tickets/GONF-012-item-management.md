# GONF-012 - Item Management (Player/Character Item Transfer)

## Business Objective

Allow the player to give items to characters and receive items from characters, with the
give/receive request itself gated behind a placeholder decision point that a future "game rules
engine" will eventually enforce, so the transfer plumbing can ship now without pretending
refusal logic already exists.

## Business Rules

1. The player has an inventory. It is persisted as `IReadOnlyList<int> ItemIds` on the existing
   `PlayerSaveState` model (top-level, alongside `Characters`), not a new `Player` domain object.
2. Characters already have an inventory (`contains`, from GONF-008B) - this ticket reuses it and
   does not introduce a second character-inventory mechanism.
3. An item exists in exactly one of three places at any time: a room location, a character's
   `contains` list, or the player's `ItemIds` list. This extends GONF-008B rule 8 (previously
   two-way: room vs. character) to a three-way exclusivity rule that now includes the player.
4. Transferring an item (player-to-character or character-to-player) removes it from wherever it
   currently lives (room, character, or player) and adds it to the destination, mirroring the
   reassignment normalization already defined in GONF-008B rule 9.
5. A transfer request ("give me X", "take this", "follow me"-style item asks) is decided by a
   single placeholder decision point, not full game logic:
   ```
   // Notice, this is pseudo code, please do not implement as-is.
   public boolean doAction(action) {
	   // Once game rules are implemented, run the rules against the action to see whether
	   // or not it will be done.
	   boolean willDo = true;
	   // willDo = gameRule.checkActionRule(action);
	   return willDo;
   }
   ```
   In v1, this placeholder always returns true (the request is never refused). The commented-out
   call to a future `gameRule.checkActionRule(action)` must remain in the actual code (not just
   this ticket) alongside a `// TODO: GONF-0XX game rules engine` tag, so the stub has a visible
   paper trail and is not mistaken later for dead/forgotten logic.
6. A completed transfer is recordable as a character memory fact (reusing GONF-011's
   `CharacterMemoryEntry` model, e.g. `ItemInteraction` or `WorldEvent` type) rather than inventing
   a separate tracking mechanism for "gave Karen the diamond"-style state.

## User Story

As a player
I want to give items to characters and receive items from characters
So that I can use items as part of solving the game, with the game world reacting to what I'm
carrying and what I've handed off.

## Acceptance Criteria

1. Player inventory (`ItemIds`) is added to `PlayerSaveState` and round-trips through save/load.
2. A transfer operation (player-to-character or character-to-player) moves an itemId from its
   current single location (room, character `contains`, or player `ItemIds`) to the destination,
   never leaving it duplicated in two places.
3. The transfer request path calls a single placeholder decision function that always allows the
   transfer in v1, with the future rule-check line present but commented out in code.
4. A successful transfer produces a character memory fact usable by GONF-011's existing
   memory/prompt-injection pipeline, without adding a second fact-tracking system.
5. Existing room/character save-load behavior (GONF-008B) is unaffected by the addition of player
   inventory.
6. Automated tests cover: successful player-to-character transfer, successful character-to-player
   transfer, and the three-way single-location invariant (item cannot end up in two places).

## Edge Cases and Error Handling

1. Player attempts to give an item they don't currently have.
2. Player attempts to request an item from a character who doesn't have it.
3. Item is mid-transfer when a save occurs (transfer must be atomic within a single save/request,
   not split across two locations).
4. Legacy save files with no `ItemIds` field load cleanly with an empty player inventory (mirrors
   GONF-011's AC10 pattern for `CharacterMemory`).

## Non-Functional Requirements

1. The three-way item-location invariant must be enforced the same way GONF-008B enforces the
   two-way version - deterministic, testable, no silent duplication.
2. The refusal placeholder must be trivially discoverable in code (named function, TODO tag) so a
   future game-rules-engine ticket can locate and replace it without re-deriving where transfer
   decisions happen.

## Dependencies

1. Existing character inventory and single-assignment rules (GONF-008B).
2. Existing `PlayerSaveState` model and service (`PlayerSaveStateModels.cs`,
   `PlayerSaveStateService.cs`).
3. Existing character memory model and merge/filter logic (GONF-011,
   `CharacterMemoryModels.cs`/`CharacterMemoryService.cs`) for optional transfer-as-memory-fact
   recording.

## Out of Scope

1. The actual game rules engine and any real accept/refuse logic - v1 always accepts.
2. Trust/disposition/relationship modeling for characters.
3. Any UI/UX for initiating a transfer (tracked separately if needed).
4. Item-value-based or quest-flag-based gating - deferred until the game rules engine exists.

## Open Questions

1. None blocking for v1 - refusal logic is explicitly deferred to a future game-rules-engine
   ticket rather than resolved here.

## Architecture Notes

- Extends `PlayerSaveStateRequest`/`PlayerSaveStateResponse` with an `ItemIds` collection.
- Transfer logic should live alongside the existing character `contains` reassignment logic
  (GONF-008B) rather than as a parallel implementation, since the underlying invariant (single
  location per item) is the same rule with a third bucket added.
- The placeholder decision point (Rule 5) is implemented as a static method
  `Gonf.Api.Services.ItemActionRuleGate.WillAllowAction(action)`, mirroring the existing stateless
  static-helper pattern used by `CharacterMemoryService`. This is the single named, greppable
  location a future game-rules-engine ticket must locate and replace - no other copy of this
  decision point should exist in the codebase.
- Memory-fact recording for a completed transfer (Rule 6) calls into the existing
  `CharacterMemoryService`/`CharacterMemoryEntry` pipeline from GONF-011; it is in scope for v1,
  not a follow-up.

## QA Notes and Test Intent

1. Verify the three-way single-location invariant directly (not just the happy path) - attempt a
   transfer and assert the item is removed from its prior location, not just added to the new one.
2. Verify the placeholder decision function is exercised (test that it currently always returns
   true), so a future swap to real game-rules logic has a clear regression baseline to diff
   against.
3. Verify legacy saves without `ItemIds` load with an empty inventory, per NFR pattern from
   GONF-011 AC10.

## Traceability

- Parent Ticket: none (originated from GONF-011 Out of Scope #2 deferral)
- Related Tickets:
  1. GONF-008B (character inventory, single-assignment rule)
  2. GONF-011 (character memory model, reused for transfer recording)
- Related Commits: [pending]
- Related PR/Code Review: [pending]
- QA Results: [pending]
- Bug Tickets: [pending]
