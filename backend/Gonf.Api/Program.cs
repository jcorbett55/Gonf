using Gonf.Api.Models;
using Gonf.Api.Services;
using System.Net;
using System.Text.Json;

const long MaxUploadBytes = 1 * 1024 * 1024;
const long MaxImageUploadBytes = 2 * 1024 * 1024;

var builder = WebApplication.CreateBuilder(args);
var configuredCorsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
var configuredCorsOriginSet = new HashSet<string>(configuredCorsOrigins, StringComparer.OrdinalIgnoreCase);

builder.Services.AddOpenApi();
builder.Services.AddHttpClient<IImageGenerationProvider, OpenAiImageProvider>((services, client) =>
{
    var configuration = services.GetRequiredService<IConfiguration>();
    var timeoutSeconds = int.TryParse(configuration["ImageProvider:Imps:TimeoutSeconds"], out var parsedTimeoutSeconds)
        ? parsedTimeoutSeconds
        : 600;

    client.Timeout = TimeSpan.FromSeconds(Math.Max(30, timeoutSeconds));
});
builder.Services.AddSingleton<RoomImageGenerationJobService>();
builder.Services.AddSingleton<IRoomImageGenerationJobService>(static services => services.GetRequiredService<RoomImageGenerationJobService>());
builder.Services.AddHostedService(static services => services.GetRequiredService<RoomImageGenerationJobService>());
builder.Services.AddSingleton<CharacterImageGenerationJobService>();
builder.Services.AddSingleton<ICharacterImageGenerationJobService>(static services => services.GetRequiredService<CharacterImageGenerationJobService>());
builder.Services.AddHostedService(static services => services.GetRequiredService<CharacterImageGenerationJobService>());
builder.Services.AddSingleton<ItemImageGenerationJobService>();
builder.Services.AddSingleton<IItemImageGenerationJobService>(static services => services.GetRequiredService<ItemImageGenerationJobService>());
builder.Services.AddHostedService(static services => services.GetRequiredService<ItemImageGenerationJobService>());
builder.Services.AddCors(options =>
{
    options.AddPolicy("gonf-frontend", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            policy.SetIsOriginAllowed(origin => IsLoopbackOrigin(origin) || configuredCorsOriginSet.Contains(origin))
                  .AllowAnyHeader()
                  .AllowAnyMethod();
            return;
        }

        if (configuredCorsOrigins.Length > 0)
        {
            policy.WithOrigins(configuredCorsOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod();
            return;
        }

        policy.SetIsOriginAllowed(_ => false);
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var logger = context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("GlobalException");
        var exception = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;

        if (exception is BadHttpRequestException badRequestException)
        {
            logger.LogWarning(badRequestException, "Invalid request payload.");

            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            context.Response.ContentType = "application/json";

            var badRequestResponse = ApiResponse.CreateError(
                StatusCodes.Status400BadRequest,
                "INVALID_REQUEST_BODY",
                "The request body contains invalid or out-of-range values. Please review item and character fields and try again."
            );

            await context.Response.WriteAsJsonAsync(badRequestResponse);
            return;
        }

        if (exception is not null)
        {
            logger.LogError(exception, "Unhandled exception while processing request.");
        }

        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";

        var response = ApiResponse.CreateError(
            StatusCodes.Status500InternalServerError,
            "SERVER_ERROR",
            "We hit an unexpected problem while processing your request. Please try again."
        );

        await context.Response.WriteAsJsonAsync(response);
    });
});

app.UseStatusCodePages(async statusCodeContext =>
{
    var context = statusCodeContext.HttpContext;
    var status = context.Response.StatusCode;

    if (status is not (StatusCodes.Status404NotFound or StatusCodes.Status502BadGateway))
    {
        return;
    }

    if (!string.IsNullOrWhiteSpace(context.Response.ContentType))
    {
        return;
    }

    var error = status switch
    {
        StatusCodes.Status404NotFound => ApiResponse.CreateError(status, "NOT_FOUND", "The requested resource was not found."),
        StatusCodes.Status502BadGateway => ApiResponse.CreateError(status, "UPSTREAM_UNAVAILABLE", "A dependent service is unavailable. Please try again."),
        _ => ApiResponse.CreateError(status, "REQUEST_FAILED", "The request could not be completed.")
    };

    context.Response.ContentType = "application/json";
    await context.Response.WriteAsJsonAsync(error);
});

