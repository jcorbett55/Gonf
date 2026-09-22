namespace Gonf.Api.Models;

public sealed record PlayerSaveStateCharacterRequest(
    int CharacterId,
    string? Location
);

public sealed record PlayerConversationEntryRequest(
    int CharacterId,
    string Speaker,
    string Text,
    DateTimeOffset TimestampUtc
);

public sealed record PlayerSaveStateRequest(
    int CurrentRoomId,
    IReadOnlyList<PlayerSaveStateCharacterRequest> Characters,
    IReadOnlyDictionary<string, object?>? Flags = null,
    IReadOnlyList<PlayerConversationEntryRequest>? ConversationHistory = null,
    IReadOnlyList<CharacterMemoryEntry>? CharacterMemory = null
);

public sealed record PlayerSaveStateResponse(
    string GonfName,
    string SaveId,
    int CurrentRoomId,
    IReadOnlyList<PlayerSaveStateCharacterRequest> Characters,
    IReadOnlyDictionary<string, object?> Flags,
    IReadOnlyList<PlayerConversationEntryRequest> ConversationHistory,
    DateTimeOffset UpdatedUtc,
    IReadOnlyList<CharacterMemoryEntry>? CharacterMemory = null
);
