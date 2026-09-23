using Gonf.Api.Models;
using Gonf.Api.Services;

namespace Gonf.Api.Tests;

public class CharacterMemoryServiceTests
{
    private static CharacterMemoryEntry Fact(
        int characterId,
        string factKey,
        CharacterMemoryFactType type,
        IReadOnlyList<int> witnessedBy,
        DateTimeOffset timestamp,
        bool isCumulative = false,
        int count = 0)
    {
        return new CharacterMemoryEntry(
            characterId,
            factKey,
            type,
            $"fact:{factKey}",
            witnessedBy,
            isCumulative,
            count,
            timestamp);
    }

    [Fact]
    public void FilterMemoriesForCharacter_ExcludesFactsCharacterDidNotWitnessOrGetToldAbout()
    {
        var now = DateTimeOffset.UtcNow;
        var memories = new[]
        {
            Fact(1, "key-a", CharacterMemoryFactType.WorldEvent, witnessedBy: new[] { 1 }, timestamp: now),
            Fact(2, "key-b", CharacterMemoryFactType.WorldEvent, witnessedBy: new[] { 2 }, timestamp: now),
        };

        var result = CharacterMemoryService.FilterMemoriesForCharacter(1, memories);

        Assert.Single(result);
        Assert.Equal("key-a", result[0].FactKey);
    }

    [Fact]
    public void FilterMemoriesForCharacter_WithNoMemories_ReturnsEmpty()
    {
        var result = CharacterMemoryService.FilterMemoriesForCharacter(1, null);

        Assert.Empty(result);
    }

    [Fact]
    public void FilterMemoriesForCharacter_CapsAtFivePerTurn()
    {
        var now = DateTimeOffset.UtcNow;
        var memories = Enumerable.Range(0, 10)
            .Select(i => Fact(1, $"key-{i}", CharacterMemoryFactType.WorldEvent, witnessedBy: new[] { 1 }, timestamp: now.AddMinutes(-i)))
            .ToArray();

        var result = CharacterMemoryService.FilterMemoriesForCharacter(1, memories);

        Assert.Equal(5, result.Count);
    }

    [Fact]
    public void FilterMemoriesForCharacter_PrioritizesWitnessedDirectlyOverToldOverWorldEvent()
    {
        var now = DateTimeOffset.UtcNow;
        var worldEvent = Fact(2, "world-event", CharacterMemoryFactType.WorldEvent, witnessedBy: new[] { 1, 2 }, timestamp: now);
        var toldByOther = Fact(2, "told", CharacterMemoryFactType.PlayerStatement, witnessedBy: new[] { 1, 2 }, timestamp: now.AddMinutes(-1));
        var witnessedDirectly = Fact(1, "witnessed", CharacterMemoryFactType.ItemInteraction, witnessedBy: new[] { 1 }, timestamp: now.AddMinutes(-2));

        var result = CharacterMemoryService.FilterMemoriesForCharacter(1, new[] { worldEvent, toldByOther, witnessedDirectly });

        Assert.Equal(new[] { "witnessed", "told", "world-event" }, result.Select(r => r.FactKey));
    }

    [Fact]
    public void FilterMemoriesForCharacter_OrdersByRecencyWithinSamePriorityTier()
    {
        var now = DateTimeOffset.UtcNow;
        var older = Fact(1, "older", CharacterMemoryFactType.ItemInteraction, witnessedBy: new[] { 1 }, timestamp: now.AddMinutes(-10));
        var newer = Fact(1, "newer", CharacterMemoryFactType.ItemInteraction, witnessedBy: new[] { 1 }, timestamp: now);

        var result = CharacterMemoryService.FilterMemoriesForCharacter(1, new[] { older, newer });

        Assert.Equal(new[] { "newer", "older" }, result.Select(r => r.FactKey));
    }

    [Fact]
    public void ExtractTopic_ReturnsNull_WhenMessageIsNullOrOnlyStopWords()
    {
        Assert.Null(CharacterMemoryService.ExtractTopic(null));
        Assert.Null(CharacterMemoryService.ExtractTopic("   "));
        Assert.Null(CharacterMemoryService.ExtractTopic("do you have it"));
    }