app.UseCors("gonf-frontend");

app.MapPost("/api/schema/preview", async (HttpRequest request, ILogger<Program> logger) =>
{
    return await HandleSchemaPreviewRequestAsync(request, logger);
})
.WithName("GenerateSchemaPreview");

app.MapPost("/api/gonf/save", async (SaveGonfRequest request, ILogger<Program> logger) =>
{
    return await HandleSaveGonfRequestAsync(request, logger);
})
.WithName("SaveGonf");

app.MapGet("/api/gonf/image/{gonfName}/{fileName}", (string gonfName, string fileName) =>
{
    if (string.IsNullOrWhiteSpace(gonfName) || string.IsNullOrWhiteSpace(fileName))
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "IMAGE_REFERENCE_INVALID", "Image reference is invalid.");
    }

    if (gonfName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || fileName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "IMAGE_REFERENCE_INVALID", "Image reference contains invalid characters.");
    }

    var imageExtension = Path.GetExtension(fileName);
    if (string.IsNullOrEmpty(imageExtension) || !ImageUploadValidation.AllowedContentTypesByExtension.TryGetValue(imageExtension, out var imageContentType))
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "IMAGE_REFERENCE_INVALID", "Only .png, .jpg, .jpeg, and .gif images are supported.");
    }

    var imagePath = Path.Combine(@"C:\gonf\\", gonfName, "img", fileName);
    if (!File.Exists(imagePath))
    {
        return CreateErrorResult(StatusCodes.Status404NotFound, "IMAGE_NOT_FOUND", "Referenced room image was not found.");
    }

    return Results.File(imagePath, contentType: imageContentType);
})
.WithName("GetGonfImage");

app.MapPost("/api/room-image/generate", async (
    GenerateRoomImageRequest request,
    IImageGenerationProvider imageProvider,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.RoomName))
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "ROOM_NAME_REQUIRED", "Room Name is required for image generation.");
    }

    if (string.IsNullOrWhiteSpace(request.RoomDescription))
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "ROOM_DESCRIPTION_REQUIRED", "Room Description is required for image generation.");
    }

    var prompt = BuildRoomImagePrompt(request.RoomName, request.RoomDescription);
    var result = await imageProvider.GenerateAsync(new GenerateImageRequest(prompt), cancellationToken);
    if (!result.Success)
    {
        logger.LogWarning("Room image generation failed with code {Code} for room {RoomName}.", result.ErrorCode, request.RoomName);
        var statusCode = result.ErrorCode == "IMAGE_PROVIDER_NOT_CONFIGURED"
            ? StatusCodes.Status503ServiceUnavailable
            : StatusCodes.Status502BadGateway;

        return CreateErrorResult(statusCode, result.ErrorCode ?? "IMAGE_GENERATION_FAILED", result.ErrorMessage ?? "Image generation failed.");
    }

    return Results.Json(new
    {
        code = StatusCodes.Status200OK,
        success = true,
        errors = Array.Empty<object>(),
        data = new
        {
            previewDataUrl = result.PreviewDataUrl,
            model = result.Model ?? "gpt-image-1",
            generationSeed = request.GenerationSeed ?? string.Empty,
            attemptIndex = request.AttemptIndex,
        }
    }, statusCode: StatusCodes.Status200OK);
})
.WithName("GenerateRoomImage");

app.MapPost("/api/room-image/upload", async (HttpRequest request, ILogger<Program> logger) =>
{
    return await HandleImageUploadRequestAsync(request, logger, "room");
})
.WithName("UploadRoomImage");

