using Gonf.Api.Models;

namespace Gonf.Api.Services;

public static class CharacterMemoryService
{
    private const int MaxMemoriesPerCharacterPerTurn = 5;

    // Common stop-words stripped out during topic extraction so short filler words never
    // become a "topic" for RepeatedTopicQuery tracking.
    private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "a", "an", "the", "is", "are", "was", "were", "do", "does", "did", "you", "your",
        "have", "has", "had", "what", "where", "who", "why", "how", "about", "of", "to",
        "me", "my", "i", "it", "its", "can", "could", "will", "would", "please", "tell",
        "know", "and", "or", "in", "on", "at", "for", "with", "that", "this",
    };

    /// <summary>
    /// Extracts a normalized "topic" keyword from a player message, used to key
    /// <see cref="CharacterMemoryFactType.RepeatedTopicQuery"/> tracking. This is a simple
    /// heuristic (longest non-stop-word token), not NLP - see GONF-011 Open Questions.
    /// Returns null when no meaningful topic can be extracted.
    /// </summary>
    public static string? ExtractTopic(string? playerMessage)
    {
        if (string.IsNullOrWhiteSpace(playerMessage))
        {
            return null;
        }

        var candidateWords = playerMessage
            .Split(new[] { ' ', '\t', '\n', '\r', '.', ',', '!', '?', '\'', '"', ';', ':' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(word => word.Trim().ToLowerInvariant())
            .Where(word => word.Length > 2 && !StopWords.Contains(word))
            .ToArray();

        if (candidateWords.Length == 0)
        {
            return null;
        }

        return candidateWords.OrderByDescending(word => word.Length).First();
    }

    /// <summary>
    /// Builds the updated <see cref="CharacterMemoryEntry"/> for a <see cref="CharacterMemoryFactType.RepeatedTopicQuery"/>
    /// counter given a player message directed at a character: increments the existing counter for
    /// (characterId, topic) if one exists, otherwise starts a new counter at 1. Returns null when no
    /// topic could be extracted from the message.
    /// </summary>
    public static CharacterMemoryEntry? RecordRepeatedTopicQuery(
        int characterId,
        string? playerMessage,
        IReadOnlyList<CharacterMemoryEntry>? existingMemories,
        DateTimeOffset timestampUtc)
    {
        var topic = ExtractTopic(playerMessage);
        if (topic is null)
        {
            return null;
        }

        var factKey = BuildRepeatedTopicFactKey(characterId, topic);
        var existing = existingMemories?.FirstOrDefault(memory =>
            memory.FactType == CharacterMemoryFactType.RepeatedTopicQuery
            && memory.CharacterId == characterId
            && string.Equals(memory.FactKey, factKey, StringComparison.Ordinal));

        var nextCount = (existing?.Count ?? 0) + 1;

        return new CharacterMemoryEntry(
            characterId,
            factKey,
            CharacterMemoryFactType.RepeatedTopicQuery,
            $"The player has asked about \"{topic}\"",
            new[] { characterId },
            IsCumulative: true,
            nextCount,
            timestampUtc);
    }

    private static string BuildRepeatedTopicFactKey(int characterId, string topic) => $"repeated-topic:{characterId}:{topic}";

    /// <summary>
    /// Builds new memory entries recorded after a completed conversation turn: every character
    /// present in the turn is treated as witnessing the turn's dialogue (v1 "witnessed by everyone
    /// present" model - see GONF-011 Architecture Notes), and any items carried by a speaking
    /// character produce an ItemInteraction fact recallable by all present characters.
    /// </summary>
    public static IReadOnlyList<CharacterMemoryEntry> RecordTurnMemories(
        IReadOnlyList<int> presentCharacterIds,
        string? playerMessage,
        DateTimeOffset timestampUtc)
    {
        if (presentCharacterIds is not { Count: > 0 } || string.IsNullOrWhiteSpace(playerMessage))
        {
            return Array.Empty<CharacterMemoryEntry>();
        }

        var factKey = $"player-statement:{timestampUtc:O}";
        var entry = new CharacterMemoryEntry(
            presentCharacterIds[0],
            factKey,
            CharacterMemoryFactType.PlayerStatement,
            $"The player said: \"{playerMessage}\"",
            presentCharacterIds.Distinct().ToArray(),
            IsCumulative: false,
            Count: 0,
            timestampUtc);

        return new[] { entry };
    }

    /// <summary>
    /// Filters the full memory set down to only the facts a given character is allowed to recall:
    /// facts it witnessed directly, or facts it was explicitly told about (both represented via WitnessedBy).
    /// Then applies the per-turn cap, prioritized witnessed-directly &gt; told-by-other &gt; world-event, then recency.
    /// </summary>
    public static IReadOnlyList<CharacterMemoryEntry> FilterMemoriesForCharacter(
        int characterId,
        IReadOnlyList<CharacterMemoryEntry>? allMemories)
    {
        if (allMemories is null || allMemories.Count == 0)
        {
            return Array.Empty<CharacterMemoryEntry>();
        }

        var recallable = allMemories.Where(memory => memory.WitnessedBy.Contains(characterId));

        return recallable
            .OrderBy(memory => GetPriorityRank(memory, characterId))
            .ThenByDescending(memory => memory.TimestampUtc)
            .Take(MaxMemoriesPerCharacterPerTurn)
            .ToList();
    }

    private static int GetPriorityRank(CharacterMemoryEntry memory, int characterId)
    {
        // Witnessed-directly: this character is the sole/original witness (owns the fact as its own experience).
        if (memory.CharacterId == characterId)
        {
            return 0;
        }

        // Told-by-other: this character was added to WitnessedBy but is not the fact's origin.
        if (memory.FactType != CharacterMemoryFactType.WorldEvent)
        {
            return 1;
        }

        // World-event facts the character merely knows about, but didn't originate.
        return 2;
    }

    /// <summary>
    /// Merges newly recorded entries into an existing memory set using the default resolution rule:
    /// overwrite the prior entry for a given (CharacterId, FactKey), except entries the caller marks
    /// IsCumulative (RepeatedTopicQuery), which replace the prior entry by key but already carry a
    /// pre-incremented Count computed by <see cref="RecordRepeatedTopicQuery"/>.
    /// </summary>
    public static IReadOnlyList<CharacterMemoryEntry> MergeMemories(
        IReadOnlyList<CharacterMemoryEntry>? existingMemories,
        IReadOnlyList<CharacterMemoryEntry> newEntries)
    {
        var merged = new Dictionary<(int CharacterId, string FactKey), CharacterMemoryEntry>();

        foreach (var memory in existingMemories ?? Array.Empty<CharacterMemoryEntry>())
        {
            merged[(memory.CharacterId, memory.FactKey)] = memory;
        }

        foreach (var entry in newEntries)
        {
            merged[(entry.CharacterId, entry.FactKey)] = entry;
        }

        return merged.Values
            .OrderBy(memory => memory.TimestampUtc)
            .ToList();
    }
}
