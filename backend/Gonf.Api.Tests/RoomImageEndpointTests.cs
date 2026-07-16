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
}