app.MapPost("/api/room-image/generate-jobs", async (
    GenerateRoomImageRequest request,
    IRoomImageGenerationJobService jobService,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.RoomName))
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "ROOM_NAME_REQUIRED", "Room Name is required for image generation.");
    }

    if (string.IsNullOrWhiteSpace(request.RoomDescription))
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "ROOM_DESCRIPTION_REQUIRED", "Room Description is required for image generation.");
    }

    var prompt = BuildRoomImagePrompt(request.RoomName, request.RoomDescription);
    var snapshot = await jobService.QueueAsync(request, prompt, cancellationToken);

    return Results.Json(new
    {
        code = StatusCodes.Status202Accepted,
        success = true,
        errors = Array.Empty<object>(),
        data = BuildRoomImageJobData(snapshot),
    }, statusCode: StatusCodes.Status202Accepted);
})
.WithName("QueueRoomImageGeneration");

app.MapPost("/api/character-image/generate", async (
    GenerateCharacterImageRequest request,
    IImageGenerationProvider imageProvider,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.CharacterName))
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "CHARACTER_NAME_REQUIRED", "Character Name is required for image generation.");
    }

    if (string.IsNullOrWhiteSpace(request.CharacterDescription))
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "CHARACTER_DESCRIPTION_REQUIRED", "Character Description is required for image generation.");
    }

    var prompt = BuildCharacterImagePrompt(request.CharacterName, request.CharacterDescription);
    var result = await imageProvider.GenerateAsync(new GenerateImageRequest(prompt), cancellationToken);
    if (!result.Success)
    {
        logger.LogWarning("Character image generation failed with code {Code} for character {CharacterName}.", result.ErrorCode, request.CharacterName);
        var statusCode = result.ErrorCode == "IMAGE_PROVIDER_NOT_CONFIGURED"
            ? StatusCodes.Status503ServiceUnavailable
            : StatusCodes.Status502BadGateway;

        return CreateErrorResult(statusCode, result.ErrorCode ?? "IMAGE_GENERATION_FAILED", result.ErrorMessage ?? "Image generation failed.");
    }

    return Results.Json(new
    {
        code = StatusCodes.Status200OK,
        success = true,
        errors = Array.Empty<object>(),
        data = new
        {
            previewDataUrl = result.PreviewDataUrl,
            model = result.Model ?? "gpt-image-1",
            generationSeed = request.GenerationSeed ?? string.Empty,
            attemptIndex = request.AttemptIndex,
        }
    }, statusCode: StatusCodes.Status200OK);
})
.WithName("GenerateCharacterImage");

app.MapPost("/api/character-image/generate-jobs", async (
    GenerateCharacterImageRequest request,
    ICharacterImageGenerationJobService jobService,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.CharacterName))
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "CHARACTER_NAME_REQUIRED", "Character Name is required for image generation.");
    }

    if (string.IsNullOrWhiteSpace(request.CharacterDescription))
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "CHARACTER_DESCRIPTION_REQUIRED", "Character Description is required for image generation.");
    }

    var prompt = BuildCharacterImagePrompt(request.CharacterName, request.CharacterDescription);
    var snapshot = await jobService.QueueAsync(request, prompt, cancellationToken);

    return Results.Json(new
    {
        code = StatusCodes.Status202Accepted,
        success = true,
        errors = Array.Empty<object>(),
        data = BuildCharacterImageJobData(snapshot),
    }, statusCode: StatusCodes.Status202Accepted);
})
.WithName("QueueCharacterImageGeneration");

app.MapPost("/api/character-image/upload", async (HttpRequest request, ILogger<Program> logger) =>
{
    return await HandleImageUploadRequestAsync(request, logger, "character");
})
.WithName("UploadCharacterImage");

