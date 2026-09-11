using Gonf.Api.Services;

namespace Gonf.Api.Infrastructure;

public static class ImageJobResponseBuilders
{
    public static object BuildRoomImageJobData(RoomImageGenerationJobSnapshot snapshot)
    {
        return new
        {
            jobId = snapshot.JobId,
            status = snapshot.Status,
            previewDataUrl = snapshot.PreviewDataUrl,
            model = snapshot.Model ?? "gpt-image-1",
            generationSeed = snapshot.GenerationSeed,
            attemptIndex = snapshot.AttemptIndex,
            errorCode = snapshot.ErrorCode,
            errorMessage = snapshot.ErrorMessage,
            createdUtc = snapshot.CreatedUtc,
            completedUtc = snapshot.CompletedUtc,
        };
    }

    public static object BuildCharacterImageJobData(CharacterImageGenerationJobSnapshot snapshot)
    {
        return new
        {
            jobId = snapshot.JobId,
            status = snapshot.Status,
            previewDataUrl = snapshot.PreviewDataUrl,
            model = snapshot.Model ?? "gpt-image-1",
            generationSeed = snapshot.GenerationSeed,
            attemptIndex = snapshot.AttemptIndex,
            errorCode = snapshot.ErrorCode,
            errorMessage = snapshot.ErrorMessage,
            createdUtc = snapshot.CreatedUtc,
            completedUtc = snapshot.CompletedUtc,
        };
    }

    public static object BuildItemImageJobData(ItemImageGenerationJobSnapshot snapshot)
    {
        return new
        {
            jobId = snapshot.JobId,
            status = snapshot.Status,
            previewDataUrl = snapshot.PreviewDataUrl,
            model = snapshot.Model ?? "gpt-image-1",
            generationSeed = snapshot.GenerationSeed,
            attemptIndex = snapshot.AttemptIndex,
            errorCode = snapshot.ErrorCode,
            errorMessage = snapshot.ErrorMessage,
            createdUtc = snapshot.CreatedUtc,
            completedUtc = snapshot.CompletedUtc,
        };
    }
}
