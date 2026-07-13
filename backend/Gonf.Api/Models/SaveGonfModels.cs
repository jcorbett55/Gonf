namespace Gonf.Api.Models;

public sealed record SaveGonfRequest(
    string GonfName,
    IReadOnlyList<SaveGonfRoomRequest> Rooms,
    IReadOnlyList<SaveGonfItemRequest>? Items = null,
    IReadOnlyList<SaveGonfCharacterRequest>? Characters = null
);

public sealed record SaveGonfRoomRequest(
    int RoomId,
    string RoomName,
    string RoomDescription,
    int RoomFloor,
    SaveGonfExitsRequest Exits
);

public sealed record SaveGonfExitsRequest(int? North, int? East, int? South, int? West, int? Up, int? Down);

public sealed record SaveGonfItemRequest(
    int ItemId,
    string ItemName,
    decimal? ItemWeight,
    string ItemDescription,
    decimal? ItemValue,
    bool CanHoldItems,
    bool CanBeCarried,
    int? Location,
    IReadOnlyList<int> Contents
);

public sealed record SaveGonfCharacterRequest(
    int CharacterId,
    string CharacterName,
    string Description,
    int? Location,
    bool Wanderer,
    IReadOnlyList<int> Contains
);