app.MapPost("/api/item-image/generate", async (
    GenerateItemImageRequest request,
    IImageGenerationProvider imageProvider,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.ItemName))
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "ITEM_NAME_REQUIRED", "Item Name is required for image generation.");
    }

    if (string.IsNullOrWhiteSpace(request.ItemDescription))
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "ITEM_DESCRIPTION_REQUIRED", "Item Description is required for image generation.");
    }

    var prompt = BuildItemImagePrompt(request.ItemName, request.ItemDescription);
    var result = await imageProvider.GenerateAsync(new GenerateImageRequest(prompt), cancellationToken);
    if (!result.Success)
    {
        logger.LogWarning("Item image generation failed with code {Code} for item {ItemName}.", result.ErrorCode, request.ItemName);
        var statusCode = result.ErrorCode == "IMAGE_PROVIDER_NOT_CONFIGURED"
            ? StatusCodes.Status503ServiceUnavailable
            : StatusCodes.Status502BadGateway;

        return CreateErrorResult(statusCode, result.ErrorCode ?? "IMAGE_GENERATION_FAILED", result.ErrorMessage ?? "Image generation failed.");
    }

    return Results.Json(new
    {
        code = StatusCodes.Status200OK,
        success = true,
        errors = Array.Empty<object>(),
        data = new
        {
            previewDataUrl = result.PreviewDataUrl,
            model = result.Model ?? "gpt-image-1",
            generationSeed = request.GenerationSeed ?? string.Empty,
            attemptIndex = request.AttemptIndex,
        }
    }, statusCode: StatusCodes.Status200OK);
})
.WithName("GenerateItemImage");

app.MapPost("/api/item-image/upload", async (HttpRequest request, ILogger<Program> logger) =>
{
    return await HandleImageUploadRequestAsync(request, logger, "item");
})
.WithName("UploadItemImage");

app.MapPost("/api/item-image/generate-jobs", async (
    GenerateItemImageRequest request,
    IItemImageGenerationJobService jobService,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.ItemName))
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "ITEM_NAME_REQUIRED", "Item Name is required for image generation.");
    }

    if (string.IsNullOrWhiteSpace(request.ItemDescription))
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "ITEM_DESCRIPTION_REQUIRED", "Item Description is required for image generation.");
    }

    var prompt = BuildItemImagePrompt(request.ItemName, request.ItemDescription);
    var snapshot = await jobService.QueueAsync(request, prompt, cancellationToken);

    return Results.Json(new
    {
        code = StatusCodes.Status202Accepted,
        success = true,
        errors = Array.Empty<object>(),
        data = BuildItemImageJobData(snapshot),
    }, statusCode: StatusCodes.Status202Accepted);
})
.WithName("QueueItemImageGeneration");

app.MapGet("/api/item-image/generate-jobs/{jobId}", (
    string jobId,
    IItemImageGenerationJobService jobService) =>
{
    if (!jobService.TryGet(jobId, out var snapshot))
    {
        return CreateErrorResult(StatusCodes.Status404NotFound, "IMAGE_JOB_NOT_FOUND", "Item image generation job was not found.");
    }

    var isFailed = string.Equals(snapshot.Status, ItemImageGenerationJobStatuses.Failed, StringComparison.OrdinalIgnoreCase);
    var errors = isFailed
        ? new[]
        {
            new
            {
                code = snapshot.ErrorCode ?? "IMAGE_GENERATION_FAILED",
                message = snapshot.ErrorMessage ?? "Image generation failed.",
            }
        }
        : Array.Empty<object>();

    return Results.Json(new
    {
        code = StatusCodes.Status200OK,
        success = !isFailed,
        errors,
        data = BuildItemImageJobData(snapshot),
    }, statusCode: StatusCodes.Status200OK);
})
.WithName("GetItemImageGenerationJob");

app.MapGet("/api/room-image/generate-jobs/{jobId}", (
    string jobId,
    IRoomImageGenerationJobService jobService) =>
{
    if (!jobService.TryGet(jobId, out var snapshot))
    {
        return CreateErrorResult(StatusCodes.Status404NotFound, "IMAGE_JOB_NOT_FOUND", "Room image generation job was not found.");
    }

    var isFailed = string.Equals(snapshot.Status, RoomImageGenerationJobStatuses.Failed, StringComparison.OrdinalIgnoreCase);
    var errors = isFailed
        ? new[]
        {
            new
            {
                code = snapshot.ErrorCode ?? "IMAGE_GENERATION_FAILED",
                message = snapshot.ErrorMessage ?? "Image generation failed.",
            }
        }
        : Array.Empty<object>();

    return Results.Json(new
    {
        code = StatusCodes.Status200OK,
        success = !isFailed,
        errors,
        data = BuildRoomImageJobData(snapshot),
    }, statusCode: StatusCodes.Status200OK);
})
.WithName("GetRoomImageGenerationJob");

