using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace Gonf.Api.Tests;

public class RoomImageEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public RoomImageEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GenerateWithoutProviderConfiguration_ReturnsServiceUnavailable()
    {
        using var client = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, config) =>
            {
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ImageProvider:Imps:BaseUrl"] = null,
                });
            });
        }).CreateClient();

        var request = new
        {
            gonfName = "TestGonf",
            roomId = 1,
            roomName = "Kitchen",
            roomDescription = "A large kitchen with stove and counters.",
            attemptIndex = 0,
            generationSeed = "seed-test"
        };

        var response = await client.PostAsJsonAsync("/api/room-image/generate", request);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    [Fact]
    public async Task QueueGenerationJob_ReturnsAcceptedWithJobId()
    {
        using var client = _factory.CreateClient();

        var request = new
        {
            gonfName = "TestGonf",
            roomId = 1,
            roomName = "Kitchen",
            roomDescription = "A large kitchen with stove and counters.",
            attemptIndex = 0,
            generationSeed = "seed-test"
        };

        var response = await client.PostAsJsonAsync("/api/room-image/generate-jobs", request);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(payload.GetProperty("success").GetBoolean());
        Assert.False(string.IsNullOrWhiteSpace(payload.GetProperty("data").GetProperty("jobId").GetString()));
    }

    [Fact]
    public async Task QueueCharacterGenerationJob_ReturnsAcceptedWithJobId()
    {
        using var client = _factory.CreateClient();

        var request = new
        {
            gonfName = "TestGonf",
            characterId = 1,
            characterName = "Ava",
            characterDescription = "A careful adventurer in travel clothes.",
            attemptIndex = 0,
            generationSeed = "seed-character-test"
        };

        var response = await client.PostAsJsonAsync("/api/character-image/generate-jobs", request);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(payload.GetProperty("success").GetBoolean());
        Assert.False(string.IsNullOrWhiteSpace(payload.GetProperty("data").GetProperty("jobId").GetString()));
    }

    [Fact]
    public async Task UploadCharacterImage_WithJpegFile_ReturnsBadRequest()
    {
        using var client = _factory.CreateClient();

        using var content = new MultipartFormDataContent();
        var fileBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 };
        var fileContent = new ByteArrayContent(fileBytes);
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");
        content.Add(fileContent, "file", "character.jpeg");
        content.Add(new StringContent("0"), "attemptIndex");
        content.Add(new StringContent("seed-character-upload"), "generationSeed");

        var response = await client.PostAsync("/api/character-image/upload", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(payload.GetProperty("success").GetBoolean());
        Assert.Equal("INVALID_FILE_TYPE", payload.GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task UploadCharacterImage_WithPngFile_ReturnsSuccess()
    {
        using var client = _factory.CreateClient();

        using var content = new MultipartFormDataContent();
        var fileBytes = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
        var fileContent = new ByteArrayContent(fileBytes);
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/png");
        content.Add(fileContent, "file", "character.png");
        content.Add(new StringContent("0"), "attemptIndex");
        content.Add(new StringContent("seed-character-upload"), "generationSeed");

        var response = await client.PostAsync("/api/character-image/upload", content);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(payload.GetProperty("success").GetBoolean());
        Assert.Equal("uploaded", payload.GetProperty("data").GetProperty("source").GetString());
    }

    [Fact]
    public async Task UploadRoomImage_WithJpegFile_ReturnsSuccess()
    {
        using var client = _factory.CreateClient();

        using var content = new MultipartFormDataContent();
        var fileBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 };
        var fileContent = new ByteArrayContent(fileBytes);
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");
        content.Add(fileContent, "file", "room.jpeg");
        content.Add(new StringContent("0"), "attemptIndex");
        content.Add(new StringContent("seed-room-upload"), "generationSeed");

        var response = await client.PostAsync("/api/room-image/upload", content);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(payload.GetProperty("success").GetBoolean());
    }
}
