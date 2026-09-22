using System.Text.Json;
using Gonf.Api.Models;

namespace Gonf.Api.Services;

public sealed class PlayerSaveStateService
{
    private const string SaveRootDirectory = @"C:\gonf\\";

    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        WriteIndented = true,
    };

    public static bool IsValidIdentifier(string value)
    {
        return !string.IsNullOrWhiteSpace(value) && value.IndexOfAny(Path.GetInvalidFileNameChars()) < 0;
    }

    private static string GetSaveFilePath(string gonfName, string saveId)
    {
        var savesDirectory = Path.Combine(SaveRootDirectory, gonfName, "saves");
        return Path.Combine(savesDirectory, $"{saveId}.json");
    }

    public async Task<PlayerSaveStateResponse?> LoadAsync(string gonfName, string saveId, CancellationToken cancellationToken)
    {
        var filePath = GetSaveFilePath(gonfName, saveId);
        if (!File.Exists(filePath))
        {
            return null;
        }

        await using var stream = File.OpenRead(filePath);
        var saveState = await JsonSerializer.DeserializeAsync<PlayerSaveStateResponse>(stream, SerializerOptions, cancellationToken);

        // Legacy save files predate character memory support and have no "characterMemory" property
        // at all; treat that as "no memories yet" rather than surfacing a null to callers.
        if (saveState is { CharacterMemory: null })
        {
            saveState = saveState with { CharacterMemory = Array.Empty<CharacterMemoryEntry>() };
        }

        return saveState;
    }

    public async Task<PlayerSaveStateResponse> SaveAsync(
        string gonfName,
        string saveId,
        PlayerSaveStateRequest request,
        CancellationToken cancellationToken)
    {
        var savesDirectory = Path.Combine(SaveRootDirectory, gonfName, "saves");
        Directory.CreateDirectory(savesDirectory);

        var response = new PlayerSaveStateResponse(
            GonfName: gonfName,
            SaveId: saveId,
            CurrentRoomId: request.CurrentRoomId,
            Characters: request.Characters,
            Flags: request.Flags ?? new Dictionary<string, object?>(),
            ConversationHistory: request.ConversationHistory ?? Array.Empty<PlayerConversationEntryRequest>(),
            UpdatedUtc: DateTimeOffset.UtcNow,
            CharacterMemory: request.CharacterMemory ?? Array.Empty<CharacterMemoryEntry>()
        );

        var filePath = GetSaveFilePath(gonfName, saveId);
        var json = JsonSerializer.Serialize(response, SerializerOptions);
        await File.WriteAllTextAsync(filePath, json, cancellationToken);

        return response;
    }
}