app.MapGet("/api/character-image/generate-jobs/{jobId}", (
    string jobId,
    ICharacterImageGenerationJobService jobService) =>
{
    if (!jobService.TryGet(jobId, out var snapshot))
    {
        return CreateErrorResult(StatusCodes.Status404NotFound, "IMAGE_JOB_NOT_FOUND", "Character image generation job was not found.");
    }

    var isFailed = string.Equals(snapshot.Status, CharacterImageGenerationJobStatuses.Failed, StringComparison.OrdinalIgnoreCase);
    var errors = isFailed
        ? new[]
        {
            new
            {
                code = snapshot.ErrorCode ?? "IMAGE_GENERATION_FAILED",
                message = snapshot.ErrorMessage ?? "Image generation failed.",
            }
        }
        : Array.Empty<object>();

    return Results.Json(new
    {
        code = StatusCodes.Status200OK,
        success = !isFailed,
        errors,
        data = BuildCharacterImageJobData(snapshot),
    }, statusCode: StatusCodes.Status200OK);
})
.WithName("GetCharacterImageGenerationJob");

await app.RunAsync();

static async Task<IResult> HandleImageUploadRequestAsync(HttpRequest request, ILogger logger, string entityType)
{
    try
    {
        if (!request.HasFormContentType)
        {
            return CreateErrorResult(StatusCodes.Status400BadRequest, "FILE_REQUIRED", "Please choose an image file to continue.");
        }

        var form = await request.ReadFormAsync();
        var file = form.Files.GetFile("file");

        var validationResult = ValidateImageFile(file);
        if (validationResult is not null)
        {
            return validationResult;
        }

        var attemptIndexRaw = form["attemptIndex"].ToString();
        var attemptIndex = int.TryParse(attemptIndexRaw, out var parsedAttemptIndex) ? Math.Max(0, parsedAttemptIndex) : 0;
        var generationSeed = form["generationSeed"].ToString();

        using var memoryStream = new MemoryStream();
        await file!.CopyToAsync(memoryStream);
        var bytes = memoryStream.ToArray();

        var extension = Path.GetExtension(file.FileName);
        var contentType = ImageUploadValidation.AllowedContentTypesByExtension[extension];
        var base64 = Convert.ToBase64String(bytes);
        var previewDataUrl = $"data:{contentType};base64,{base64}";

        logger.LogInformation("Accepted {EntityType} image upload with extension {Extension} and size {Size} bytes.", entityType, extension, bytes.Length);

        return Results.Json(new
        {
            code = StatusCodes.Status200OK,
            success = true,
            errors = Array.Empty<object>(),
            data = new
            {
                previewDataUrl,
                model = "upload",
                source = "uploaded",
                fileExtension = extension,
                generationSeed,
                attemptIndex,
            }
        }, statusCode: StatusCodes.Status200OK);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to process {EntityType} image upload.", entityType);
        return CreateErrorResult(StatusCodes.Status500InternalServerError, "SERVER_ERROR", "We hit an unexpected problem while uploading the image.");
    }
}

static async Task<IResult> HandleSchemaPreviewRequestAsync(HttpRequest request, ILogger logger)
{
    try
    {
        if (!request.HasFormContentType)
        {
            return CreateErrorResult(StatusCodes.Status400BadRequest, "FILE_REQUIRED", "Please choose a JSON file to continue.");
        }

        var form = await request.ReadFormAsync();
        var file = form.Files.GetFile("file");

        var validationResult = ValidateFile(file);
        if (validationResult is not null)
        {
            return validationResult;
        }

        using var stream = file!.OpenReadStream();
        using var document = await TryParseJsonAsync(stream, file.FileName, logger);

        if (document is null)
        {
            return CreateErrorResult(StatusCodes.Status400BadRequest, "INVALID_JSON", "Uploaded file is not valid JSON.");
        }

        var schema = JsonSchemaPreviewService.Build(document.RootElement);
        return Results.Json(ApiResponse.CreateSuccess(schema), statusCode: StatusCodes.Status200OK);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to generate schema preview.");
        return CreateErrorResult(StatusCodes.Status500InternalServerError, "SERVER_ERROR", "We hit an unexpected problem while generating the schema preview.");
    }
}

