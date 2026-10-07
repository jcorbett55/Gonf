using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Gonf.Api.Tests;

public class MysteryCaseFileEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public MysteryCaseFileEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

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
            },
            items = new[]
            {
                new { itemId = 10, itemName = "Knife", itemWeight = (decimal?)null, itemDescription = "A knife.", itemValue = (decimal?)null, canHoldItems = false, canBeCarried = true, location = (int?)1, contents = Array.Empty<int>() },
            },
            characters = new[]
            {
                new { characterId = 1, characterName = "Alice", description = "Alice.", location = (int?)1, wanderer = false, contains = Array.Empty<int>() },
            },
        };

        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(Path.Combine(gonfDirectory, $"{gonfName}.json"), json);
    }

    [Fact]
    public async Task GetCaseFile_WhenNoAuthoredGonfExists_ReturnsNotFound()
    {
        using var client = _factory.CreateClient();
        var gonfName = $"NoAuthoredGonf_{Guid.NewGuid():N}";

        var response = await client.GetAsync($"/api/gonf/{gonfName}/playstate/default/casefile");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetCaseFile_WithInvalidIdentifiers_ReturnsBadRequest()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/gonf/bad|name/playstate/default/casefile");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetCaseFile_GeneratesAndPersistsCaseFile_ForAuthoredGonf()
    {
        var gonfName = $"CaseFileEndpoint_{Guid.NewGuid():N}";
        var gonfDirectory = GonfDirectory(gonfName);

        try
        {
            await WriteAuthoredGonfAsync(gonfName);
            using var client = _factory.CreateClient();

            var response = await client.GetAsync($"/api/gonf/{gonfName}/playstate/default/casefile");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
            var data = payload.GetProperty("data");

            Assert.True(data.TryGetProperty("guiltyCharacterId", out _));
            Assert.Equal(1, data.GetProperty("guiltyCharacterId").GetInt32());

            var caseFilePath = Path.Combine(gonfDirectory, "saves", "default.casefile.json");
            Assert.True(File.Exists(caseFilePath));
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
    public async Task PutPlayerSaveState_TriggersCaseFileGeneration_AndMergesSynthesizedItemsIntoRoomLocations()
    {
        var gonfName = $"SaveTriggersCaseFile_{Guid.NewGuid():N}";
        var gonfDirectory = GonfDirectory(gonfName);

        try
        {
            await WriteAuthoredGonfAsync(gonfName);
            using var client = _factory.CreateClient();

            var request = new
            {
                currentRoomId = 1,
                characters = new[]
                {
                    new { characterId = 1, location = "1" },
                },
                roomItemLocations = Array.Empty<object>(),
            };

            var putResponse = await client.PutAsJsonAsync($"/api/gonf/{gonfName}/playstate/default", request);
            Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

            var caseFilePath = Path.Combine(gonfDirectory, "saves", "default.casefile.json");
            Assert.True(File.Exists(caseFilePath));

            var putPayload = await putResponse.Content.ReadFromJsonAsync<JsonElement>();
            var putData = putPayload.GetProperty("data");

            // The single authored item is too sparse for the minimum clue threshold, so
            // synthesized clue items should have been merged into RoomItemLocations.
            Assert.True(putData.GetProperty("roomItemLocations").GetArrayLength() > 0);

            // The case file itself must never appear in the player-facing save-state response.
            Assert.False(putData.TryGetProperty("guiltyCharacterId", out _));
            Assert.False(putData.TryGetProperty("caseFile", out _));
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
