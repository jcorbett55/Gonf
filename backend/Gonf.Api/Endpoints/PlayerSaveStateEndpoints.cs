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
            ILogger<Program> logger,
            CancellationToken cancellationToken) =>
        {
            if (!PlayerSaveStateService.IsValidIdentifier(gonfName) || !PlayerSaveStateService.IsValidIdentifier(saveId))
            {
                return CreateErrorResult(StatusCodes.Status400BadRequest, "INVALID_SAVE_REFERENCE", "Gonf name or save id contains invalid characters.");
            }

            try
            {
                var saveState = await saveStateService.SaveAsync(gonfName, saveId, request, cancellationToken);

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
