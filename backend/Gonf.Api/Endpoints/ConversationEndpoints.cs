using Gonf.Api.Models;
using Gonf.Api.Services;
using static Gonf.Api.Infrastructure.ApiErrorHelpers;

namespace Gonf.Api.Endpoints;

public static class ConversationEndpoints
{
    public static WebApplication MapConversationEndpoints(this WebApplication app)
    {
        app.MapPost("/api/conversation/turn", async (
            ConversationTurnRequest request,
            IChatCompletionProvider chatProvider,
            ILogger<Program> logger,
            CancellationToken cancellationToken) =>
        {
            if (request.Characters is null || request.Characters.Count == 0)
            {
                return CreateErrorResult(StatusCodes.Status400BadRequest, "CHARACTERS_REQUIRED", "At least one character is required to generate conversation.");
            }

            var result = await chatProvider.GenerateConversationTurnAsync(request, cancellationToken);
            if (!result.Success)
            {
                logger.LogWarning("Conversation turn generation failed with code {Code}.", result.ErrorCode);
                var statusCode = result.ErrorCode == "CHAT_PROVIDER_NOT_CONFIGURED"
                    ? StatusCodes.Status503ServiceUnavailable
                    : StatusCodes.Status502BadGateway;

                return CreateErrorResult(statusCode, result.ErrorCode ?? "CHAT_GENERATION_FAILED", result.ErrorMessage ?? "Conversation generation failed.");
            }

            return Results.Json(new
            {
                code = StatusCodes.Status200OK,
                success = true,
                errors = Array.Empty<object>(),
                data = new
                {
                    lines = result.Lines,
                }
            }, statusCode: StatusCodes.Status200OK);
        })
        .WithName("GenerateConversationTurn");

        return app;
    }
}
