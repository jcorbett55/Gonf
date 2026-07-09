using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Gonf.Api.Tests;

public class SchemaPreviewEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public SchemaPreviewEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task PostWithoutMultipartForm_ReturnsFileRequired400()
    {
        using var client = _factory.CreateClient();
        using var content = new StringContent("", Encoding.UTF8, "application/json");

        var response = await client.PostAsync("/api/schema/preview", content);
        var payload = await ParseJsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(400, payload.GetProperty("code").GetInt32());
        Assert.False(payload.GetProperty("success").GetBoolean());
        Assert.Equal("FILE_REQUIRED", payload.GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task MultipartWithoutFilePart_ReturnsFileRequired400()
    {
        using var client = _factory.CreateClient();
        using var content = new MultipartFormDataContent();
        using var otherField = new StringContent("noop");
        content.Add(otherField, "otherField");

        var response = await client.PostAsync("/api/schema/preview", content);
        var payload = await ParseJsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(400, payload.GetProperty("code").GetInt32());
        Assert.False(payload.GetProperty("success").GetBoolean());
        Assert.Equal("FILE_REQUIRED", payload.GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task OversizedPayload_Returns413()
    {
        using var client = _factory.CreateClient();
        using var content = new MultipartFormDataContent();
        var largeJson = "{\"data\":\"" + new string('a', 1_100_000) + "\"}";
        using var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes(largeJson));
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        content.Add(fileContent, "file", "large.json");

        var response = await client.PostAsync("/api/schema/preview", content);
        var payload = await ParseJsonAsync(response);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        Assert.Equal(413, payload.GetProperty("code").GetInt32());
        Assert.Equal("PAYLOAD_TOO_LARGE", payload.GetProperty("errors")[0].GetProperty("code").GetString());
    }

    private static async Task<JsonElement> ParseJsonAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.Clone();
    }
}