    [Fact]
    public void ExtractTopic_ReturnsLongestMeaningfulWord()
    {
        var topic = CharacterMemoryService.ExtractTopic("Where is the diamond?");

        Assert.Equal("diamond", topic);
    }

    [Fact]
    public void RecordRepeatedTopicQuery_ReturnsNull_WhenNoTopicExtracted()
    {
        var result = CharacterMemoryService.RecordRepeatedTopicQuery(1, "the a is", null, DateTimeOffset.UtcNow);

        Assert.Null(result);
    }

    [Fact]
    public void RecordRepeatedTopicQuery_StartsCounterAtOne_WhenNoExistingEntry()
    {
        var result = CharacterMemoryService.RecordRepeatedTopicQuery(1, "Where is the diamond?", null, DateTimeOffset.UtcNow);

        Assert.NotNull(result);
        Assert.Equal(1, result!.Count);
        Assert.True(result.IsCumulative);
        Assert.Equal(CharacterMemoryFactType.RepeatedTopicQuery, result.FactType);
        Assert.Contains(1, result.WitnessedBy);
    }

    [Fact]
    public void RecordRepeatedTopicQuery_IncrementsCounter_WhenSameTopicAskedAgain()
    {
        var now = DateTimeOffset.UtcNow;
        var first = CharacterMemoryService.RecordRepeatedTopicQuery(1, "Where is the diamond?", null, now)!;

        var second = CharacterMemoryService.RecordRepeatedTopicQuery(1, "Tell me about the diamond again", new[] { first }, now.AddMinutes(1));

        Assert.NotNull(second);
        Assert.Equal(2, second!.Count);
        Assert.Equal(first.FactKey, second.FactKey);
    }

    [Fact]
    public void RecordRepeatedTopicQuery_TracksSeparateCountersPerCharacter()
    {
        var now = DateTimeOffset.UtcNow;
        var characterOneEntry = CharacterMemoryService.RecordRepeatedTopicQuery(1, "Where is the diamond?", null, now)!;

        var characterTwoEntry = CharacterMemoryService.RecordRepeatedTopicQuery(2, "Where is the diamond?", new[] { characterOneEntry }, now)!;

        Assert.Equal(1, characterTwoEntry.Count);
        Assert.NotEqual(characterOneEntry.FactKey, characterTwoEntry.FactKey);
    }

    [Fact]
    public void RecordTurnMemories_ReturnsEmpty_WhenNoPlayerMessage()
    {
        var result = CharacterMemoryService.RecordTurnMemories(new[] { 1, 2 }, null, DateTimeOffset.UtcNow);

        Assert.Empty(result);
    }

    [Fact]
    public void RecordTurnMemories_ReturnsSharedFact_WitnessedByAllPresentCharacters()
    {
        var result = CharacterMemoryService.RecordTurnMemories(new[] { 1, 2, 3 }, "I found a key", DateTimeOffset.UtcNow);

        Assert.Single(result);
        Assert.Equal(new[] { 1, 2, 3 }, result[0].WitnessedBy);
        Assert.Equal(CharacterMemoryFactType.PlayerStatement, result[0].FactType);
    }

    [Fact]
    public void MergeMemories_OverwritesExistingEntry_WithSameCharacterAndFactKey()
    {
        var now = DateTimeOffset.UtcNow;
        var original = Fact(1, "key-a", CharacterMemoryFactType.WorldEvent, witnessedBy: new[] { 1 }, timestamp: now);
        var updated = original with { FactText = "fact:updated", TimestampUtc = now.AddMinutes(1) };

        var merged = CharacterMemoryService.MergeMemories(new[] { original }, new[] { updated });

        Assert.Single(merged);
        Assert.Equal("fact:updated", merged[0].FactText);
    }

    [Fact]
    public void MergeMemories_KeepsDistinctEntries_WithDifferentFactKeys()
    {
        var now = DateTimeOffset.UtcNow;
        var existing = Fact(1, "key-a", CharacterMemoryFactType.WorldEvent, witnessedBy: new[] { 1 }, timestamp: now);
        var newEntry = Fact(1, "key-b", CharacterMemoryFactType.ItemInteraction, witnessedBy: new[] { 1 }, timestamp: now.AddMinutes(1));

        var merged = CharacterMemoryService.MergeMemories(new[] { existing }, new[] { newEntry });

        Assert.Equal(2, merged.Count);
    }
}
