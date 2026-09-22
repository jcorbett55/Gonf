namespace Gonf.Api.Models;

public sealed record ConversationCharacterItemInfo(
    int ItemId,
    string ItemName,
    string ItemDescription
);

public sealed record ConversationCharacterInfo(
    int CharacterId,
    string CharacterName,
    string CharacterDescription,
    IReadOnlyList<ConversationCharacterItemInfo>? CarriedItems = null,
    IReadOnlyList<CharacterMemoryEntry>? MemoryFacts = null
);

public sealed record ConversationTranscriptEntry(
    string Speaker,
    string Text
);

public sealed record ConversationTurnRequest(
    string RoomName,
    string RoomDescription,
    IReadOnlyList<ConversationCharacterInfo> Characters,
    IReadOnlyList<ConversationTranscriptEntry>? Transcript,
    string? PlayerMessage,
    IReadOnlyList<ConversationTranscriptEntry>? PreviousLines = null,
    IReadOnlyList<CharacterMemoryEntry>? CharacterMemory = null
);

public sealed record ConversationLine(
    string Speaker,
    string Text
);

public sealed record ConversationTurnResult(
    bool Success,
    IReadOnlyList<ConversationLine>? Lines,
    string? ErrorCode,
    string? ErrorMessage,
    IReadOnlyList<CharacterMemoryEntry>? UpdatedCharacterMemory = null
);