static IResult? ValidateFile(IFormFile? file)
{
    if (file is null)
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "FILE_REQUIRED", "Please choose a JSON file to continue.");
    }

    if (file.Length == 0)
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "EMPTY_FILE", "The uploaded file is empty. Please upload a valid JSON file.");
    }

    if (!file.FileName.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "INVALID_FILE_TYPE", "Only .json files are supported.");
    }

    if (file.Length > MaxUploadBytes)
    {
        return CreateErrorResult(StatusCodes.Status413PayloadTooLarge, "PAYLOAD_TOO_LARGE", "The uploaded file exceeds the 1 MB limit.");
    }

    return null;
}

static IResult? ValidateImageFile(IFormFile? file)
{
    if (file is null)
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "FILE_REQUIRED", "Please choose an image file to continue.");
    }

    if (file.Length == 0)
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "EMPTY_FILE", "The uploaded file is empty. Please upload a valid image file.");
    }

    if (file.Length > MaxImageUploadBytes)
    {
        return CreateErrorResult(StatusCodes.Status413PayloadTooLarge, "PAYLOAD_TOO_LARGE", "The uploaded image exceeds the 2 MB limit.");
    }

    var extension = Path.GetExtension(file.FileName);
    if (string.IsNullOrEmpty(extension) || !ImageUploadValidation.AllowedContentTypesByExtension.TryGetValue(extension, out var expectedContentType))
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "INVALID_FILE_TYPE", "Only .png, .jpeg, and .gif image files are supported.");
    }

    if (!string.IsNullOrWhiteSpace(file.ContentType)
        && !string.Equals(file.ContentType, expectedContentType, StringComparison.OrdinalIgnoreCase)
        && !string.Equals(file.ContentType, "application/octet-stream", StringComparison.OrdinalIgnoreCase))
    {
        return CreateErrorResult(StatusCodes.Status400BadRequest, "INVALID_FILE_TYPE", "The uploaded file's content type does not match a supported image type (.png, .jpeg, .gif).");
    }

    return null;
}

static async Task<IResult> HandleSaveGonfRequestAsync(SaveGonfRequest request, ILogger logger)
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

    const string saveRootDirectory = @"C:\gonf\\";
    var gonfDirectory = Path.Combine(saveRootDirectory, request.GonfName);
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

static async Task<JsonDocument?> TryParseJsonAsync(Stream stream, string fileName, ILogger logger)
{
    try
    {
        return await JsonDocument.ParseAsync(stream);
    }
    catch (JsonException ex)
    {
        logger.LogWarning(ex, "Invalid JSON payload uploaded in file {FileName}", fileName);
        return null;
    }
}

static IResult CreateErrorResult(int statusCode, string code, string message)
{
    return Results.Json(ApiResponse.CreateError(statusCode, code, message), statusCode: statusCode);
}

