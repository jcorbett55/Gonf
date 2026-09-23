namespace Gonf.Api.Models;

public sealed record PlayerSaveStateCharacterRequest(
    int CharacterId,
    string? Location,
    IReadOnlyList<int>? Contains = null
);

/// <summary>
/// Tracks the current room location of an item during a playthrough. This is the runtime-side
/// bucket for the "room" leg of the three-way item-location invariant (room / character.Contains
/// / player.ItemIds) - the authored SaveGonfItemRequest.Location is design-time data and is never
/// mutated by gameplay, so item movement between rooms/characters/player must be tracked here.
/// </summary>
public sealed record PlayerSaveStateItemLocationRequest(
    int ItemId,
    int RoomId
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
    IReadOnlyList<CharacterMemoryEntry>? CharacterMemory = null,
    IReadOnlyList<int>? ItemIds = null,
    IReadOnlyList<PlayerSaveStateItemLocationRequest>? RoomItemLocations = null
);

public sealed record PlayerSaveStateResponse(
    string GonfName,
    string SaveId,
    int CurrentRoomId,
    IReadOnlyList<PlayerSaveStateCharacterRequest> Characters,
    IReadOnlyDictionary<string, object?> Flags,
    IReadOnlyList<PlayerConversationEntryRequest> ConversationHistory,
    DateTimeOffset UpdatedUtc,
    IReadOnlyList<CharacterMemoryEntry>? CharacterMemory = null,
    IReadOnlyList<int>? ItemIds = null,
    IReadOnlyList<PlayerSaveStateItemLocationRequest>? RoomItemLocations = null
);
