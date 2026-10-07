namespace Gonf.Api.Models;

/// <summary>
/// A single clue placed by <see cref="Services.MysteryCaseFileGenerationService"/>: an existing
/// authored item tagged with evidentiary meaning, placed in a room, and optionally witnessed by
/// at most one character (see GONF-013 Business Rule 5).
/// </summary>
public sealed record MysteryClue(
    int ItemId,
    int RoomId,
    int? WitnessCharacterId
);

/// <summary>
/// A clue-combination rule (GONF-013 Business Rule 4): once the player holds/knows every item in
/// <paramref name="RequiredItemIds"/>, regardless of discovery order, <paramref name="UnlockedFactText"/>
/// becomes available as a derived fact.
/// </summary>
public sealed record MysteryClueCombinationRule(
    IReadOnlyList<int> RequiredItemIds,
    string UnlockedFactText
);

/// <summary>
/// The hidden solution for a single playthrough's mystery scenario (GONF-013). This is
/// server-side-only state: it must never be included in any player-facing save-state response,
/// command output, or client-inspectable payload (GONF-013 Business Rule 2). It is generated once
/// per playthrough and remains fixed for that playthrough's lifetime (Business Rule 1).
/// </summary>
/// <param name="SynthesizedItems">
/// Newly generated clue items created because the authored Gonf did not have enough existing
/// items to serve as clues (GONF-013 Business Rule 3). These reuse the authored
/// <see cref="SaveGonfItemRequest"/> shape so they behave identically to authored items once
/// merged into a playthrough's runtime item/room state (Acceptance Criteria 2), but are never
/// written back into the authored Gonf file itself.
/// </param>
public sealed record MysteryCaseFile(
    int GuiltyCharacterId,
    IReadOnlyList<MysteryClue> Clues,
    IReadOnlyList<MysteryClueCombinationRule> ClueCombinationRules,
    IReadOnlyList<SaveGonfItemRequest> SynthesizedItems,
    string Motive
);
