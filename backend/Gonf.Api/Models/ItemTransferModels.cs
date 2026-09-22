namespace Gonf.Api.Models;

/// <summary>
/// A stateless request to transfer a single item between the player and a character, per
/// GONF-012. The caller supplies the current in-memory inventory state (player ItemIds,
/// characters with Contains, and any tracked RoomItemLocations) and this returns the updated
/// state after enforcing the three-way single-location invariant - it does not itself persist
/// anything to a save file.
/// </summary>
public sealed record ItemTransferRequest(
    int ItemId,
    int CharacterId,
    bool ToCharacter,
    string Action,
    IReadOnlyList<int>? PlayerItemIds = null,
    IReadOnlyList<PlayerSaveStateCharacterRequest>? Characters = null,
    IReadOnlyList<PlayerSaveStateItemLocationRequest>? RoomItemLocations = null
);

public sealed record ItemTransferResponse(
    bool Allowed,
    IReadOnlyList<int> PlayerItemIds,
    IReadOnlyList<PlayerSaveStateCharacterRequest> Characters,
    IReadOnlyList<PlayerSaveStateItemLocationRequest> RoomItemLocations,
    CharacterMemoryEntry? MemoryFact
);
