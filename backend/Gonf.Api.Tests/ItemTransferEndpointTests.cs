using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Gonf.Api.Tests;

public class ItemTransferEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ItemTransferEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task PostItemTransfer_PlayerToCharacter_MovesItemAndReturnsUpdatedState()
    {
        using var client = _factory.CreateClient();

        var request = new
        {
            itemId = 7,
            characterId = 1,
            toCharacter = true,
            action = "give",
            playerItemIds = new[] { 7, 8 },
            characters = new[]
            {
                new { characterId = 1, location = "2", contains = Array.Empty<int>() },
            },
            roomItemLocations = Array.Empty<object>(),
        };

        var response = await client.PostAsJsonAsync("/api/item-transfer", request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        var data = payload.GetProperty("data");

        Assert.True(data.GetProperty("allowed").GetBoolean());

        var playerItemIds = data.GetProperty("playerItemIds").EnumerateArray().Select(e => e.GetInt32()).ToArray();
        Assert.DoesNotContain(7, playerItemIds);
        Assert.Contains(8, playerItemIds);

        var character = data.GetProperty("characters").EnumerateArray().Single();
        var characterContains = character.GetProperty("contains").EnumerateArray().Select(e => e.GetInt32()).ToArray();
        Assert.Contains(7, characterContains);

        Assert.True(data.TryGetProperty("memoryFact", out var memoryFact));
        Assert.Equal(JsonValueKind.Object, memoryFact.ValueKind);
    }

    [Fact]
    public async Task PostItemTransfer_CharacterToPlayer_RemovesFromCharacterAndAddsToPlayer()
    {
        using var client = _factory.CreateClient();

        var request = new
        {
            itemId = 7,
            characterId = 1,
            toCharacter = false,
            action = "take",
            playerItemIds = Array.Empty<int>(),
            characters = new[]
            {
                new { characterId = 1, location = "2", contains = new[] { 7 } },
            },
            roomItemLocations = Array.Empty<object>(),
        };

        var response = await client.PostAsJsonAsync("/api/item-transfer", request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        var data = payload.GetProperty("data");

        Assert.True(data.GetProperty("allowed").GetBoolean());

        var playerItemIds = data.GetProperty("playerItemIds").EnumerateArray().Select(e => e.GetInt32()).ToArray();
        Assert.Contains(7, playerItemIds);

        var character = data.GetProperty("characters").EnumerateArray().Single();
        var characterContains = character.GetProperty("contains").EnumerateArray().Select(e => e.GetInt32()).ToArray();
        Assert.DoesNotContain(7, characterContains);
    }

    [Fact]
    public async Task PostItemTransfer_MissingCharacterId_ReturnsBadRequest()
    {
        using var client = _factory.CreateClient();

        var request = new
        {
            itemId = 7,
            characterId = 0,
            toCharacter = true,
            action = "give",
        };

        var response = await client.PostAsJsonAsync("/api/item-transfer", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
