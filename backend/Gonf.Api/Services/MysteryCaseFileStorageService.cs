using System.Text.Json;
using Gonf.Api.Models;

namespace Gonf.Api.Services;

/// <summary>
/// Loads or lazily generates the hidden <see cref="MysteryCaseFile"/> for a playthrough
/// (GONF-013). The case file is generated once, the first time it is requested for a given
/// (gonfName, saveId), and persisted to its own file separate from
/// <see cref="PlayerSaveStateResponse"/> so it can never be serialized into a player-facing save
/// response (GONF-013 Business Rule 2, Non-Functional Requirement 3). Subsequent requests return
/// the same stored case file, keeping the solution stable across reloads (Business Rule 3).
/// </summary>
public sealed class MysteryCaseFileStorageService
{
    private const string SaveRootDirectory = @"C:\gonf\\";

    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        WriteIndented = true,
    };

    private static string GetCaseFilePath(string gonfName, string saveId)
    {
        var savesDirectory = Path.Combine(SaveRootDirectory, gonfName, "saves");
        return Path.Combine(savesDirectory, $"{saveId}.casefile.json");
    }

    private static string GetAuthoredGonfPath(string gonfName)
    {
        return Path.Combine(SaveRootDirectory, gonfName, $"{gonfName}.json");
    }

    /// <summary>
    /// Returns the existing case file for (gonfName, saveId) if one was already generated,
    /// otherwise generates one from the authored Gonf's rooms/items/characters, persists it, and
    /// returns the newly generated file. Returns null when the authored Gonf cannot be read or has
    /// no characters (no possible guilty party).
    /// </summary>
    public async Task<MysteryCaseFile?> LoadOrGenerateAsync(string gonfName, string saveId, CancellationToken cancellationToken)
    {
        var caseFilePath = GetCaseFilePath(gonfName, saveId);
        if (File.Exists(caseFilePath))
        {
            await using var existingStream = File.OpenRead(caseFilePath);
            return await JsonSerializer.DeserializeAsync<MysteryCaseFile>(existingStream, SerializerOptions, cancellationToken);
        }

        var authoredGonfPath = GetAuthoredGonfPath(gonfName);
        if (!File.Exists(authoredGonfPath))
        {
            return null;
        }

        using var document = JsonDocument.Parse(await File.ReadAllTextAsync(authoredGonfPath, cancellationToken));
        var root = document.RootElement;

        var characters = ReadCharacters(root);
        var items = ReadItems(root);
        var rooms = ReadRooms(root);

        var seed = BuildSeed(gonfName, saveId);
        var caseFile = MysteryCaseFileGenerationService.Generate(characters, items, rooms, seed);
        if (caseFile is null)
        {
            return null;
        }

        var savesDirectory = Path.Combine(SaveRootDirectory, gonfName, "saves");
        Directory.CreateDirectory(savesDirectory);

        var json = JsonSerializer.Serialize(caseFile, SerializerOptions);
        await File.WriteAllTextAsync(caseFilePath, json, cancellationToken);

        return caseFile;
    }

    /// <summary>
    /// Merges a case file's <see cref="MysteryCaseFile.SynthesizedItems"/> into a playthrough's
    /// runtime <see cref="PlayerSaveStateItemLocationRequest"/> list so synthesized clue items
    /// behave identically to authored items during play (GONF-013 Acceptance Criteria 2) - they
    /// can be picked up, held, examined, and transferred through the existing item-transfer
    /// pipeline. Items already present (by ItemId) are left untouched to avoid duplicating an
    /// item across multiple room-location entries.
    /// </summary>
    public static IReadOnlyList<PlayerSaveStateItemLocationRequest> MergeSynthesizedItemsIntoRoomLocations(
        MysteryCaseFile caseFile,
        IReadOnlyList<PlayerSaveStateItemLocationRequest> roomItemLocations)
    {
        if (caseFile.SynthesizedItems.Count == 0)
        {
            return roomItemLocations;
        }

        var existingItemIds = roomItemLocations.Select(location => location.ItemId).ToHashSet();
        var merged = roomItemLocations.ToList();

        foreach (var synthesizedItem in caseFile.SynthesizedItems)
        {
            if (existingItemIds.Contains(synthesizedItem.ItemId) || synthesizedItem.Location is null)
            {
                continue;
            }

            merged.Add(new PlayerSaveStateItemLocationRequest(synthesizedItem.ItemId, synthesizedItem.Location.Value));
        }

        return merged;
    }

    /// <summary>
    /// Derives a stable, deterministic seed from the playthrough identity so repeated generation
    /// requests for the same (gonfName, saveId) would produce the same result even without a
    /// persisted case file present yet (GONF-013 Non-Functional Requirement 1).
    /// </summary>
    private static int BuildSeed(string gonfName, string saveId)
    {
        unchecked
        {
            var hash = 17;
            hash = hash * 31 + gonfName.GetHashCode(StringComparison.Ordinal);
            hash = hash * 31 + saveId.GetHashCode(StringComparison.Ordinal);
            return hash;
        }
    }

    private static IReadOnlyList<SaveGonfCharacterRequest> ReadCharacters(JsonElement root)
    {
        if (!root.TryGetProperty("characters", out var charactersElement) || charactersElement.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<SaveGonfCharacterRequest>();
        }

        var characters = new List<SaveGonfCharacterRequest>();
        foreach (var characterElement in charactersElement.EnumerateArray())
        {
            var characterId = characterElement.TryGetProperty("characterId", out var idValue) ? idValue.GetInt32() : 0;
            var characterName = characterElement.TryGetProperty("characterName", out var nameValue) ? nameValue.GetString() ?? string.Empty : string.Empty;
            var description = characterElement.TryGetProperty("description", out var descValue) ? descValue.GetString() ?? string.Empty : string.Empty;
            int? location = characterElement.TryGetProperty("location", out var locValue) && locValue.ValueKind == JsonValueKind.Number ? locValue.GetInt32() : null;
            var wanderer = characterElement.TryGetProperty("wanderer", out var wandererValue) && wandererValue.ValueKind == JsonValueKind.True;
            var contains = characterElement.TryGetProperty("contains", out var containsValue) && containsValue.ValueKind == JsonValueKind.Array
                ? containsValue.EnumerateArray().Select(entry => entry.GetInt32()).ToArray()
                : Array.Empty<int>();

            characters.Add(new SaveGonfCharacterRequest(characterId, characterName, description, location, wanderer, contains));
        }

        return characters;
    }

    private static IReadOnlyList<SaveGonfItemRequest> ReadItems(JsonElement root)
    {
        if (!root.TryGetProperty("items", out var itemsElement) || itemsElement.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<SaveGonfItemRequest>();
        }

        var items = new List<SaveGonfItemRequest>();
        foreach (var itemElement in itemsElement.EnumerateArray())
        {
            var itemId = itemElement.TryGetProperty("itemId", out var idValue) ? idValue.GetInt32() : 0;
            var itemName = itemElement.TryGetProperty("itemName", out var nameValue) ? nameValue.GetString() ?? string.Empty : string.Empty;
            decimal? itemWeight = itemElement.TryGetProperty("itemWeight", out var weightValue) && weightValue.ValueKind == JsonValueKind.Number ? weightValue.GetDecimal() : null;
            var itemDescription = itemElement.TryGetProperty("itemDescription", out var descValue) ? descValue.GetString() ?? string.Empty : string.Empty;
            decimal? itemValue = itemElement.TryGetProperty("itemValue", out var valueValue) && valueValue.ValueKind == JsonValueKind.Number ? valueValue.GetDecimal() : null;
            var canHoldItems = itemElement.TryGetProperty("canHoldItems", out var canHoldValue) && canHoldValue.ValueKind == JsonValueKind.True;
            var canBeCarried = itemElement.TryGetProperty("canBeCarried", out var canCarryValue) && canCarryValue.ValueKind == JsonValueKind.True;
            int? location = itemElement.TryGetProperty("location", out var locValue) && locValue.ValueKind == JsonValueKind.Number ? locValue.GetInt32() : null;
            var contents = itemElement.TryGetProperty("contents", out var contentsValue) && contentsValue.ValueKind == JsonValueKind.Array
                ? contentsValue.EnumerateArray().Select(entry => entry.GetInt32()).ToArray()
                : Array.Empty<int>();

            items.Add(new SaveGonfItemRequest(itemId, itemName, itemWeight, itemDescription, itemValue, canHoldItems, canBeCarried, location, contents));
        }

        return items;
    }

    private static IReadOnlyList<SaveGonfRoomRequest> ReadRooms(JsonElement root)
    {
        if (!root.TryGetProperty("rooms", out var roomsElement) || roomsElement.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<SaveGonfRoomRequest>();
        }

        var rooms = new List<SaveGonfRoomRequest>();
        foreach (var roomElement in roomsElement.EnumerateArray())
        {
            var roomId = roomElement.TryGetProperty("roomId", out var idValue) ? idValue.GetInt32() : 0;
            var roomName = roomElement.TryGetProperty("roomName", out var nameValue) ? nameValue.GetString() ?? string.Empty : string.Empty;
            var roomDescription = roomElement.TryGetProperty("roomDescription", out var descValue) ? descValue.GetString() ?? string.Empty : string.Empty;
            var roomFloor = roomElement.TryGetProperty("roomFloor", out var floorValue) && floorValue.ValueKind == JsonValueKind.Number ? floorValue.GetInt32() : 0;
            var isStartingRoom = roomElement.TryGetProperty("isStartingRoom", out var startingValue) && startingValue.ValueKind == JsonValueKind.True;

            int? ReadExit(JsonElement exitsElement, string propertyName)
            {
                return exitsElement.TryGetProperty(propertyName, out var exitValue) && exitValue.ValueKind == JsonValueKind.Number
                    ? exitValue.GetInt32()
                    : null;
            }

            var exits = new SaveGonfExitsRequest(null, null, null, null, null, null);
            if (roomElement.TryGetProperty("exits", out var exitsElement) && exitsElement.ValueKind == JsonValueKind.Object)
            {
                exits = new SaveGonfExitsRequest(
                    ReadExit(exitsElement, "north"),
                    ReadExit(exitsElement, "east"),
                    ReadExit(exitsElement, "south"),
                    ReadExit(exitsElement, "west"),
                    ReadExit(exitsElement, "up"),
                    ReadExit(exitsElement, "down"));
            }

            rooms.Add(new SaveGonfRoomRequest(roomId, roomName, roomDescription, roomFloor, exits, Image: null, isStartingRoom));
        }

        return rooms;
    }
}
