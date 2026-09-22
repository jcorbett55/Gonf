```markdown
# GONF-011 - Character Memory

## Business Objective

Give characters the ability to remember prior conversations, item interactions, and world-state events involving them, so the game world feels persistent and characters don't repeat/contradict things they should already know, and don't omnisciently reference things they were never present for.

## Business Rules

1. Character memory is stored server-side as part of the existing player save state (`PlayerSaveState`), not in browser `localStorage` as the source of truth. Memory is scoped per playthrough/save; starting a new game or loading a different save does not carry memory over.
2. A character only recalls events they witnessed directly (were present for) or were explicitly told about in-game by another character. A character must never reference an event it was never present for and was never told about.
3. Memory facts are categorized by type (`ItemInteraction`, `WorldEvent`, `PlayerStatement`, `RepeatedTopicQuery`) so retrieval and prompt-injection logic can treat them differently.
4. Each memory fact has a `FactKey` identifying its subject. When a new fact is recorded under an existing `FactKey`, the default resolution rule is **overwrite** (latest state replaces the prior entry) - except for `RepeatedTopicQuery` facts (see Rule 6), which are cumulative.
5. The number of memory facts injected into a single conversation prompt is capped at 5 per character per turn, prioritized in this order: witnessed-directly > told-by-other-character > world-event, then by recency within each tier.
6. `RepeatedTopicQuery` facts track how many times the player has asked a character about the same topic (e.g., "the diamond"), keyed by `(CharacterId, Topic)`. This count is cumulative (incremented, not overwritten) and is injected into the prompt so the character's personality (as described in its existing `CharacterDescription`) can drive an increasingly impatient/annoyed response on repetition, rather than the character calmly repeating itself indefinitely.
7. Memory read/write operations only load memory for characters currently participating in the active conversation (i.e., characters present in the room), never the full cast at once.
8. Existing saved Gonf/player-save files without any memory data continue to load without error; absent memory data is treated as "no memories yet."

## User Story

As a player
I want characters to remember relevant things about our past interactions and the world
So that the game feels persistent, characters don't act omniscient or forgetful in ways that break immersion, and repeated behavior (like asking the same question) gets a believable, personality-driven reaction.

## Acceptance Criteria

1. When a character is present in a conversation, the system includes that character's relevant remembered facts in the conversation prompt context.
2. A character does not reference an event it was not present for and was not told about, verified via a `FilterMemoriesForCharacter`-style function that filters candidate memories by witness/told status before prompt injection (not enforced via prompt wording alone).
3. Memory facts are stored with a `FactType` (`ItemInteraction` | `WorldEvent` | `PlayerStatement` | `RepeatedTopicQuery`).
4. Repeated facts under the same `FactKey` overwrite the prior entry, except `RepeatedTopicQuery` facts, which increment a counter instead.
5. No more than 5 memory facts are injected per character per conversation turn, prioritized witnessed > told > world-event, then recency.
6. When a `RepeatedTopicQuery` count for a given character/topic crosses a noticeable threshold, the character's response reflects growing impatience/annoyance consistent with its description, rather than a flat repeated answer.
7. Characters with no relevant memory behave as they do today (no regression to existing inventory-awareness or deflection behavior).
8. Memory loading for a conversation only queries/loads memory for characters currently in that conversation, not the full character roster.
9. Automated tests verify that a specific remembered fact is included in the prompt sent to the LLM for a controlled scenario, independent of the LLM's generated response text.
10. Existing saved player-save files without memory data load successfully, with memory treated as empty rather than causing a load failure.

## Edge Cases and Error Handling

1. A character has no memory at all for the current context - behaves identically to pre-memory behavior (AC 7).
2. A fact is recorded for a character who is later not present when the same topic comes up with a different character - the second character must not reference it unless explicitly told (AC 2).
3. The player asks about the same topic repeatedly past the annoyance threshold - character escalates tone rather than resetting to a neutral answer each time (AC 6).
4. More than 5 relevant memories exist for a character in a single turn - lowest-priority/oldest facts are dropped from the prompt, not silently truncated in an unprioritized way (AC 5).
5. A save file predates memory support entirely - loads cleanly with zero memories, no error (AC 10).

## Non-Functional Requirements

1. Memory storage/query must not require loading all characters' full memory into active memory at once - only memory for characters in the active conversation is loaded.
2. Memory injection follows the same prompt-construction pattern already used for carried-items (`OpenAiChatCompletionProvider.cs`), rather than introducing a second, inconsistent prompt-building mechanism.
3. The witnessed/told filter must be a pure, independently unit-testable function, decoupled from the LLM call.

## Dependencies

1. Existing `PlayerSaveState` model and service (`PlayerSaveStateModels.cs`, `PlayerSaveStateService.cs`).
2. Existing conversation prompt-building pipeline and carried-items pattern (`ConversationModels.cs`, `OpenAiChatCompletionProvider.cs`).
3. Existing room-scoped character resolution used for conversation payloads (`gonfEngine.js`, `conversationClient.js`).

## Out of Scope

1. Generic/arbitrary cumulative memory tallies beyond `RepeatedTopicQuery` (deferred to a follow-up ticket).
2. Item ownership transfer, singleton-item enforcement, or any gameplay mechanic that changes item custody - tracked separately under GONF-012 (Item Management).
3. Player-facing memory inspection/debug tooling.
4. Memory expiry/decay beyond the fixed per-turn injection cap.

## Open Questions

1. None blocking - resolved during BA/Dev Lead review: storage location (PlayerSaveState), injection cap (5, prioritized), and default resolution rule (overwrite-by-FactKey, with `RepeatedTopicQuery` as the sole cumulative exception) are all settled for v1.
2. Exact annoyance threshold/count for `RepeatedTopicQuery` (e.g., 3rd repeat vs. 5th) is left to prompt-tuning during implementation rather than a fixed contractual number.

## Architecture Notes

- New `CharacterMemoryEntry` model: `CharacterId`, `FactKey`, `FactType`, `FactText`, `WitnessedBy` (character id list), `IsCumulative`, `Count` (for cumulative facts), `TimestampUtc`. Extends `PlayerSaveState`, not a new top-level store.
- New pure function `FilterMemoriesForCharacter(characterId, allMemories)` enforces the witnessed/told rule; independently unit-testable without invoking the LLM.
- Prompt injection in `OpenAiChatCompletionProvider.cs` mirrors the existing `BuildCarriedItemsSuffix`-style pattern with a new `BuildMemorySuffix`-equivalent, applying the top-5 prioritization and cap.
- `RepeatedTopicQuery` counter increments happen server-side whenever a matching topic/character pair recurs in the conversation flow; the current count is passed into the prompt alongside `CharacterDescription` so tone escalation is driven by the LLM's read of personality, not a hardcoded response ladder.
```
