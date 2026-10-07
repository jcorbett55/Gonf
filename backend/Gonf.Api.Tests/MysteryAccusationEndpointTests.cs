using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Gonf.Api.Tests;

public class MysteryAccusationEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public MysteryAccusationEndpointTests(WebApplicationFactory<Program> factory)
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
    public async Task Accuse_WithInvalidIdentifiers_ReturnsBadRequest()
    {
        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/gonf/bad|name/playstate/default/accuse", new { accusedCharacterId = 1 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Accuse_WhenNoAuthoredGonfExists_ReturnsNotFound()
    {
        using var client = _factory.CreateClient();
        var gonfName = $"NoAuthoredGonf_{Guid.NewGuid():N}";

        var response = await client.PostAsJsonAsync($"/api/gonf/{gonfName}/playstate/default/accuse", new { accusedCharacterId = 1 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Accuse_WithOnlyGuiltyCharacterInRoster_ReturnsCorrectTrue()
    {
        var gonfName = $"AccuseCorrect_{Guid.NewGuid():N}";
        var gonfDirectory = GonfDirectory(gonfName);

        try
        {
            await WriteAuthoredGonfAsync(gonfName);
            using var client = _factory.CreateClient();

            // Only one character exists in the roster, so it must be the guilty character.
            var response = await client.PostAsJsonAsync($"/api/gonf/{gonfName}/playstate/default/accuse", new { accusedCharacterId = 1 });
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
            var data = payload.GetProperty("data");

            Assert.True(data.GetProperty("correct").GetBoolean());
            Assert.False(string.IsNullOrWhiteSpace(data.GetProperty("motive").GetString()));
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
    public async Task Accuse_WithWrongCharacterId_ReturnsCorrectFalse()
    {
        var gonfName = $"AccuseIncorrect_{Guid.NewGuid():N}";
        var gonfDirectory = GonfDirectory(gonfName);

        try
        {
            await WriteAuthoredGonfAsync(gonfName);
            using var client = _factory.CreateClient();

            // Character id 999 does not exist in the roster, so it cannot be the guilty character.
            var response = await client.PostAsJsonAsync($"/api/gonf/{gonfName}/playstate/default/accuse", new { accusedCharacterId = 999 });
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
            var data = payload.GetProperty("data");

            Assert.False(data.GetProperty("correct").GetBoolean());
            Assert.True(data.GetProperty("motive").ValueKind == JsonValueKind.Null);
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
