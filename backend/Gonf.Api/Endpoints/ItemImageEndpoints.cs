using Gonf.Api.Models;
using Gonf.Api.Services;
using static Gonf.Api.Infrastructure.ApiErrorHelpers;
using static Gonf.Api.Infrastructure.ImagePromptBuilders;
using static Gonf.Api.Infrastructure.ImageJobResponseBuilders;
using static Gonf.Api.Infrastructure.UploadHandlers;

namespace Gonf.Api.Endpoints;

public static class ItemImageEndpoints
{
    public static WebApplication MapItemImageEndpoints(this WebApplication app)
    {
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

        return app;
    }
}
