namespace Gonf.Api.Models;

public sealed record GenerateRoomImageRequest(
    string? GonfName,
    int? RoomId,
    string RoomName,
    string RoomDescription,
    int AttemptIndex,
    string? GenerationSeed = null
);

public sealed record GenerateImageRequest(
    string Prompt,
    string? Model = null,
    string? Size = null
);

public sealed record ImageGenerationResult(
    bool Success,
    string? PreviewDataUrl,
    string? Model,
    string? ErrorCode,
    string? ErrorMessage
);
