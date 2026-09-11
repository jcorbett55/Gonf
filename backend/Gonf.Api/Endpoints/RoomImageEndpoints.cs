using Gonf.Api.Models;
using Gonf.Api.Services;
using static Gonf.Api.Infrastructure.ApiErrorHelpers;
using static Gonf.Api.Infrastructure.ImagePromptBuilders;
using static Gonf.Api.Infrastructure.ImageJobResponseBuilders;
using static Gonf.Api.Infrastructure.UploadHandlers;

namespace Gonf.Api.Endpoints;

public static class RoomImageEndpoints
{
    public static WebApplication MapRoomImageEndpoints(this WebApplication app)
    {
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

        return app;
    }
}
