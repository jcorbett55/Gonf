using Gonf.Api.Models;

namespace Gonf.Api.Services;

/// <summary>
/// Procedurally generates a hidden <see cref="MysteryCaseFile"/> for a single playthrough
/// (GONF-013). Generation is a discrete, deterministic-per-seed, server-side step decoupled from
/// the LLM conversation pipeline so its internal consistency can be validated without invoking
/// any LLM call (GONF-013 Non-Functional Requirements 1-2).
/// </summary>
public static class MysteryCaseFileGenerationService
{
    // Minimum number of clues a case file should have when the Gonf has at least one room to
    // place clues in. When the authored item roster doesn't have enough eligible items to reach
    // this minimum, additional placeholder clue items are synthesized (GONF-013 Business Rule 3).
    private const int MinimumDesiredClueCount = 3;

    /// <summary>
    /// Generates a case file from the Gonf's authored rooms/items/characters, using
    /// <paramref name="seed"/> to make generation reproducible for a given playthrough (the caller
    /// is expected to derive the seed from a stable value such as gonfName+saveId).
    /// </summary>
    /// <remarks>
    /// Degrades gracefully (GONF-013 Edge Case 1) when there are too few characters/items: with no
    /// characters, no case file can be produced (guilty party required) and this returns null.
    /// With zero items and no rooms, a case file is still produced with no clues. When rooms exist
    /// but authored items are too few, additional clue items are synthesized (Business Rule 3).
    /// </remarks>
    public static MysteryCaseFile? Generate(
        IReadOnlyList<SaveGonfCharacterRequest> characters,
        IReadOnlyList<SaveGonfItemRequest> items,
        IReadOnlyList<SaveGonfRoomRequest> rooms,
        int seed)
    {
        if (characters is not { Count: > 0 })
        {
            return null;
        }

        var random = new Random(seed);

        // Guilty-character selection must be uniform across the full roster, including
        // wanderers, so that guilt never statistically correlates with wanderer status or
        // witness-assignment frequency (GONF-013 Business Rule 6, Edge Case 4).
        var guiltyCharacter = characters[random.Next(characters.Count)];

        var (clues, synthesizedItems) = SelectClues(items, rooms, characters, random);
        var combinationRules = BuildCombinationRules(clues, random);
        var motive = SelectMotive(random);

        return new MysteryCaseFile(
            GuiltyCharacterId: guiltyCharacter.CharacterId,
            Clues: clues,
            ClueCombinationRules: combinationRules,
            SynthesizedItems: synthesizedItems,
            Motive: motive
        );
    }

    // A small fixed pool of motive phrases (GONF-014 Business Rule 4/Architecture Notes): the
    // guilty character's specific motive text is part of their do-not-reveal list, so it must be
    // a concrete, scannable string rather than left for the LLM to invent.
    private static readonly string[] MotivePool =
    {
        "a grudge over an old debt",
        "jealousy over being overlooked",
        "a desperate need for money",
        "a secret they were desperate to protect",
        "revenge for a past humiliation",
    };

    private static string SelectMotive(Random random) => MotivePool[random.Next(MotivePool.Length)];

