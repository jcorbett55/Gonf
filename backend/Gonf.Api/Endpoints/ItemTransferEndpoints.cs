using Gonf.Api.Models;
using Gonf.Api.Services;
using static Gonf.Api.Infrastructure.ApiErrorHelpers;

namespace Gonf.Api.Endpoints;

public static class ItemTransferEndpoints
{
    public static WebApplication MapItemTransferEndpoints(this WebApplication app)
    {
        app.MapPost("/api/item-transfer", (ItemTransferRequest request) =>
        {
            if (request.CharacterId <= 0)
            {
                return CreateErrorResult(StatusCodes.Status400BadRequest, "CHARACTER_ID_REQUIRED", "A valid characterId is required to transfer an item.");
            }

            var result = ItemTransferService.Transfer(
                request.PlayerItemIds ?? Array.Empty<int>(),
                request.Characters ?? Array.Empty<PlayerSaveStateCharacterRequest>(),
                request.RoomItemLocations ?? Array.Empty<PlayerSaveStateItemLocationRequest>(),
                request.ItemId,
                request.CharacterId,
                request.ToCharacter,
                request.Action,
                DateTimeOffset.UtcNow);

            var response = new ItemTransferResponse(
                result.Allowed,
                result.PlayerItemIds,
                result.Characters,
                result.RoomItemLocations,
                result.MemoryFact);

            return Results.Json(new
            {
                code = StatusCodes.Status200OK,
                success = true,
                errors = Array.Empty<object>(),
                data = response,
            }, statusCode: StatusCodes.Status200OK);
        })
        .WithName("TransferItem");

        return app;
    }
}
