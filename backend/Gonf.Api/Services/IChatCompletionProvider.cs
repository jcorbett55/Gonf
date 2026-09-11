using Gonf.Api.Models;

namespace Gonf.Api.Services;

public interface IChatCompletionProvider
{
    Task<ConversationTurnResult> GenerateConversationTurnAsync(ConversationTurnRequest request, CancellationToken cancellationToken);
}
