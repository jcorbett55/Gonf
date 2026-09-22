namespace Gonf.Api.Models;

public enum CharacterMemoryFactType
{
    ItemInteraction,
    WorldEvent,
    PlayerStatement,
    RepeatedTopicQuery,
}

/// <summary>
/// A single remembered fact scoped to one character's perspective within a player save.
/// </summary>
/// <param name="CharacterId">
/// The character that "owns" this memory entry - i.e. the character this record was originally
/// filed under (typically the character present when the fact was created, or the primary
/// subject of a <see cref="CharacterMemoryFactType.RepeatedTopicQuery"/> counter). This is the
/// character used for "witnessed-directly" priority ranking in
/// <see cref="CharacterMemoryEntry"/>-consuming code (see CharacterMemoryService.GetPriorityRank).
/// </param>
/// <param name="WitnessedBy">
/// Every character allowed to recall this fact, including the owning <see cref="CharacterId"/>.
/// A character not in this list must never reference the fact (see AC #2, GONF-011). Characters
/// in this list other than <see cref="CharacterId"/> are treated as "told about it" rather than
/// "witnessed it directly" for prioritization purposes - v1 does not track a separate
/// first-hand-witness list distinct from <see cref="CharacterId"/>; if that distinction becomes
/// insufficient (e.g. multiple characters directly witnessing the same event as equal firsthand
/// parties), split this into separate WitnessedBy/ToldTo lists.
/// </param>
public sealed record CharacterMemoryEntry(
    int CharacterId,
    string FactKey,
    CharacterMemoryFactType FactType,
    string FactText,
    IReadOnlyList<int> WitnessedBy,
    bool IsCumulative,
    int Count,
    DateTimeOffset TimestampUtc
);