    /// <summary>
    /// Selects a subset of existing authored items to serve as clues and assigns each a room and
    /// at most one witness. Only items with a known authored <c>Location</c> are eligible, since a
    /// clue must be placeable in a room (GONF-013 Business Rule 3 - reusing existing items). When
    /// fewer than <see cref="MinimumDesiredClueCount"/> eligible items exist but rooms are
    /// available, additional placeholder clue items are synthesized to make up the shortfall
    /// rather than leaving the mystery under-clued.
    /// </summary>
    private static (IReadOnlyList<MysteryClue> Clues, IReadOnlyList<SaveGonfItemRequest> SynthesizedItems) SelectClues(
        IReadOnlyList<SaveGonfItemRequest> items,
        IReadOnlyList<SaveGonfRoomRequest> rooms,
        IReadOnlyList<SaveGonfCharacterRequest> characters,
        Random random)
    {
        var eligibleItems = items.Where(item => item.Location is not null).ToList();
        if (rooms.Count == 0)
        {
            return (Array.Empty<MysteryClue>(), Array.Empty<SaveGonfItemRequest>());
        }

        var synthesizedItems = new List<SaveGonfItemRequest>();
        if (eligibleItems.Count < MinimumDesiredClueCount)
        {
            var nextItemId = (items.Count > 0 ? items.Max(item => item.ItemId) : 0) + 1;
            var shortfall = MinimumDesiredClueCount - eligibleItems.Count;

            for (var i = 0; i < shortfall; i++)
            {
                var room = rooms[random.Next(rooms.Count)];
                var synthesizedItem = new SaveGonfItemRequest(
                    ItemId: nextItemId + i,
                    ItemName: $"Clue Item {nextItemId + i}",
                    ItemWeight: null,
                    ItemDescription: "A piece of evidence.",
                    ItemValue: null,
                    CanHoldItems: false,
                    CanBeCarried: true,
                    Location: room.RoomId,
                    Contents: Array.Empty<int>());

                synthesizedItems.Add(synthesizedItem);
                eligibleItems.Add(synthesizedItem);
            }
        }

        if (eligibleItems.Count == 0)
        {
            return (Array.Empty<MysteryClue>(), synthesizedItems);
        }

        // Degrade gracefully: pick roughly half the eligible items (at least one, capped to what
        // exists) rather than failing when the Gonf is small (GONF-013 Edge Case 1). Synthesized
        // items are always included since they only exist to fill the clue shortfall.
        var clueCount = Math.Max(MinimumDesiredClueCount, eligibleItems.Count / 2);
        clueCount = Math.Min(clueCount, eligibleItems.Count);
        var shuffledItems = eligibleItems.OrderBy(_ => random.Next()).Take(clueCount).ToList();

        var clues = new List<MysteryClue>(shuffledItems.Count);
        foreach (var item in shuffledItems)
        {
            var roomId = item.Location!.Value;
            var witnessCharacterId = SelectWitness(roomId, characters, random);
            clues.Add(new MysteryClue(item.ItemId, roomId, witnessCharacterId));
        }

        return (clues, synthesizedItems);
    }

    /// <summary>
    /// Assigns at most one witness to a clue in <paramref name="roomId"/>, weighted toward
    /// characters who are wanderers or already located in that room, per GONF-013 Business Rule
    /// 5. Most clues have zero witnesses: a witness is only assigned when the weighted roll
    /// succeeds.
    /// </summary>
    private static int? SelectWitness(
        int roomId,
        IReadOnlyList<SaveGonfCharacterRequest> characters,
        Random random)
    {
        // Base chance any witness is assigned at all - keeps "most clues have zero witnesses"
        // true (Business Rule 5) while still allowing witnessed clues to exist.
        const double baseWitnessChance = 0.35;
        if (random.NextDouble() >= baseWitnessChance)
        {
            return null;
        }

        var weighted = new List<(SaveGonfCharacterRequest Character, double Weight)>();
        foreach (var character in characters)
        {
            var isInRoom = character.Location == roomId;
            var isWanderer = character.Wanderer;

            // Baseline weight so every character remains eligible (guilt must not be excluded
            // from witness eligibility - Edge Case 4), boosted for plausibility rather than
            // excluding anyone.
            var weight = 1.0;
            if (isInRoom)
            {
                weight += 3.0;
            }
            if (isWanderer)
            {
                weight += 2.0;
            }

            weighted.Add((character, weight));
        }

        var totalWeight = weighted.Sum(entry => entry.Weight);
        var roll = random.NextDouble() * totalWeight;
        var cumulative = 0.0;
        foreach (var (character, weight) in weighted)
        {
            cumulative += weight;
            if (roll <= cumulative)
            {
                return character.CharacterId;
            }
        }

        return weighted.Count > 0 ? weighted[^1].Character.CharacterId : null;
    }

    /// <summary>
    /// Derives a small set of clue-combination rules (GONF-013 Business Rule 4) by pairing up
    /// clues two-at-a-time; skipped entirely when fewer than two clues exist. Combination rules
    /// reference only clues that were actually placed, satisfying Edge Case 2 (a rule may not
    /// reference a clue that failed to generate) by construction.
    /// </summary>
    private static IReadOnlyList<MysteryClueCombinationRule> BuildCombinationRules(
        IReadOnlyList<MysteryClue> clues,
        Random random)
    {
        if (clues.Count < 2)
        {
            return Array.Empty<MysteryClueCombinationRule>();
        }

        var shuffledClues = clues.OrderBy(_ => random.Next()).ToList();
        var rules = new List<MysteryClueCombinationRule>();

        for (var i = 0; i + 1 < shuffledClues.Count; i += 2)
        {
            var first = shuffledClues[i];
            var second = shuffledClues[i + 1];
            rules.Add(new MysteryClueCombinationRule(
                RequiredItemIds: new[] { first.ItemId, second.ItemId },
                UnlockedFactText: $"Items {first.ItemId} and {second.ItemId} together reveal a new clue."
            ));
        }

        return rules;
    }
}
