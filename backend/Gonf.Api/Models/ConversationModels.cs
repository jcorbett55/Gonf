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
    IReadOnlyList<CharacterMemoryEntry>? CharacterMemory = null,
    // Identifies the playthrough (GONF-014) so the server can look up its hidden
    // MysteryCaseFile and inject shared-premise/escalation/witness dialogue behavior without
    // ever exposing case-file contents to the client. Optional so non-mystery Gonfs (or callers
    // that omit these) behave exactly as before (GONF-014 Edge Case 5).
    string? GonfName = null,
    string? SaveId = null,
    // Item ids currently held by the player, used to derive how many of the guilty character's
    // relevant clues have been discovered (GONF-014 Business Rule 3).
    IReadOnlyList<int>? PlayerHeldItemIds = null,
    // The authored Gonf's Goal text. When a MysteryCaseFile is active, this is folded into the
    // shared-premise prompt fragment so characters reference the concrete incident (for example,
    // the specific pizza/anchovies premise) rather than only a generic "mysterious event".
    string? Goal = null
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
