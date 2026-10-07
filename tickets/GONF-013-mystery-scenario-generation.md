# GONF-013 - Mystery Scenario Generation (Case File)

## Business Objective

Allow a Gonf author to describe a mystery-style game (murder, theft, puzzle, etc.) in the existing
freeform `Goal` field, and have the system procedurally generate a randomized, hidden solution -
who is guilty, what the evidence is, and where it is - using the Gonf's existing rooms, items, and
characters wherever possible. Because generation happens per playthrough rather than at authoring
time, no two playthroughs of the same Gonf need have the same guilty party or the same clue
locations.

## Business Rules

1. Scenario generation runs once per new playthrough (new game / save slot creation), not on every
   request. The generated result (the "case file") is fixed for the lifetime of that playthrough.
2. The case file is hidden runtime state - it must never be exposed to the player-visible save
   state, player-facing commands, or client-side inspectable data. It is readable only by
   server-side prompt-building and win/lose-evaluation logic.
3. The generator prefers reusing existing authored items as clues (tagging an existing item with
   evidentiary meaning) but may generate new clue items on its own (name, description, and image
   generation follows the same pipeline as any other authored item) when the existing Gonf does
   not have enough suitable items.
4. Clue placement has no fixed order or tier - any clue can be discovered by the player in any
   order. However, some clues may be defined as incomplete/inert on their own and only become
   meaningful in combination with one or more other specific clues (e.g., two halves of a torn
   note). This is expressed as a small set of clue-combination rules: a set of required clue
   itemIds that, once all are held/known by the player, unlocks one derived fact.
5. For each clue, the generator assigns **at most one** witnessing character (most clues have
   zero witnesses). Witness assignment is weighted toward characters who are wanderers or who
   would plausibly be in the clue's room, rather than assigned uniformly at random.
6. The guilty character is chosen from the Gonf's existing character roster. The guilty
   character's clue-witnessing odds/behavior for clues unrelated to their own guilt must be
   statistically identical to any innocent character's - guilt must not correlate with how
   talkative or clue-aware a character is about unrelated clues, so the player cannot infer
   guilt from a character's general helpfulness.
7. Innocent characters never have knowledge of who the guilty party is. They may only speculate
   about clues they personally witnessed (per Rule 5), never about the solution itself.

## User Story

As a Gonf author
I want to describe a mystery scenario in the Goal field and have the game system generate a
randomized solution using my existing world
So that every playthrough can have a different guilty party and different clue placement without
me hand-authoring multiple variants of the same game.

## Acceptance Criteria

1. Given a Gonf with a mystery-style Goal and a roster of characters/items/rooms, a new playthrough
   produces a case file identifying: the guilty characterId, the set of clue items (existing
   itemIds and/or newly generated items with assigned room locations), any clue-combination rules,
   and the per-clue witness assignment (zero or one characterId per clue).
2. Newly generated clue items are persisted using the same item shape/pipeline as authored items
   (including optional image generation), so they behave identically to authored items during
   play (can be picked up, held, examined, transferred).
3. Re-loading the same playthrough's save does not regenerate or change the case file; the
   solution remains stable for that playthrough.
4. Starting a **new** playthrough of the same Gonf can produce a different guilty party and/or
   different clue locations than a prior playthrough.
5. The case file is never present in any player-facing API response, save-state payload visible to
   the client, or player command output.
6. A clue-combination rule only unlocks its derived fact once the player has discovered/holds all
   of its required clues; discovering them in any order still unlocks it once complete.
7. Automated tests verify: case file generation produces internally consistent output (guilty
   character exists in roster, clue items exist in the Gonf's item/room data, witness assignments
   reference real characters), and that the case file is stable across reloads of the same save.

## Edge Cases and Error Handling

1. The Gonf has too few items/rooms/characters to generate a coherent scenario - the generator
   must degrade gracefully (e.g., fewer clues, no witnesses) rather than error or crash.
2. A clue-combination rule references a clue that failed to generate/place - that rule is skipped
   rather than blocking generation of the rest of the case file.
3. Two clues are assigned to the same room - allowed; multiple clues may coexist in one location.
4. The generator picks a guilty character who is also a wanderer - allowed; wanderer status must
   not be excluded from guilt eligibility, since excluding wanderers would itself leak information.
