using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Gonf.Api.Tests;

public class SaveGonfEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public SaveGonfEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task PostSaveWithRoomsItemsAndCharacters_WritesAllCollectionsToJsonFile()
    {
        using var client = _factory.CreateClient();
        var gonfName = $"Uat_{Guid.NewGuid():N}";
        var gonfDirectory = Path.Combine(@"C:\gonf\\", gonfName);
        var savePath = Path.Combine(gonfDirectory, $"{gonfName}.json");

        if (Directory.Exists(gonfDirectory))
        {
            Directory.Delete(gonfDirectory, recursive: true);
        }

        var request = new
        {
            gonfName,
            rooms = new[]
            {
                new
                {
                    roomId = 1,
                    roomName = "Room A",
                    roomDescription = "First room",
                    roomFloor = 1,
                    exits = new { north = (int?)null, east = (int?)null, south = (int?)null, west = (int?)null, up = (int?)null, down = (int?)null }
                }
            },
            items = new[]
            {
                new
                {
                    itemId = 1,
                    itemName = "Key",
                    itemWeight = 1.5m,
                    itemDescription = "Door key",
                    itemValue = 10m,
                    canHoldItems = false,
                    canBeCarried = true,
                    location = 1,
                    contents = Array.Empty<int>()
                }
            },
            characters = new[]
            {
                new
                {
                    characterId = 1,
                    characterName = "Ava",
                    description = "Hero",
                    location = 1,
                    wanderer = true,
                    contains = new[] { 1 }
                }
            }
        };

        try
        {
            var response = await client.PostAsJsonAsync("/api/gonf/save", request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True(File.Exists(savePath));

            using var document = JsonDocument.Parse(await File.ReadAllTextAsync(savePath));
            var root = document.RootElement;

            Assert.Equal("Gonf", root.GetProperty("format").GetString());
            Assert.Equal("1.0", root.GetProperty("schemaVersion").GetString());
            Assert.Equal(gonfName, root.GetProperty("gonfName").GetString());
            Assert.Single(root.GetProperty("rooms").EnumerateArray());
            Assert.Single(root.GetProperty("items").EnumerateArray());
            Assert.Single(root.GetProperty("characters").EnumerateArray());

            var savedItem = root.GetProperty("items").EnumerateArray().Single();
            var savedCharacter = root.GetProperty("characters").EnumerateArray().Single();

            Assert.Equal("Key", savedItem.GetProperty("itemName").GetString());
            Assert.Equal("Ava", savedCharacter.GetProperty("characterName").GetString());
            Assert.Equal(1, savedCharacter.GetProperty("contains").EnumerateArray().Single().GetInt32());
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
    public async Task PostSaveWithRoomImage_PersistsImageMetadataAndImageFile()
    {
        using var client = _factory.CreateClient();
        var gonfName = $"Img_{Guid.NewGuid():N}";
        var gonfDirectory = Path.Combine(@"C:\gonf\\", gonfName);
        var savePath = Path.Combine(gonfDirectory, $"{gonfName}.json");

        if (Directory.Exists(gonfDirectory))
        {
            Directory.Delete(gonfDirectory, recursive: true);
        }

        var request = new
        {
            gonfName,
            rooms = new[]
            {
                new
                {
                    roomId = 7,
                    roomName = "Kitchen",
                    roomDescription = "A warm kitchen.",
                    roomFloor = 1,
                    image = new
                    {
                        imageStatus = "candidate-ready",
                        attemptIndex = 2,
                        generationSeed = "seed-123",
                        generatedUtc = DateTimeOffset.UtcNow,
                        finalizedUtc = (DateTimeOffset?)null,
                        fileName = "",
                        relativePath = "",
                        previewDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfXcAAAAASUVORK5CYII=",
                    },
                    exits = new { north = (int?)null, east = (int?)null, south = (int?)null, west = (int?)null, up = (int?)null, down = (int?)null }
                }
            },
            items = Array.Empty<object>(),
            characters = Array.Empty<object>()
        };

        try
        {
            var response = await client.PostAsJsonAsync("/api/gonf/save", request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True(File.Exists(savePath));

            using var document = JsonDocument.Parse(await File.ReadAllTextAsync(savePath));
            var room = document.RootElement.GetProperty("rooms").EnumerateArray().Single();
            var image = room.GetProperty("image");

            Assert.Equal("finalized", image.GetProperty("imageStatus").GetString());
            Assert.Equal(2, image.GetProperty("attemptIndex").GetInt32());
            Assert.Equal("seed-123", image.GetProperty("generationSeed").GetString());
            Assert.Equal(string.Empty, image.GetProperty("previewDataUrl").GetString());

            var fileName = image.GetProperty("fileName").GetString();
            Assert.False(string.IsNullOrWhiteSpace(fileName));

            var imagePath = Path.Combine(gonfDirectory, "img", fileName!);
            Assert.True(File.Exists(imagePath));
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
    public async Task PostSaveWithCharacterImage_PersistsImageMetadataAndImageFile()
    {
        using var client = _factory.CreateClient();
        var gonfName = $"CharImg_{Guid.NewGuid():N}";
        var gonfDirectory = Path.Combine(@"C:\gonf\\", gonfName);
        var savePath = Path.Combine(gonfDirectory, $"{gonfName}.json");

        if (Directory.Exists(gonfDirectory))
        {
            Directory.Delete(gonfDirectory, recursive: true);
        }

        var request = new
        {
            gonfName,
            rooms = new[]
            {
                new
                {
                    roomId = 1,
                    roomName = "Room A",
                    roomDescription = "First room",
                    roomFloor = 1,
                    exits = new { north = (int?)null, east = (int?)null, south = (int?)null, west = (int?)null, up = (int?)null, down = (int?)null }
                }
            },
            items = Array.Empty<object>(),
            characters = new[]
            {
                new
                {
                    characterId = 12,
                    characterName = "Reggie Winthrope III",
                    description = "A tall, lanky man.",
                    location = 1,
                    wanderer = false,
                    contains = Array.Empty<int>(),
                    image = new
                    {
                        imageStatus = "candidate-ready",
                        attemptIndex = 3,
                        generationSeed = "char-seed-abc",
                        generatedUtc = DateTimeOffset.UtcNow,
                        finalizedUtc = (DateTimeOffset?)null,
                        fileName = "",
                        relativePath = "",
                        previewDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfXcAAAAASUVORK5CYII=",
                    }
                }
            }
        };

        try
        {
            var response = await client.PostAsJsonAsync("/api/gonf/save", request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True(File.Exists(savePath));

            using var document = JsonDocument.Parse(await File.ReadAllTextAsync(savePath));
            var savedCharacter = document.RootElement.GetProperty("characters").EnumerateArray().Single();
            var image = savedCharacter.GetProperty("image");

            Assert.Equal("finalized", image.GetProperty("imageStatus").GetString());
            Assert.Equal(3, image.GetProperty("attemptIndex").GetInt32());
            Assert.Equal("char-seed-abc", image.GetProperty("generationSeed").GetString());
            Assert.Equal(string.Empty, image.GetProperty("previewDataUrl").GetString());

            var fileName = image.GetProperty("fileName").GetString();
            Assert.False(string.IsNullOrWhiteSpace(fileName));

            var imagePath = Path.Combine(gonfDirectory, "img", fileName!);
            Assert.True(File.Exists(imagePath));
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
        public async Task PostSaveWithOutOfRangeItemValue_ReturnsBadRequestWithValidationMessage()
        {
                using var client = _factory.CreateClient();

                var requestJson = """
                {
                    "gonfName": "OutOfRangeSave",
                    "rooms": [
                        {
                            "roomId": 1,
                            "roomName": "Room A",
                            "roomDescription": "First room",
                            "roomFloor": 1,
                            "exits": {
                                "north": null,
                                "east": null,
                                "south": null,
                                "west": null,
                                "up": null,
                                "down": null
                            }
                        }
                    ],
                    "items": [
                        {
                            "itemId": 1,
                            "itemName": "Key",
                            "itemWeight": 1.5,
                            "itemDescription": "Door key",
                            "itemValue": 1e100,
                            "canHoldItems": false,
                            "canBeCarried": true,
                            "location": 1,
                            "contents": []
                        }
                    ],
                    "characters": []
                }
                """;

                using var content = new StringContent(requestJson, Encoding.UTF8, "application/json");
                var response = await client.PostAsync("/api/gonf/save", content);

                Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

                using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
                var root = document.RootElement;

                Assert.False(root.GetProperty("success").GetBoolean());
                Assert.Equal(400, root.GetProperty("code").GetInt32());
                Assert.Equal("INVALID_REQUEST_BODY", root.GetProperty("errors")[0].GetProperty("code").GetString());
        }
}
