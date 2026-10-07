using System.Text.Json;
using Gonf.Api.Services;

namespace Gonf.Api.Tests;

public class MysteryCaseFileStorageServiceTests
{
    private static string GonfDirectory(string gonfName) => Path.Combine(@"C:\gonf\\", gonfName);

    private static async Task WriteAuthoredGonfAsync(string gonfName)
    {
        var gonfDirectory = GonfDirectory(gonfName);
        Directory.CreateDirectory(gonfDirectory);

        var payload = new
        {
            format = "Gonf",
            schemaVersion = "1.0",
            gonfName,
            goal = "Find the culprit.",
            rooms = new[]
            {
                new { roomId = 1, roomName = "Study", roomDescription = "A study.", roomFloor = 0, isStartingRoom = true, exits = new { north = (int?)null, east = (int?)null, south = (int?)null, west = (int?)null, up = (int?)null, down = (int?)null } },
                new { roomId = 2, roomName = "Hall", roomDescription = "A hall.", roomFloor = 0, isStartingRoom = false, exits = new { north = (int?)null, east = (int?)null, south = (int?)null, west = (int?)null, up = (int?)null, down = (int?)null } },
            },
            items = new[]
            {
                new { itemId = 10, itemName = "Knife", itemWeight = (decimal?)null, itemDescription = "A knife.", itemValue = (decimal?)null, canHoldItems = false, canBeCarried = true, location = (int?)1, contents = Array.Empty<int>() },
                new { itemId = 11, itemName = "Note", itemWeight = (decimal?)null, itemDescription = "A note.", itemValue = (decimal?)null, canHoldItems = false, canBeCarried = true, location = (int?)2, contents = Array.Empty<int>() },
            },
            characters = new[]
            {
                new { characterId = 1, characterName = "Alice", description = "Alice.", location = (int?)1, wanderer = false, contains = Array.Empty<int>() },
                new { characterId = 2, characterName = "Bob", description = "Bob.", location = (int?)2, wanderer = true, contains = Array.Empty<int>() },
            },
        };

        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(Path.Combine(gonfDirectory, $"{gonfName}.json"), json);
    }

    [Fact]
    public async Task LoadOrGenerateAsync_ReturnsNull_WhenAuthoredGonfMissing()
    {
        var gonfName = $"MissingGonf_{Guid.NewGuid():N}";
        var service = new MysteryCaseFileStorageService();

        var result = await service.LoadOrGenerateAsync(gonfName, "default", CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task LoadOrGenerateAsync_PersistsCaseFile_AndIsStableAcrossReloads()
    {
        var gonfName = $"MysteryGonf_{Guid.NewGuid():N}";
        var gonfDirectory = GonfDirectory(gonfName);

        try
        {
            await WriteAuthoredGonfAsync(gonfName);
            var service = new MysteryCaseFileStorageService();

            var first = await service.LoadOrGenerateAsync(gonfName, "default", CancellationToken.None);
            Assert.NotNull(first);

            var caseFilePath = Path.Combine(gonfDirectory, "saves", "default.casefile.json");
            Assert.True(File.Exists(caseFilePath));

            var second = await service.LoadOrGenerateAsync(gonfName, "default", CancellationToken.None);
            Assert.NotNull(second);

            Assert.Equal(first!.GuiltyCharacterId, second!.GuiltyCharacterId);
            Assert.Equal(
                first.Clues.Select(c => (c.ItemId, c.RoomId, c.WitnessCharacterId)),
                second.Clues.Select(c => (c.ItemId, c.RoomId, c.WitnessCharacterId)));
        }
        finally
        {
            if (Directory.Exists(gonfDirectory))
            {
                Directory.Delete(gonfDirectory, recursive: true);
            }
        }
    }

    [Fact]
    public async Task LoadOrGenerateAsync_DifferentSaveIds_CanProduceDifferentCaseFiles()
    {
        var gonfName = $"MysteryGonfMulti_{Guid.NewGuid():N}";
        var gonfDirectory = GonfDirectory(gonfName);

        try
        {
            await WriteAuthoredGonfAsync(gonfName);
            var service = new MysteryCaseFileStorageService();

            var saveOne = await service.LoadOrGenerateAsync(gonfName, "save-one", CancellationToken.None);
            var saveTwo = await service.LoadOrGenerateAsync(gonfName, "save-two", CancellationToken.None);

            Assert.NotNull(saveOne);
            Assert.NotNull(saveTwo);

            // Not asserting they differ (they legitimately could match by chance), just that both
            // independently generated and persisted without interfering with each other.
            Assert.True(File.Exists(Path.Combine(gonfDirectory, "saves", "save-one.casefile.json")));
            Assert.True(File.Exists(Path.Combine(gonfDirectory, "saves", "save-two.casefile.json")));
        }
        finally
        {
            if (Directory.Exists(gonfDirectory))
            {
                Directory.Delete(gonfDirectory, recursive: true);
            }
        }
    }
}
