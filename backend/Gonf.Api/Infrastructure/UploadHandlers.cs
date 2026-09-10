using System.Text.Json;

namespace Gonf.Api.Infrastructure;

public static class UploadHandlers
{
    public const long MaxUploadBytes = 1 * 1024 * 1024;
    public const long MaxImageUploadBytes = 2 * 1024 * 1024;

    public static async Task<IResult> HandleImageUploadRequestAsync(HttpRequest request, ILogger logger, string entityType)
    {
        try
        {
            if (!request.HasFormContentType)
            {
                return ApiErrorHelpers.CreateErrorResult(StatusCodes.Status400BadRequest, "FILE_REQUIRED", "Please choose an image file to continue.");
            }

            var form = await request.ReadFormAsync();
            var file = form.Files.GetFile("file");

            var validationResult = ValidateImageFile(file, entityType);
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
            return ApiErrorHelpers.CreateErrorResult(StatusCodes.Status500InternalServerError, "SERVER_ERROR", "We hit an unexpected problem while uploading the image.");
        }
    }

    public static async Task<IResult> HandleSchemaPreviewRequestAsync(HttpRequest request, ILogger logger)
    {
        try
        {
            if (!request.HasFormContentType)
            {
                return ApiErrorHelpers.CreateErrorResult(StatusCodes.Status400BadRequest, "FILE_REQUIRED", "Please choose a JSON file to continue.");
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
                return ApiErrorHelpers.CreateErrorResult(StatusCodes.Status400BadRequest, "INVALID_JSON", "Uploaded file is not valid JSON.");
            }

            var schema = Gonf.Api.Services.JsonSchemaPreviewService.Build(document.RootElement);
            return Results.Json(Gonf.Api.Models.ApiResponse.CreateSuccess(schema), statusCode: StatusCodes.Status200OK);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to generate schema preview.");
            return ApiErrorHelpers.CreateErrorResult(StatusCodes.Status500InternalServerError, "SERVER_ERROR", "We hit an unexpected problem while generating the schema preview.");
        }
    }

    public static IResult? ValidateFile(IFormFile? file)
    {
        if (file is null)
        {
            return ApiErrorHelpers.CreateErrorResult(StatusCodes.Status400BadRequest, "FILE_REQUIRED", "Please choose a JSON file to continue.");
        }

        if (file.Length == 0)
        {
            return ApiErrorHelpers.CreateErrorResult(StatusCodes.Status400BadRequest, "EMPTY_FILE", "The uploaded file is empty. Please upload a valid JSON file.");
        }

        if (!file.FileName.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
        {
            return ApiErrorHelpers.CreateErrorResult(StatusCodes.Status400BadRequest, "INVALID_FILE_TYPE", "Only .json files are supported.");
        }

        if (file.Length > MaxUploadBytes)
        {
            return ApiErrorHelpers.CreateErrorResult(StatusCodes.Status413PayloadTooLarge, "PAYLOAD_TOO_LARGE", "The uploaded file exceeds the 1 MB limit.");
        }

        return null;
    }

    public static IResult? ValidateImageFile(IFormFile? file, string entityType)
    {
        if (file is null)
        {
            return ApiErrorHelpers.CreateErrorResult(StatusCodes.Status400BadRequest, "FILE_REQUIRED", "Please choose an image file to continue.");
        }

        if (file.Length == 0)
        {
            return ApiErrorHelpers.CreateErrorResult(StatusCodes.Status400BadRequest, "EMPTY_FILE", "The uploaded file is empty. Please upload a valid image file.");
        }

        if (file.Length > MaxImageUploadBytes)
        {
            return ApiErrorHelpers.CreateErrorResult(StatusCodes.Status413PayloadTooLarge, "PAYLOAD_TOO_LARGE", "The uploaded image exceeds the 2 MB limit.");
        }

        var extension = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(extension) || !ImageUploadValidation.AllowedContentTypesByExtension.TryGetValue(extension, out var expectedContentType))
        {
            return ApiErrorHelpers.CreateErrorResult(StatusCodes.Status400BadRequest, "INVALID_FILE_TYPE", "Only .png, .jpeg, and .gif image files are supported.");
        }

        if (string.Equals(entityType, "character", StringComparison.OrdinalIgnoreCase)
            && !ImageUploadValidation.AllowedCharacterExtensions.Contains(extension))
        {
            return ApiErrorHelpers.CreateErrorResult(
                StatusCodes.Status400BadRequest,
                "INVALID_FILE_TYPE",
                "Character images must be .png or .gif so they support transparency for map overlays. Please upload a transparent-background PNG or GIF.");
        }

        if (!string.IsNullOrWhiteSpace(file.ContentType)
            && !string.Equals(file.ContentType, expectedContentType, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(file.ContentType, "application/octet-stream", StringComparison.OrdinalIgnoreCase))
        {
            return ApiErrorHelpers.CreateErrorResult(StatusCodes.Status400BadRequest, "INVALID_FILE_TYPE", "The uploaded file's content type does not match a supported image type (.png, .jpeg, .gif).");
        }

        return null;
    }

    public static async Task<JsonDocument?> TryParseJsonAsync(Stream stream, string fileName, ILogger logger)
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
}