static async Task<object?> PersistRoomImageAsync(SaveGonfRoomRequest room, string imageDirectory)
{
    if (room.Image is null)
    {
        return null;
    }

    var sourceImage = room.Image;
    var hasPreview = !string.IsNullOrWhiteSpace(sourceImage.PreviewDataUrl);
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
        : BuildRoomImageFileName(room.RoomId, room.RoomName, attemptIndex, ImageUploadValidation.GetExtensionFromDataUrl(sourceImage.PreviewDataUrl));

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

static async Task<object?> PersistCharacterImageAsync(SaveGonfCharacterRequest character, string imageDirectory)
{
    if (character.Image is null)
    {
        return null;
    }

    var sourceImage = character.Image;
    var hasPreview = !string.IsNullOrWhiteSpace(sourceImage.PreviewDataUrl);
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
        : BuildCharacterImageFileName(character.CharacterId, character.CharacterName, attemptIndex, ImageUploadValidation.GetExtensionFromDataUrl(sourceImage.PreviewDataUrl));

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

static async Task<object?> PersistItemImageAsync(SaveGonfItemRequest item, string imageDirectory)
{
    if (item.Image is null)
    {
        return null;
    }

    var sourceImage = item.Image;
    var hasPreview = !string.IsNullOrWhiteSpace(sourceImage.PreviewDataUrl);
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
        : BuildItemImageFileName(item.ItemId, item.ItemName, attemptIndex, ImageUploadValidation.GetExtensionFromDataUrl(sourceImage.PreviewDataUrl));

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

static string BuildRoomImageFileName(int roomId, string roomName, int attemptIndex, string extension = ".png")
{
    var safeSlugChars = roomName
        .ToLowerInvariant()
        .Select(character => char.IsLetterOrDigit(character) ? character : '-')
        .ToArray();

    var slug = new string(safeSlugChars).Trim('-');
    while (slug.Contains("--", StringComparison.Ordinal))
    {
        slug = slug.Replace("--", "-", StringComparison.Ordinal);
    }

    if (string.IsNullOrWhiteSpace(slug))
    {
        slug = "room";
    }

    return $"r{roomId:D4}_{slug}_{attemptIndex:D2}{extension}";
}

static string BuildCharacterImageFileName(int characterId, string characterName, int attemptIndex, string extension = ".png")
{
    var safeSlugChars = characterName
        .ToLowerInvariant()
        .Select(character => char.IsLetterOrDigit(character) ? character : '-')
        .ToArray();

    var slug = new string(safeSlugChars).Trim('-');
    while (slug.Contains("--", StringComparison.Ordinal))
    {
        slug = slug.Replace("--", "-", StringComparison.Ordinal);
    }

    if (string.IsNullOrWhiteSpace(slug))
    {
        slug = "character";
    }

    return $"c{characterId:D4}_{slug}_{attemptIndex:D2}{extension}";
}

static string BuildItemImageFileName(int itemId, string itemName, int attemptIndex, string extension = ".png")
{
    var safeSlugChars = itemName
        .ToLowerInvariant()
        .Select(character => char.IsLetterOrDigit(character) ? character : '-')
        .ToArray();

    var slug = new string(safeSlugChars).Trim('-');
    while (slug.Contains("--", StringComparison.Ordinal))
    {
        slug = slug.Replace("--", "-", StringComparison.Ordinal);
    }

    if (string.IsNullOrWhiteSpace(slug))
    {
        slug = "item";
    }

    return $"i{itemId:D4}_{slug}_{attemptIndex:D2}{extension}";
}

static byte[] DecodeDataUrl(string value)
{
    if (!value.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
    {
        return Convert.FromBase64String(value);
    }

    var commaIndex = value.IndexOf(',');
    if (commaIndex < 0)
    {
        throw new FormatException("Invalid data URL format.");
    }

    var metadata = value[..commaIndex];
    var payload = value[(commaIndex + 1)..];

    if (metadata.EndsWith(";base64", StringComparison.OrdinalIgnoreCase))
    {
        return Convert.FromBase64String(payload);
    }

    return System.Text.Encoding.UTF8.GetBytes(Uri.UnescapeDataString(payload));
}

static bool IsLoopbackOrigin(string origin)
{
    if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
    {
        return false;
    }

    // Allow any loopback host (localhost, 127.0.0.1, ::1) for local development.
    var isLocalHost = uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
                      || (IPAddress.TryParse(uri.Host, out var ip) && IPAddress.IsLoopback(ip));

    return isLocalHost && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
}

static bool IsDiskFull(IOException exception)
{
    var hResult = unchecked((uint)exception.HResult);
    return hResult == 0x80070070 || hResult == 0x80070027;
}

static string BuildRoomImagePrompt(string roomName, string roomDescription)
{
    var safeName = string.IsNullOrWhiteSpace(roomName) ? "Unnamed room" : roomName.Trim();
    var safeDescription = string.IsNullOrWhiteSpace(roomDescription) ? "No description provided." : roomDescription.Trim();

    return $"Create a detailed interior game background image for a room named '{safeName}'. " +
           $"Room description: {safeDescription}. " +
           "Style: hand-painted adventure game background, clean composition, no text, no UI, no logos, no watermark.";
}

static string BuildCharacterImagePrompt(string characterName, string characterDescription)
{
    var safeName = string.IsNullOrWhiteSpace(characterName) ? "Unnamed character" : characterName.Trim();
    var safeDescription = string.IsNullOrWhiteSpace(characterDescription) ? "No description provided." : characterDescription.Trim();

    return $"Create a detailed full-body adventure game character portrait for '{safeName}'. " +
           $"Character description: {safeDescription}. " +
           "Style: hand-painted fantasy adventure portrait, expressive pose, no text, no UI, no logos, no watermark.";
}

static string BuildItemImagePrompt(string itemName, string itemDescription)
{
    var safeName = string.IsNullOrWhiteSpace(itemName) ? "Unnamed item" : itemName.Trim();
    var safeDescription = string.IsNullOrWhiteSpace(itemDescription) ? "No description provided." : itemDescription.Trim();

    return $"Create a detailed adventure game item icon for '{safeName}'. " +
           $"Item description: {safeDescription}. " +
           "Style: hand-painted adventure game item art, centered composition, no text, no UI, no logos, no watermark.";
}

static object BuildRoomImageJobData(RoomImageGenerationJobSnapshot snapshot)
{
    return new
    {
        jobId = snapshot.JobId,
        status = snapshot.Status,
        previewDataUrl = snapshot.PreviewDataUrl,
        model = snapshot.Model ?? "gpt-image-1",
        generationSeed = snapshot.GenerationSeed,
        attemptIndex = snapshot.AttemptIndex,
        errorCode = snapshot.ErrorCode,
        errorMessage = snapshot.ErrorMessage,
        createdUtc = snapshot.CreatedUtc,
        completedUtc = snapshot.CompletedUtc,
    };
}

static object BuildCharacterImageJobData(CharacterImageGenerationJobSnapshot snapshot)
{
    return new
    {
        jobId = snapshot.JobId,
        status = snapshot.Status,
        previewDataUrl = snapshot.PreviewDataUrl,
        model = snapshot.Model ?? "gpt-image-1",
        generationSeed = snapshot.GenerationSeed,
        attemptIndex = snapshot.AttemptIndex,
        errorCode = snapshot.ErrorCode,
        errorMessage = snapshot.ErrorMessage,
        createdUtc = snapshot.CreatedUtc,
        completedUtc = snapshot.CompletedUtc,
    };
}

static object BuildItemImageJobData(ItemImageGenerationJobSnapshot snapshot)
{
    return new
    {
        jobId = snapshot.JobId,
        status = snapshot.Status,
        previewDataUrl = snapshot.PreviewDataUrl,
        model = snapshot.Model ?? "gpt-image-1",
        generationSeed = snapshot.GenerationSeed,
        attemptIndex = snapshot.AttemptIndex,
        errorCode = snapshot.ErrorCode,
        errorMessage = snapshot.ErrorMessage,
        createdUtc = snapshot.CreatedUtc,
        completedUtc = snapshot.CompletedUtc,
    };
}

public partial class Program { }

public static class ImageUploadValidation
{
    public static readonly IReadOnlyDictionary<string, string> AllowedContentTypesByExtension =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [".png"] = "image/png",
            [".jpg"] = "image/jpeg",
            [".jpeg"] = "image/jpeg",
            [".gif"] = "image/gif",
        };

    public static readonly IReadOnlyDictionary<string, string> ExtensionByContentType =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/png"] = ".png",
            ["image/jpeg"] = ".jpeg",
            ["image/gif"] = ".gif",
        };

    public static string GetExtensionFromDataUrl(string? dataUrl, string defaultExtension = ".png")
    {
        if (string.IsNullOrWhiteSpace(dataUrl) || !dataUrl.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            return defaultExtension;
        }

        var commaIndex = dataUrl.IndexOf(',');
        var metadata = commaIndex >= 0 ? dataUrl[5..commaIndex] : dataUrl[5..];
        var semicolonIndex = metadata.IndexOf(';');
        var mimeType = semicolonIndex >= 0 ? metadata[..semicolonIndex] : metadata;

        return ExtensionByContentType.TryGetValue(mimeType, out var extension) ? extension : defaultExtension;
    }
}
