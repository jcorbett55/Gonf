# GONF-014 - Mystery Gameplay Mechanics (Dialogue, Accusation, Win/Lose)

## Business Objective

Bring the hidden case file generated under GONF-013 to life during play: characters react to the
shared mystery premise in a personality-driven way, the guilty character grows evasive as the
player accumulates relevant clues (without ever confirming guilt outright), innocent characters may
speculate about clues they personally witnessed, and the player can freely accuse a character at
any time - correct accusation wins the game, incorrect accusation is a permanent loss.

## Business Rules

1. Every character is aware of the mystery's shared premise (the "world event," e.g. "someone
   ordered a pizza and didn't tip the delivery boy") from the start of the playthrough. This is
   injected as a shared fact using the existing memory-fact/prompt-injection mechanism (GONF-011),
   not a new injection channel.
2. Each character's reaction to the shared premise and to any clue they discuss must be filtered
   through their own `CharacterDescription` and phrased in their own voice - the system prompt must
   explicitly instruct against multiple characters phrasing a reaction identically.
3. The guilty character (per the GONF-013 case file) answers exactly like an innocent character
   would when the player has discovered none or few of the clues relevant to their guilt. As the
   player's currently-known/held clue set (see GONF-013 Rule 4/6) grows, the guilty character's
   responses become progressively more evasive and may let slip a specific, pre-scoped detail
   (e.g., confirming a location or item name) without ever admitting guilt or using
   self-incriminating language.
4. The guilty character has an explicit do-not-reveal list (their own name in a confession context,
   words like "guilty"/"confess"/"I did it," and their specific motive) that must never appear in
   their dialogue regardless of how many clues the player has found.
5. Innocent characters may only reference a clue if they were assigned as that clue's witness in
   the case file (GONF-013 Rule 5/7). An innocent character never has knowledge of, and never
   speculates about, who the guilty party is - only about clues they personally witnessed.
6. The player may attempt to accuse any character at any time via a player command (e.g.
   `/accuse CHARACTER`), with no minimum clue/fact prerequisite.
7. Because a wrong accusation is permanent and ends the game, the accusation flow must present an
   explicit warning and require confirmation before being resolved - a single ambiguous message
   must not silently end the game.
8. A confirmed accusation resolves immediately: correct match against the case file's
   `GuiltyCharacterId` triggers the existing win condition/overlay; any other character triggers a
   new loss condition/overlay, and play stops until the game is reloaded (mirroring the existing
   win-overlay behavior from the Goal/win-condition feature).

## User Story

As a player
I want characters to react to the mystery in their own voice, get more evasive as I gather clues on
the real culprit, and be able to accuse a suspect once I think I know who did it
So that the mystery feels alive and personality-driven rather than robotic, and I have a clear,
appropriately risky way to conclude the game.

## Acceptance Criteria

1. Given a mystery-flavored Goal, all characters present in a conversation receive the shared
   premise fact in their prompt context, and their generated dialogue reflects their individual
   `CharacterDescription` rather than a uniform reaction.
2. Given the player has discovered zero clues relevant to the guilty character, that character's
   dialogue is indistinguishable in tone/content from an innocent character's baseline behavior.
3. Given the player has discovered one or more clues relevant to the guilty character, that
   character's dialogue becomes measurably more evasive/nervous (via prompt instruction) and may
   surface one pre-scoped detail per relevant clue, without confessing or naming themselves guilty.
4. The guilty character's dialogue never contains any entry from their do-not-reveal list, verified
   by an automated check independent of the LLM's freeform output (e.g., a post-generation scan/
   filter, not prompt wording alone).
5. An innocent character only ever references a clue they were assigned as witness to in the case
   file; they never reference clues they were not assigned to, and never reference the guilty
   party's identity.
6. `/accuse CHARACTER` (and a natural-language equivalent, e.g. "I accuse Karen") is recognized as a
   player command and produces an explicit warning/confirmation step before resolving.
7. Confirming an accusation against the correct guilty character triggers the existing win overlay
   and stops the game per existing win behavior.
8. Confirming an accusation against any other character triggers a new "GAME OVER" overlay and
   stops the game the same way a win does, requiring a reload to continue.
9. Declining/cancelling the accusation confirmation leaves the game state unchanged and play
   continues normally.
10. Automated tests cover: shared-premise injection present in prompt context, guilty-character
	escalation instruction present once relevant clues are known, do-not-reveal filter rejecting a
	simulated confession-containing response, innocent-character clue reference gated by witness
	assignment, and both accusation outcomes (win/lose) including the confirmation gate.

## Edge Cases and Error Handling

1. Player attempts `/accuse` with a character name that doesn't exist in the current Gonf - treated
   as an unrecognized/invalid command, not a resolved (and certainly not a losing) accusation.
2. Player accuses, is warned, and cancels - no state change, no memory fact recorded, game
   continues.
3. Player has discovered all clues relevant to the guilty character - escalation/evasiveness must
   plateau at its most-evasive-defined state rather than requesting undefined behavior beyond what
   was authored/generated.
