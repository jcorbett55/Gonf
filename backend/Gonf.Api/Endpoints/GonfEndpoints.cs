using Gonf.Api.Models;
using Gonf.Api.Services;
using static Gonf.Api.Infrastructure.ApiErrorHelpers;

namespace Gonf.Api.Endpoints;

public static class GonfEndpoints
{
    public static WebApplication MapGonfEndpoints(this WebApplication app)
    {
        app.MapPost("/api/gonf/save", async (SaveGonfRequest request, ILogger<Program> logger) =>
        {
            return await GonfSaveService.HandleSaveGonfRequestAsync(request, logger);
        })
        .WithName("SaveGonf");

        app.MapGet("/api/gonf/image/{gonfName}/{fileName}", (string gonfName, string fileName, HttpContext httpContext) =>
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
            if (string.IsNullOrEmpty(imageExtension) || !Gonf.Api.Infrastructure.ImageUploadValidation.AllowedContentTypesByExtension.TryGetValue(imageExtension, out var imageContentType))
            {
                return CreateErrorResult(StatusCodes.Status400BadRequest, "IMAGE_REFERENCE_INVALID", "Only .png, .jpg, .jpeg, and .gif images are supported.");
            }

            var imagePath = Path.Combine(@"C:\gonf\\", gonfName, "img", fileName);
            if (!File.Exists(imagePath))
            {
                return CreateErrorResult(StatusCodes.Status404NotFound, "IMAGE_NOT_FOUND", "Referenced room image was not found.");
            }

            httpContext.Response.Headers.CacheControl = "no-store, no-cache, must-revalidate";
            httpContext.Response.Headers.Pragma = "no-cache";
            httpContext.Response.Headers.Expires = "0";

            var lastWriteTimeUtc = File.GetLastWriteTimeUtc(imagePath);

            return Results.File(imagePath, contentType: imageContentType, lastModified: lastWriteTimeUtc);
        })
        .WithName("GetGonfImage");

        return app;
    }
}
