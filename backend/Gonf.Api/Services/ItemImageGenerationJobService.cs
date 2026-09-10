using System.Collections.Concurrent;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Channels;
using Gonf.Api.Models;
using Gonf.Api.Infrastructure;

namespace Gonf.Api.Services;

public interface IItemImageGenerationJobService
{
    Task<ItemImageGenerationJobSnapshot> QueueAsync(GenerateItemImageRequest request, string prompt, CancellationToken cancellationToken);
    bool TryGet(string jobId, out ItemImageGenerationJobSnapshot snapshot);
}

public static class ItemImageGenerationJobStatuses
{
    public const string Queued = "queued";
    public const string Processing = "processing";
    public const string Completed = "completed";
    public const string Failed = "failed";
}

public sealed record ItemImageGenerationJobSnapshot(
    string JobId,
    string Status,
    int AttemptIndex,
    string GenerationSeed,
    string? PreviewDataUrl,
    string? Model,
    string? ErrorCode,
    string? ErrorMessage,
    DateTimeOffset CreatedUtc,
    DateTimeOffset? CompletedUtc);

internal sealed record QueuedItemImageGenerationJob(
    string JobId,
    string Prompt,
    string? GonfName,
    int? ItemId,
    string ItemName,
    int AttemptIndex,
    string GenerationSeed);

public sealed class ItemImageGenerationJobService : BackgroundService, IItemImageGenerationJobService
{
    private readonly Channel<QueuedItemImageGenerationJob> _jobs = Channel.CreateUnbounded<QueuedItemImageGenerationJob>();
    private readonly ConcurrentDictionary<string, ItemImageGenerationJobSnapshot> _snapshots = new(StringComparer.Ordinal);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ItemImageGenerationJobService> _logger;

    public ItemImageGenerationJobService(IServiceScopeFactory scopeFactory, ILogger<ItemImageGenerationJobService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task<ItemImageGenerationJobSnapshot> QueueAsync(GenerateItemImageRequest request, string prompt, CancellationToken cancellationToken)
    {
        var snapshot = new ItemImageGenerationJobSnapshot(
            Guid.NewGuid().ToString("n"),
            ItemImageGenerationJobStatuses.Queued,
            request.AttemptIndex,
            request.GenerationSeed ?? string.Empty,
            null,
            null,
            null,
            null,
            DateTimeOffset.UtcNow,
            null);

        _snapshots[snapshot.JobId] = snapshot;

        await _jobs.Writer.WriteAsync(
            new QueuedItemImageGenerationJob(snapshot.JobId, prompt, request.GonfName, request.ItemId, request.ItemName, snapshot.AttemptIndex, snapshot.GenerationSeed),
            cancellationToken);

        return snapshot;
    }

    public bool TryGet(string jobId, out ItemImageGenerationJobSnapshot snapshot)
    {
        return _snapshots.TryGetValue(jobId, out snapshot!);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in _jobs.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await ProcessJobAsync(job, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled exception while processing item image generation job {JobId}.", job.JobId);
                UpdateSnapshot(job.JobId, snapshot => snapshot with
                {
                    Status = ItemImageGenerationJobStatuses.Failed,
                    ErrorCode = "IMAGE_GENERATION_FAILED",
                    ErrorMessage = "Image generation failed.",
                    CompletedUtc = DateTimeOffset.UtcNow,
                });
            }
        }
    }

    private async Task ProcessJobAsync(QueuedItemImageGenerationJob job, CancellationToken cancellationToken)
    {
        UpdateSnapshot(job.JobId, snapshot => snapshot with { Status = ItemImageGenerationJobStatuses.Processing });

        using var scope = _scopeFactory.CreateScope();
        var provider = scope.ServiceProvider.GetRequiredService<IImageGenerationProvider>();
        var result = await provider.GenerateAsync(new GenerateImageRequest(job.Prompt), cancellationToken);

        if (!result.Success)
        {
            UpdateSnapshot(job.JobId, snapshot => snapshot with
            {
                Status = ItemImageGenerationJobStatuses.Failed,
                Model = result.Model,
                ErrorCode = result.ErrorCode ?? "IMAGE_GENERATION_FAILED",
                ErrorMessage = result.ErrorMessage ?? "Image generation failed.",
                CompletedUtc = DateTimeOffset.UtcNow,
            });

            return;
        }

        UpdateSnapshot(job.JobId, snapshot => snapshot with
        {
            Status = ItemImageGenerationJobStatuses.Completed,
            PreviewDataUrl = result.PreviewDataUrl,
            Model = result.Model,
            CompletedUtc = DateTimeOffset.UtcNow,
        });

        await PersistCompletedImageAsync(job, result.PreviewDataUrl, cancellationToken);
    }

