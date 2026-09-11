using Gonf.Api.Models;
using Gonf.Api.Services;
using static Gonf.Api.Infrastructure.ApiErrorHelpers;
using static Gonf.Api.Infrastructure.ImagePromptBuilders;
using static Gonf.Api.Infrastructure.ImageJobResponseBuilders;
using static Gonf.Api.Infrastructure.UploadHandlers;

namespace Gonf.Api.Endpoints;

public static class CharacterImageEndpoints
{
    public static WebApplication MapCharacterImageEndpoints(this WebApplication app)
    {
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

        return app;
    }
}
