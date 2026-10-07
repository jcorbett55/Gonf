using Gonf.Api.Models;
using Gonf.Api.Services;
using static Gonf.Api.Infrastructure.ApiErrorHelpers;

namespace Gonf.Api.Endpoints;

public static class PlayerSaveStateEndpoints
{
    public static WebApplication MapPlayerSaveStateEndpoints(this WebApplication app)
    {
        app.MapGet("/api/gonf/{gonfName}/playstate/{saveId}", async (
            string gonfName,
            string saveId,
            PlayerSaveStateService saveStateService,
            CancellationToken cancellationToken) =>
        {
            if (!PlayerSaveStateService.IsValidIdentifier(gonfName) || !PlayerSaveStateService.IsValidIdentifier(saveId))
            {
                return CreateErrorResult(StatusCodes.Status400BadRequest, "INVALID_SAVE_REFERENCE", "Gonf name or save id contains invalid characters.");
            }

            var saveState = await saveStateService.LoadAsync(gonfName, saveId, cancellationToken);
            if (saveState is null)
            {
                return CreateErrorResult(StatusCodes.Status404NotFound, "SAVE_NOT_FOUND", "No saved player state was found for this Gonf.");
            }

            return Results.Json(new
            {
                code = StatusCodes.Status200OK,
                success = true,
                errors = Array.Empty<object>(),
                data = saveState,
            }, statusCode: StatusCodes.Status200OK);
        })
        .WithName("GetPlayerSaveState");

        app.MapPut("/api/gonf/{gonfName}/playstate/{saveId}", async (
            string gonfName,
            string saveId,
            PlayerSaveStateRequest request,
            PlayerSaveStateService saveStateService,
            MysteryCaseFileStorageService caseFileStorageService,
            ILogger<Program> logger,
            CancellationToken cancellationToken) =>
        {
            if (!PlayerSaveStateService.IsValidIdentifier(gonfName) || !PlayerSaveStateService.IsValidIdentifier(saveId))
            {
                return CreateErrorResult(StatusCodes.Status400BadRequest, "INVALID_SAVE_REFERENCE", "Gonf name or save id contains invalid characters.");
            }

            try
            {
                // Lazily generate the hidden GONF-013 mystery case file the first time this
                // playthrough is saved (LoadOrGenerateAsync is a no-op on subsequent calls since
                // it returns the already-persisted case file instead of regenerating). Any
                // synthesized clue items are merged into this save's RoomItemLocations so they
                // behave identically to authored items once the save is persisted. The case file
                // itself is never included in the request/response - it stays server-side only.
                var caseFile = await caseFileStorageService.LoadOrGenerateAsync(gonfName, saveId, cancellationToken);
                var effectiveRequest = caseFile is null
                    ? request
                    : request with
                    {
                        RoomItemLocations = MysteryCaseFileStorageService.MergeSynthesizedItemsIntoRoomLocations(
                            caseFile,
                            request.RoomItemLocations ?? Array.Empty<PlayerSaveStateItemLocationRequest>()),
                    };

                var saveState = await saveStateService.SaveAsync(gonfName, saveId, effectiveRequest, cancellationToken);

                return Results.Json(new
                {
                    code = StatusCodes.Status200OK,
                    success = true,
                    errors = Array.Empty<object>(),
                    data = saveState,
                }, statusCode: StatusCodes.Status200OK);
            }
            catch (UnauthorizedAccessException ex)
            {
                logger.LogWarning(ex, "Unable to save player state due to access permissions. GonfName: {GonfName}, SaveId: {SaveId}", gonfName, saveId);
                return CreateErrorResult(StatusCodes.Status403Forbidden, "SAVE_ACCESS_DENIED", "Couldn't save player state because access to C:\\gonf\\ is denied.");
            }
            catch (IOException ex)
            {
                logger.LogWarning(ex, "Unable to save player state due to a file system error. GonfName: {GonfName}, SaveId: {SaveId}", gonfName, saveId);
                return CreateErrorResult(StatusCodes.Status500InternalServerError, "SAVE_FAILED", "Couldn't save player state due to a file system error. Please try again.");
            }
        })
        .WithName("SavePlayerSaveState");

        return app;
    }
}