    private async Task PersistCompletedImageAsync(QueuedItemImageGenerationJob job, string? previewDataUrl, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(previewDataUrl) || string.IsNullOrWhiteSpace(job.GonfName) || job.ItemId is null)
        {
            return;
        }

        var gonfName = job.GonfName.Trim();
        var gonfDirectory = Path.Combine("C:\\gonf\\", gonfName);
        var imageDirectory = Path.Combine(gonfDirectory, "img");
        Directory.CreateDirectory(imageDirectory);

        var fileName = BuildItemImageFileName(job.ItemId.Value, job.ItemName, Math.Max(0, job.AttemptIndex), ImageUploadValidation.GetExtensionFromDataUrl(previewDataUrl));
        var filePath = Path.Combine(imageDirectory, fileName);
        var relativePath = $"img/{fileName}";

        var bytes = DecodeDataUrl(previewDataUrl);
        await File.WriteAllBytesAsync(filePath, bytes, cancellationToken);

        var gonfPath = Path.Combine(gonfDirectory, $"{gonfName}.json");
        if (!File.Exists(gonfPath))
        {
            return;
        }

        var root = JsonNode.Parse(await File.ReadAllTextAsync(gonfPath, cancellationToken))?.AsObject();
        var items = root?["items"]?.AsArray();
        if (items is null)
        {
            return;
        }

        foreach (var itemNode in items)
        {
            var item = itemNode?.AsObject();
            if (item is null)
            {
                continue;
            }

            var itemId = item["itemId"]?.GetValue<int?>();
            if (itemId != job.ItemId)
            {
                continue;
            }

            var currentImage = item["image"]?.AsObject();
            var currentGenerationSeed = currentImage?["generationSeed"]?.GetValue<string?>() ?? string.Empty;
            var currentAttemptIndex = currentImage?["attemptIndex"]?.GetValue<int?>() ?? 0;

            if (!string.Equals(currentGenerationSeed, job.GenerationSeed, StringComparison.Ordinal) || currentAttemptIndex != Math.Max(0, job.AttemptIndex))
            {
                return;
            }

            item["image"] = new JsonObject
            {
                ["imageStatus"] = "finalized",
                ["attemptIndex"] = Math.Max(0, job.AttemptIndex),
                ["generationSeed"] = job.GenerationSeed,
                ["generatedUtc"] = DateTimeOffset.UtcNow,
                ["finalizedUtc"] = DateTimeOffset.UtcNow,
                ["fileName"] = fileName,
                ["relativePath"] = relativePath,
                ["previewDataUrl"] = string.Empty,
            };

            var json = root!.ToJsonString(new JsonSerializerOptions { WriteIndented = true });
            await File.WriteAllTextAsync(gonfPath, json, cancellationToken);
            return;
        }
    }

    private static string BuildItemImageFileName(int itemId, string itemName, int attemptIndex, string extension = ".png")
    {
        var safeSlugChars = itemName
            .ToLowerInvariant()
            .Select(character => char.IsLetterOrDigit(character) ? character : '-')
            .ToArray();

        var slug = new string(safeSlugChars).Trim('-');
        while (slug.Contains("--", StringComparison.Ordinal))
        {
            slug = slug.Replace("--", "-", StringComparison.Ordinal);
        }

        if (string.IsNullOrWhiteSpace(slug))
        {
            slug = "item";
        }

        return $"i{itemId:D4}_{slug}_{attemptIndex:D2}{extension}";
    }

    private static byte[] DecodeDataUrl(string value)
    {
        if (!value.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            return Convert.FromBase64String(value);
        }

        var commaIndex = value.IndexOf(',');
        if (commaIndex < 0)
        {
            throw new FormatException("Invalid data URL format.");
        }

        var metadata = value[..commaIndex];
        var payload = value[(commaIndex + 1)..];

        if (metadata.EndsWith(";base64", StringComparison.OrdinalIgnoreCase))
        {
            return Convert.FromBase64String(payload);
        }

        return System.Text.Encoding.UTF8.GetBytes(Uri.UnescapeDataString(payload));
    }

    private void UpdateSnapshot(string jobId, Func<ItemImageGenerationJobSnapshot, ItemImageGenerationJobSnapshot> update)
    {
        while (true)
        {
            if (!_snapshots.TryGetValue(jobId, out var snapshot))
            {
                return;
            }

            var next = update(snapshot);
            if (_snapshots.TryUpdate(jobId, next, snapshot))
            {
                return;
            }
        }
    }
}