5. Legacy playthroughs/saves created before this feature existed have no case file - the game
   continues to function under existing (non-mystery) goal-parsing rules with no case-file
   behavior applied.

## Non-Functional Requirements

1. Case file generation must be a discrete, server-side, testable step decoupled from the LLM
   conversation pipeline - it produces structured data, not freeform LLM prose, so its internal
   consistency can be validated deterministically.
2. The witness-weighting logic (favoring wanderers/room-occupants) must be independently
   unit-testable without invoking any LLM call.
3. Case file storage must not leak into client-visible payloads; this should be enforced by keeping
   it in a separate server-side model from `PlayerSaveState`, not merely by client-side filtering.

## Dependencies

1. Existing Gonf save/item/room/character models (`SaveGonfModels.cs`, `GonfSaveService.cs`).
2. Existing image-generation pipeline for items (`ItemImageEndpoints.cs`,
   `ItemImageGenerationJobService.cs`) for newly generated clue items.
3. Existing `PlayerSaveState` model/service as the sibling store the case file is persisted
   alongside (but separate from).
4. Existing heuristic goal parser (`gonfEngine.js`) as the eventual consumer of a mystery-flavored
   Goal, for future goal-criteria work (tracked separately under GONF-014).

## Out of Scope

1. Any player-facing mechanics: accusation, win/lose overlays, guilty-party dialogue escalation,
   or clue-speculation dialogue for innocent characters - tracked under GONF-014.
2. Any new goal-criterion types (`accuse`, evidence-found, etc.) - tracked under GONF-014.
3. Multi-solution or branching mysteries (more than one valid guilty party per playthrough).
4. Difficulty tuning/balancing (number of clues per playthrough, witness density) - left to
   prompt/generation-parameter tuning during implementation, not a contractual requirement here.

## Open Questions

1. Whether clue-combination rules and witness assignment are generated by an LLM call, deterministic
   procedural logic, or a hybrid (e.g., LLM proposes clue text/placement, deterministic code
   assigns witnesses and enforces the combination-rule structure) - left to implementation, given
   the accepted LLM-consistency risk called out during design discussion.
2. Whether a minimum/maximum clue count should be configurable per Gonf or left as an internal
   generation parameter - deferred to implementation.

## Architecture Notes

- New `MysteryCaseFile` model (working name), stored server-side alongside/adjacent to
  `PlayerSaveState` but never serialized into player-facing save-state responses: `GuiltyCharacterId`,
  `Clues` (list of `{ ItemId, RoomId, WitnessCharacterId? }`), `ClueCombinationRules` (list of
  `{ RequiredItemIds, UnlockedFactText }`).
- Newly generated clue items reuse `SaveGonfItemRequest`-shaped data and the existing item
  image-generation pipeline; they are merged into the playthrough's live room/item state exactly
  like authored items, not tracked in a parallel item system.
- Witness assignment reuses the existing `CharacterMemoryEntry`/`WitnessedBy` shape from GONF-011 -
  a clue-witness fact is recorded the same way a live-play witnessed event would be, just generated
  at case-file creation time instead of during play.
- Case file generation should be implemented as its own stateless service (mirroring the
  `ItemTransferService`/`CharacterMemoryService` static-service pattern already used in this
  codebase) so it can be independently unit-tested without the LLM or HTTP pipeline.

## QA Notes and Test Intent

1. Verify case file generation is deterministic-per-seed (or otherwise reproducible for test
   purposes) so tests can assert on structure without needing true randomness in the test run.
2. Verify guilty-character selection does not statistically correlate with wanderer status or
   witness-assignment frequency across repeated generations (spot-check, not a strict proof).
3. Verify a clue-combination rule remains locked until all required clues are present, and unlocks
   regardless of discovery order.
4. Verify newly generated clue items round-trip through save/load identically to authored items.

## Traceability

- Parent Ticket: none (originated from mystery-game brainstorm, follow-up to GONF-012)
- Related Tickets:
  1. GONF-011 (character memory model, reused for clue-witness facts)
  2. GONF-012 (item transfer/inventory model, reused for clue items)
  3. GONF-014 (Mystery Gameplay Mechanics - consumes this ticket's case file)
- Related Commits: [pending]
- Related PR/Code Review: [pending]
- QA Results: [pending]
- Bug Tickets: [pending]