4. A do-not-reveal violation is detected in a generated response - the offending line must not reach
   the player as-is (regenerate, or substitute a safe fallback line), not silently pass through.
5. The mystery Goal/case file is absent (non-mystery Gonf) - none of this ticket's behavior
   activates; existing conversation and goal behavior is unaffected.

## Non-Functional Requirements

1. Do-not-reveal enforcement must be implemented as a deterministic, independently testable check
   (e.g., a static helper function scanning parsed dialogue lines), not solely a prompt instruction,
   given the accepted LLM-consistency risk noted during design discussion.
2. The accusation confirmation flow must not be resolvable via a single ambiguous player message -
   it requires a distinguishable second confirming input.
3. Win/lose overlay handling should share as much of the existing win-overlay implementation as
   possible (same "stop game until reload" pattern) rather than introducing a parallel game-state
   machine.

## Dependencies

1. GONF-013 (Mystery Scenario Generation) - supplies the case file (`GuiltyCharacterId`, clue
   witness assignments, clue-combination unlocked facts) this ticket consumes.
2. Existing conversation prompt pipeline (`OpenAiChatCompletionProvider.cs`,
   `BuildSystemPrompt`/`BuildMemoryFactsSuffix`) as the injection point for premise/escalation/
   witness facts.
3. Existing player-command parsing and win-overlay behavior (`gonfEngine.js`,
   `GonfPlayerApp.jsx`, `parsePlayerCommand`, `isGoalComplete`/`YOU WON!` overlay) as the pattern
   the new `/accuse` command and loss overlay extend.
4. Existing conversation-line parsing (`ParseConversationLines`) as the point where a do-not-reveal
   scan would be applied to generated dialogue.

## Out of Scope

1. Case file generation itself (guilty-party selection, clue placement, witness assignment) -
   tracked under GONF-013.
2. New goal-criterion parser types for mystery-specific phrasing (e.g., authored "accuse the
   culprit" goal text driving criteria) - may be addressed here only if trivial, otherwise deferred.
3. Multiple accusation attempts / partial credit for a "close but wrong" accusation - a wrong
   accusation is always a full loss per the accepted design.
4. Examine/search-specific clue discovery mechanics - if `/examine` or `/search` does not yet exist
   as a player action, clue discovery in this ticket relies on existing hold/reach/speak mechanics
   (room description, picking up items) until a dedicated examine ticket is scoped.

## Open Questions

1. Exact wording/UX of the accusation confirmation step (slash-command double-confirm vs.
   natural-language "are you sure?" follow-up) - left to implementation.
2. Whether the do-not-reveal check should trigger silent regeneration (retry the LLM call) or a
   scripted fallback line when a violation is detected - left to implementation given cost/latency
   tradeoffs.

## Architecture Notes

- Extends `BuildSystemPrompt` with: (a) a shared premise fact for all present characters, (b) an
  explicit anti-uniformity instruction, (c) for the guilty character only, an escalation
  instruction parameterized by their currently-relevant known clue set, plus their do-not-reveal
  list, (d) for innocent characters, their witnessed-clue facts only (reusing
  `BuildMemoryFactsSuffix`).
- New `MysteryDialogueGuard`-style static helper (naming aligned with existing
  `ItemActionRuleGate`/`CharacterMemoryService` static-service pattern) performs the do-not-reveal
  scan against parsed dialogue lines before they are returned to the client.
- New `/accuse` command follows the existing `parsePlayerCommand`/`buildGoalCommandLine`-style
  pattern in `gonfEngine.js`, with a confirmation round-trip modeled after other multi-step player
  interactions already in `GonfPlayerApp.jsx`.
- New loss overlay in `GonfPlayerApp.jsx` mirrors the existing `YOU WON!` overlay component/state,
  differing only in trigger condition and copy.

## QA Notes and Test Intent

1. Verify prompt context includes the shared premise fact for every present character regardless of
   guilt.
2. Verify the guilty character's injected escalation instruction changes as the player's known-clue
   set grows, using controlled test fixtures rather than live LLM output.
3. Verify the do-not-reveal filter catches a deliberately-crafted violating line in a unit test
   (independent of any real LLM call).
4. Verify an innocent character with no witness assignment for a clue never receives that clue's
   fact in their prompt context.
5. Verify `/accuse` requires confirmation, and that cancelling leaves game state untouched.
6. Verify both accusation resolutions (correct -> win overlay, incorrect -> game-over overlay) via
   automated tests using a fixed/mocked case file.

## Traceability

- Parent Ticket: none (originated from mystery-game brainstorm, follow-up to GONF-012)
- Related Tickets:
  1. GONF-011 (character memory model, reused for premise/witness fact injection)
  2. GONF-012 (item transfer/inventory model, reused for clue-item interactions)
  3. GONF-013 (Mystery Scenario Generation - supplies the case file this ticket consumes)
- Related Commits: [pending]
- Related PR/Code Review: [pending]
- QA Results: [pending]
- Bug Tickets: [pending]
