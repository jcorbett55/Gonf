using System.Text.Json;
using Gonf.Api.Models;
using static Gonf.Api.Infrastructure.ApiErrorHelpers;
using static Gonf.Api.Infrastructure.ImageDataUrlHelpers;
using static Gonf.Api.Infrastructure.ImageFileNaming;

namespace Gonf.Api.Services;

public static class GonfSaveService
{
    private const string SaveRootDirectory = @"C:\gonf\\";

    public static async Task<IResult> HandleSaveGonfRequestAsync(SaveGonfRequest request, ILogger logger)
    {
        if (string.IsNullOrWhiteSpace(request.GonfName))
        {
            return CreateErrorResult(StatusCodes.Status400BadRequest, "GONF_NAME_REQUIRED", "Please provide a Gonf Name before saving.");
        }

        if (request.Rooms is null)
        {
            return CreateErrorResult(StatusCodes.Status400BadRequest, "ROOMS_REQUIRED", "Could not save Gonf because room data is missing.");
        }

        if (request.GonfName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
        {
            return CreateErrorResult(StatusCodes.Status400BadRequest, "INVALID_GONF_NAME", "Gonf Name contains invalid file name characters.");
        }

        var gonfDirectory = Path.Combine(SaveRootDirectory, request.GonfName);
        var imageDirectory = Path.Combine(gonfDirectory, "img");
        var savePath = Path.Combine(gonfDirectory, $"{request.GonfName}.json");

        var savedRooms = new List<object>(request.Rooms.Count);

        try
        {
            Directory.CreateDirectory(gonfDirectory);
            Directory.CreateDirectory(imageDirectory);

            foreach (var room in request.Rooms)
            {
                var persistedImage = await PersistRoomImageAsync(room, imageDirectory);

                savedRooms.Add(new
                {
                    roomId = room.RoomId,
                    roomName = room.RoomName,
                    roomDescription = room.RoomDescription,
                    roomFloor = room.RoomFloor,
                    image = persistedImage,
                    isStartingRoom = room.IsStartingRoom,
                    exits = new
                    {
                        north = room.Exits.North,
                        east = room.Exits.East,
                        south = room.Exits.South,
                        west = room.Exits.West,
                        up = room.Exits.Up,
                        down = room.Exits.Down,
                    },
                });
            }

            var savedCharacters = new List<object>();
            foreach (var character in request.Characters ?? Array.Empty<SaveGonfCharacterRequest>())
            {
                var persistedCharacterImage = await PersistCharacterImageAsync(character, imageDirectory);
                savedCharacters.Add(new
                {
                    characterId = character.CharacterId,
                    characterName = character.CharacterName,
                    description = character.Description,
                    location = character.Location,
                    wanderer = character.Wanderer,
                    contains = character.Contains,
                    image = persistedCharacterImage,
                });
            }

            var savedItems = new List<object>();
            foreach (var item in request.Items ?? Array.Empty<SaveGonfItemRequest>())
            {
                var persistedItemImage = await PersistItemImageAsync(item, imageDirectory);
                savedItems.Add(new
                {
                    itemId = item.ItemId,
                    itemName = item.ItemName,
                    itemWeight = item.ItemWeight,
                    itemDescription = item.ItemDescription,
                    itemValue = item.ItemValue,
                    canHoldItems = item.CanHoldItems,
                    canBeCarried = item.CanBeCarried,
                    location = item.Location,
                    contents = item.Contents,
                    image = persistedItemImage,
                });
            }

            var savePayload = new
            {
                format = "Gonf",
                schemaVersion = "1.0",
                gonfName = request.GonfName,
                rooms = savedRooms,
                items = savedItems,
                characters = savedCharacters,
            };

            var json = JsonSerializer.Serialize(savePayload, new JsonSerializerOptions
            {
                WriteIndented = true,
            });

            await File.WriteAllTextAsync(savePath, json);

            return Results.Json(new
            {
                code = StatusCodes.Status200OK,
                success = true,
                errors = Array.Empty<object>(),
                data = new
                {
                    path = savePath,
                    message = $"Saved Gonf to {savePath}.",
                },
            }, statusCode: StatusCodes.Status200OK);
        }
        catch (FormatException ex)
        {
            logger.LogWarning(ex, "Unable to decode a room image payload while saving Gonf. Path: {SavePath}", savePath);
            return CreateErrorResult(StatusCodes.Status400BadRequest, "IMAGE_GENERATION_FAILED", "Couldn't save room image because the generated image payload is invalid.");
        }
        catch (UnauthorizedAccessException ex)
        {
            logger.LogWarning(ex, "Unable to save Gonf due to access permissions. Path: {SavePath}", savePath);
            return CreateErrorResult(StatusCodes.Status403Forbidden, "SAVE_ACCESS_DENIED", "Couldn't save Gonf because access to C:\\gonf\\ is denied.");
        }
        catch (IOException ex) when (IsDiskFull(ex))
        {
            logger.LogWarning(ex, "Unable to save Gonf due to low disk space. Path: {SavePath}", savePath);
            return CreateErrorResult(StatusCodes.Status507InsufficientStorage, "INSUFFICIENT_STORAGE", "Couldn't save Gonf because the drive is out of space.");
        }
        catch (IOException ex)
        {
            logger.LogWarning(ex, "Unable to save Gonf due to file system error. Path: {SavePath}", savePath);
            return CreateErrorResult(StatusCodes.Status500InternalServerError, "SAVE_FAILED", "Couldn't save Gonf due to a file system error. Please try again.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error while saving Gonf. Path: {SavePath}", savePath);
            return CreateErrorResult(StatusCodes.Status500InternalServerError, "SAVE_FAILED", "Couldn't save Gonf due to an unexpected error. Please try again.");
        }
    }

    private static async Task<object?> PersistRoomImageAsync(SaveGonfRoomRequest room, string imageDirectory)
    {
        if (room.Image is null)
        {
            return null;
        }

        var sourceImage = room.Image;
        var hasPreview = IsEmbeddedImageDataUrl(sourceImage.PreviewDataUrl);
        var attemptIndex = Math.Max(0, sourceImage.AttemptIndex ?? 0);
        var generatedUtc = sourceImage.GeneratedUtc ?? DateTimeOffset.UtcNow;
        var imageSource = string.IsNullOrWhiteSpace(sourceImage.Source) ? "generated" : sourceImage.Source;

        if (!hasPreview && string.IsNullOrWhiteSpace(sourceImage.RelativePath))
        {
            return new
            {
                imageStatus = sourceImage.ImageStatus ?? "none",
                attemptIndex,
                generationSeed = sourceImage.GenerationSeed ?? string.Empty,
                generatedUtc,
                finalizedUtc = sourceImage.FinalizedUtc,
                fileName = sourceImage.FileName ?? string.Empty,
                relativePath = sourceImage.RelativePath ?? string.Empty,
                previewDataUrl = string.Empty,
                source = imageSource,
            };
        }

        var fileName = !string.IsNullOrWhiteSpace(sourceImage.FileName)
            ? sourceImage.FileName!
            : BuildRoomImageFileName(room.RoomId, room.RoomName, attemptIndex, Infrastructure.ImageUploadValidation.GetExtensionFromDataUrl(sourceImage.PreviewDataUrl));

        var filePath = Path.Combine(imageDirectory, fileName);
        var relativePath = $"img/{fileName}";
        var previewDataUrl = sourceImage.PreviewDataUrl ?? string.Empty;

        if (hasPreview)
        {
            var bytes = DecodeDataUrl(previewDataUrl);
            await File.WriteAllBytesAsync(filePath, bytes);
        }

        return new
        {
            imageStatus = "finalized",
            attemptIndex,
            generationSeed = sourceImage.GenerationSeed ?? string.Empty,
            generatedUtc,
            finalizedUtc = DateTimeOffset.UtcNow,
            fileName,
            relativePath,
            previewDataUrl = string.Empty,
            source = imageSource,
        };
    }

    private static async Task<object?> PersistCharacterImageAsync(SaveGonfCharacterRequest character, string imageDirectory)
    {
        if (character.Image is null)
        {
            return null;
        }

        var sourceImage = character.Image;
        var hasPreview = IsEmbeddedImageDataUrl(sourceImage.PreviewDataUrl);
        var attemptIndex = Math.Max(0, sourceImage.AttemptIndex ?? 0);
        var generatedUtc = sourceImage.GeneratedUtc ?? DateTimeOffset.UtcNow;
        var imageSource = string.IsNullOrWhiteSpace(sourceImage.Source) ? "generated" : sourceImage.Source;

        if (!hasPreview && string.IsNullOrWhiteSpace(sourceImage.RelativePath))
        {
            return new
            {
                imageStatus = sourceImage.ImageStatus ?? "none",
                attemptIndex,
                generationSeed = sourceImage.GenerationSeed ?? string.Empty,
                generatedUtc,
                finalizedUtc = sourceImage.FinalizedUtc,
                fileName = sourceImage.FileName ?? string.Empty,
                relativePath = sourceImage.RelativePath ?? string.Empty,
                previewDataUrl = string.Empty,
                source = imageSource,
            };
        }

        var fileName = !string.IsNullOrWhiteSpace(sourceImage.FileName)
            ? sourceImage.FileName!
            : BuildCharacterImageFileName(character.CharacterId, character.CharacterName, attemptIndex, Infrastructure.ImageUploadValidation.GetExtensionFromDataUrl(sourceImage.PreviewDataUrl));

        var filePath = Path.Combine(imageDirectory, fileName);
        var relativePath = $"img/{fileName}";
        var previewDataUrl = sourceImage.PreviewDataUrl ?? string.Empty;

        if (hasPreview)
        {
            var bytes = DecodeDataUrl(previewDataUrl);
            await File.WriteAllBytesAsync(filePath, bytes);
        }

        return new
        {
            imageStatus = "finalized",
            attemptIndex,
            generationSeed = sourceImage.GenerationSeed ?? string.Empty,
            generatedUtc,
            finalizedUtc = DateTimeOffset.UtcNow,
            fileName,
            relativePath,
            previewDataUrl = string.Empty,
            source = imageSource,
        };
    }

    private static async Task<object?> PersistItemImageAsync(SaveGonfItemRequest item, string imageDirectory)
    {
        if (item.Image is null)
        {
            return null;
        }

        var sourceImage = item.Image;
        var hasPreview = IsEmbeddedImageDataUrl(sourceImage.PreviewDataUrl);
        var attemptIndex = Math.Max(0, sourceImage.AttemptIndex ?? 0);
        var generatedUtc = sourceImage.GeneratedUtc ?? DateTimeOffset.UtcNow;
        var imageSource = string.IsNullOrWhiteSpace(sourceImage.Source) ? "generated" : sourceImage.Source;

        if (!hasPreview && string.IsNullOrWhiteSpace(sourceImage.RelativePath))
        {
            return new
            {
                imageStatus = sourceImage.ImageStatus ?? "none",
                attemptIndex,
                generationSeed = sourceImage.GenerationSeed ?? string.Empty,
                generatedUtc,
                finalizedUtc = sourceImage.FinalizedUtc,
                fileName = sourceImage.FileName ?? string.Empty,
                relativePath = sourceImage.RelativePath ?? string.Empty,
                previewDataUrl = string.Empty,
                source = imageSource,
            };
        }

        var fileName = !string.IsNullOrWhiteSpace(sourceImage.FileName)
            ? sourceImage.FileName!
            : BuildItemImageFileName(item.ItemId, item.ItemName, attemptIndex, Infrastructure.ImageUploadValidation.GetExtensionFromDataUrl(sourceImage.PreviewDataUrl));

        var filePath = Path.Combine(imageDirectory, fileName);
        var relativePath = $"img/{fileName}";
        var previewDataUrl = sourceImage.PreviewDataUrl ?? string.Empty;

        if (hasPreview)
        {
            var bytes = DecodeDataUrl(previewDataUrl);
            await File.WriteAllBytesAsync(filePath, bytes);
        }

        return new
        {
            imageStatus = "finalized",
            attemptIndex,
            generationSeed = sourceImage.GenerationSeed ?? string.Empty,
            generatedUtc,
            finalizedUtc = DateTimeOffset.UtcNow,
            fileName,
            relativePath,
            previewDataUrl = string.Empty,
            source = imageSource,
        };
    }
}
