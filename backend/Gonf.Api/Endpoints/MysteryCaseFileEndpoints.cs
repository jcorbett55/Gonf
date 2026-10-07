using Gonf.Api.Services;
using static Gonf.Api.Infrastructure.ApiErrorHelpers;

namespace Gonf.Api.Endpoints;

/// <summary>
/// Exposes the hidden GONF-013 mystery case file for server-side consumption only (e.g. future
/// GONF-014 dialogue/prompt-building logic, or test/debugging tooling). This endpoint must never
/// be called by the player-facing client UI - the case file's contents (guilty character, clue
/// locations, witnesses) must remain hidden from players (GONF-013 Business Rule 2).
/// </summary>
public static class MysteryCaseFileEndpoints
{
    public static WebApplication MapMysteryCaseFileEndpoints(this WebApplication app)
    {
        app.MapGet("/api/gonf/{gonfName}/playstate/{saveId}/casefile", async (
            string gonfName,
            string saveId,
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

            return Results.Json(new
            {
                code = StatusCodes.Status200OK,
                success = true,
                errors = Array.Empty<object>(),
                data = caseFile,
            }, statusCode: StatusCodes.Status200OK);
        })
        .WithName("GetMysteryCaseFile");

        // Player-facing: returns only the synthesized clue item definitions (GONF-013's
        // placeholder items created to fill a clue shortfall). Unlike the full case file above,
        // this is safe to expose to the client because it reveals nothing about who is guilty,
        // which items are clues, or who witnessed what - it only returns item definitions
        // (name/description/location/etc.) so the player-facing UI can display and interact with
        // these items exactly like any authored item (GONF-013 Acceptance Criteria 2).
        app.MapGet("/api/gonf/{gonfName}/playstate/{saveId}/synthesized-items", async (
            string gonfName,
            string saveId,
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

            return Results.Json(new
            {
                code = StatusCodes.Status200OK,
                success = true,
                errors = Array.Empty<object>(),
                data = new { items = caseFile.SynthesizedItems },
            }, statusCode: StatusCodes.Status200OK);
        })
        .WithName("GetMysterySynthesizedItems");

        return app;
    }
}
