using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Gonf.Api.Tests;

public class PlayerSaveStateEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public PlayerSaveStateEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private static string GonfDirectory(string gonfName) => Path.Combine(@"C:\gonf\\", gonfName);

    [Fact]
    public async Task GetSaveState_WhenNoSaveExists_ReturnsNotFound()
    {
        using var client = _factory.CreateClient();
        var gonfName = $"NoSave_{Guid.NewGuid():N}";

        var response = await client.GetAsync($"/api/gonf/{gonfName}/playstate/default");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PutThenGetSaveState_RoundTripsRoomAndCharacterState()
    {
        using var client = _factory.CreateClient();
        var gonfName = $"SaveRoundTrip_{Guid.NewGuid():N}";
        var gonfDirectory = GonfDirectory(gonfName);

        try
        {
            var request = new
            {
                currentRoomId = 3,
                characters = new[]
                {
                    new { characterId = 1, location = "3" },
                    new { characterId = 2, location = "4" },
                },
                flags = new Dictionary<string, object?> { ["safe_opened"] = true },
                conversationHistory = new[]
                {
                    new { characterId = 1, speaker = "Bob", text = "Hello there!", timestampUtc = DateTimeOffset.UtcNow }
                }
            };

            var putResponse = await client.PutAsJsonAsync($"/api/gonf/{gonfName}/playstate/default", request);
            Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

            var savePath = Path.Combine(gonfDirectory, "saves", "default.json");
            Assert.True(File.Exists(savePath));

            var getResponse = await client.GetAsync($"/api/gonf/{gonfName}/playstate/default");
            Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

            var payload = await getResponse.Content.ReadFromJsonAsync<JsonElement>();
            var data = payload.GetProperty("data");

            Assert.Equal(3, data.GetProperty("currentRoomId").GetInt32());
            Assert.True(data.GetProperty("flags").GetProperty("safe_opened").GetBoolean());
            Assert.Equal(2, data.GetProperty("characters").GetArrayLength());
            Assert.Equal(1, data.GetProperty("conversationHistory").GetArrayLength());
        }
        finally
        {
            if (Directory.Exists(gonfDirectory))
            {
                Directory.Delete(gonfDirectory, recursive: true);
            }
        }
    }

    [Theory]
    [InlineData("bad|name", "default")]
    [InlineData("ValidName", "bad?save")]
    public async Task GetSaveState_WithInvalidIdentifiers_ReturnsBadRequest(string gonfName, string saveId)
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync($"/api/gonf/{gonfName}/playstate/{saveId}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetSaveState_ForLegacySaveFileWithNoCharacterMemoryField_LoadsWithEmptyMemory()
    {
        using var client = _factory.CreateClient();
        var gonfName = $"LegacySave_{Guid.NewGuid():N}";
        var gonfDirectory = GonfDirectory(gonfName);
        var savesDirectory = Path.Combine(gonfDirectory, "saves");

        try
        {
            Directory.CreateDirectory(savesDirectory);

            // Deliberately matches the pre-memory save shape: no "CharacterMemory" property at all.
            // PlayerSaveStateService persists using default (PascalCase, case-sensitive) JSON
            // options, so on-disk files use the record's PascalCase property names.
            var legacyJson = """
                {
                  "GonfName": "%GONFNAME%",
                  "SaveId": "default",
                  "CurrentRoomId": 2,
                  "Characters": [
                    { "CharacterId": 1, "Location": "2" }
                  ],
                  "Flags": {},
                  "ConversationHistory": [],
                  "UpdatedUtc": "2024-01-01T00:00:00Z"
                }
                """.Replace("%GONFNAME%", gonfName);

            var savePath = Path.Combine(savesDirectory, "default.json");
            await File.WriteAllTextAsync(savePath, legacyJson);

            var response = await client.GetAsync($"/api/gonf/{gonfName}/playstate/default");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
            var data = payload.GetProperty("data");

            Assert.Equal(2, data.GetProperty("currentRoomId").GetInt32());
            Assert.True(data.TryGetProperty("characterMemory", out var characterMemory));
            Assert.Equal(JsonValueKind.Array, characterMemory.ValueKind);
            Assert.Equal(0, characterMemory.GetArrayLength());
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
