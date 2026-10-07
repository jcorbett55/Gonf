using Gonf.Api.Services;
using static Gonf.Api.Infrastructure.ApiErrorHelpers;

namespace Gonf.Api.Endpoints;

/// <summary>
/// Resolves the player's accusation against the hidden GONF-013 case file (GONF-014 Business
/// Rules 6-7, Acceptance Criteria 7-9): returns whether the accused character is the guilty
/// character without ever exposing <c>GuiltyCharacterId</c> itself to the client.
/// </summary>
public static class MysteryAccusationEndpoints
{
    public static WebApplication MapMysteryAccusationEndpoints(this WebApplication app)
    {
        app.MapPost("/api/gonf/{gonfName}/playstate/{saveId}/accuse", async (
            string gonfName,
            string saveId,
            MysteryAccusationRequest request,
            MysteryCaseFileStorageService caseFileStorageService,
            CancellationToken cancellationToken) =>
        {
            if (!PlayerSaveStateService.IsValidIdentifier(gonfName) || !PlayerSaveStateService.IsValidIdentifier(saveId))
            {
                return CreateErrorResult(StatusCodes.Status400BadRequest, "INVALID_SAVE_REFERENCE", "Gonf name or save id contains invalid characters.");
            }

            var caseFile = await caseFileStorageService.LoadOrGenerateAsync(gonfName, saveId, cancellationToken);
            if (caseFile is null)
            {
                return CreateErrorResult(StatusCodes.Status404NotFound, "CASE_FILE_NOT_FOUND", "No mystery case file could be found or generated for this Gonf.");
            }

            var isCorrect = caseFile.GuiltyCharacterId == request.AccusedCharacterId;

            // The motive is part of the hidden case file and must stay secret unless/until the
            // player has correctly identified the guilty party - at that point the mystery is
            // solved, so it is safe to reveal for the guilty character's confession rant.
            var motive = isCorrect ? caseFile.Motive : null;

            return Results.Json(new
            {
                code = StatusCodes.Status200OK,
                success = true,
                errors = Array.Empty<object>(),
                data = new { correct = isCorrect, motive },
            }, statusCode: StatusCodes.Status200OK);
        })
        .WithName("AccuseMysteryCharacter");

        return app;
    }
}

public sealed record MysteryAccusationRequest(int AccusedCharacterId);
