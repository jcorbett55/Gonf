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
    SaveGonfExitsRequest Exits,
    SaveGonfRoomImageRequest? Image = null
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
    IReadOnlyList<int> Contents,
    SaveGonfItemImageRequest? Image = null
);

public sealed record SaveGonfCharacterRequest(
    int CharacterId,
    string CharacterName,
    string Description,
    int? Location,
    bool Wanderer,
    IReadOnlyList<int> Contains,
    SaveGonfCharacterImageRequest? Image = null
);

public sealed record SaveGonfRoomImageRequest(
    string? ImageStatus,
    int? AttemptIndex,
    string? GenerationSeed,
    DateTimeOffset? GeneratedUtc,
    DateTimeOffset? FinalizedUtc,
    string? FileName,
    string? RelativePath,
    string? PreviewDataUrl
);

public sealed record SaveGonfCharacterImageRequest(
    string? ImageStatus,
    int? AttemptIndex,
    string? GenerationSeed,
    DateTimeOffset? GeneratedUtc,
    DateTimeOffset? FinalizedUtc,
    string? FileName,
    string? RelativePath,
    string? PreviewDataUrl
);

public sealed record SaveGonfItemImageRequest(
    string? ImageStatus,
    int? AttemptIndex,
    string? GenerationSeed,
    DateTimeOffset? GeneratedUtc,
    DateTimeOffset? FinalizedUtc,
    string? FileName,
    string? RelativePath,
    string? PreviewDataUrl
);
