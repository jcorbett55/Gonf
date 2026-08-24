using System.Net;
using System.Net.Http.Json;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Collections.Concurrent;
using System.Threading.Channels;
using Gonf.Api.Models;

namespace Gonf.Api.Services;

public interface IImageGenerationProvider
{
    Task<ImageGenerationResult> GenerateAsync(GenerateImageRequest request, CancellationToken cancellationToken);
}

public sealed class OpenAiImageProvider : IImageGenerationProvider
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<OpenAiImageProvider> _logger;

    public OpenAiImageProvider(HttpClient httpClient, IConfiguration configuration, ILogger<OpenAiImageProvider> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<ImageGenerationResult> GenerateAsync(GenerateImageRequest request, CancellationToken cancellationToken)
    {
        var baseUrl = _configuration["ImageProvider:Imps:BaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            return new ImageGenerationResult(
                false,
                null,
                null,
                "IMAGE_PROVIDER_NOT_CONFIGURED",
                "Image provider is not configured. Set ImageProvider:Imps:BaseUrl."
            );
        }

        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var baseUri))
        {
            return new ImageGenerationResult(
                false,
                null,
                null,
                "IMAGE_PROVIDER_NOT_CONFIGURED",
                "Image provider base URL is invalid."
            );
        }

        var generatePath = _configuration["ImageProvider:Imps:GeneratePath"] ?? "/api/v1/images/generate";
        var defaultModel = _configuration["ImageProvider:Imps:Model"];
        var defaultSampler = _configuration["ImageProvider:Imps:Sampler"];
        var defaultSteps = ParseInt(_configuration["ImageProvider:Imps:Steps"], 20);
        var defaultGuidanceScale = ParseDouble(_configuration["ImageProvider:Imps:GuidanceScale"], 7.0d);
        var (width, height) = ParseSize(request.Size ?? _configuration["ImageProvider:Imps:Size"] ?? "1024x1024");

        var requestUri = new Uri(baseUri, generatePath);
        var payload = new Dictionary<string, object?>
        {
            ["prompt"] = request.Prompt,
            ["width"] = width,
            ["height"] = height,
            ["steps"] = defaultSteps,
            ["guidanceScale"] = defaultGuidanceScale,
        };

        if (!string.IsNullOrWhiteSpace(request.Model ?? defaultModel))
        {
            payload["model"] = request.Model ?? defaultModel;
        }

        if (!string.IsNullOrWhiteSpace(defaultSampler))
        {
            payload["sampler"] = defaultSampler;
        }

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.PostAsJsonAsync(requestUri, payload, cancellationToken);
        }
        catch (OperationCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "IMPS request timed out or was canceled by the upstream provider.");
            return new ImageGenerationResult(
                false,
                null,
                request.Model ?? defaultModel,
                "IMAGE_GENERATION_TIMEOUT",
                "Image generation is still running. Please try again shortly."
            );
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "IMPS request failed.");
            return new ImageGenerationResult(
                false,
                null,
                request.Model ?? defaultModel,
                "IMAGE_GENERATION_FAILED",
                "Image generation request failed."
            );
        }

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("IMPS returned status {StatusCode}. Body: {Body}", (int)response.StatusCode, body);

            var parsedError = TryParseImpsError(body);
            var errorCode = parsedError?.ErrorCode;
            var errorMessage = parsedError?.ErrorMessage;

            if (string.IsNullOrWhiteSpace(errorCode)
                && (response.StatusCode == HttpStatusCode.RequestTimeout || response.StatusCode == HttpStatusCode.GatewayTimeout))
            {
                errorCode = "IMAGE_GENERATION_TIMEOUT";
                errorMessage = "Image generation is still running. Please try again shortly.";
            }

            return new ImageGenerationResult(
                false,
                null,
                request.Model ?? defaultModel,
                errorCode ?? "IMAGE_GENERATION_FAILED",
                errorMessage ?? "Image provider rejected the request."
            );
        }

        try
        {
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            var success = root.TryGetProperty("success", out var successElement) && successElement.GetBoolean();
            if (!success)
            {
                var parsedError = TryParseImpsError(body);
                return new ImageGenerationResult(
                    false,
                    null,
                    request.Model ?? defaultModel,
                    parsedError?.ErrorCode ?? "IMAGE_GENERATION_FAILED",
                    parsedError?.ErrorMessage ?? "Image provider rejected the request."
                );
            }

            if (!root.TryGetProperty("data", out var dataElement) || dataElement.ValueKind != JsonValueKind.Object)
            {
                return new ImageGenerationResult(
                    false,
                    null,
                    request.Model ?? defaultModel,
                    "IMAGE_GENERATION_FAILED",
                    "Image provider returned an invalid response payload."
                );
            }

            var base64 = dataElement.GetProperty("base64").GetString();
            var mimeType = dataElement.TryGetProperty("mimeType", out var mimeTypeElement)
                ? mimeTypeElement.GetString() ?? "image/png"
                : "image/png";
            var model = dataElement.TryGetProperty("model", out var modelElement)
                ? modelElement.GetString()
                : request.Model ?? defaultModel;

            if (string.IsNullOrWhiteSpace(base64))
            {
                return new ImageGenerationResult(
                    false,
                    null,
                    model,
                    "IMAGE_GENERATION_FAILED",
                    "Image provider returned an empty image payload."
                );
            }

            var dataUrl = $"data:{mimeType};base64,{base64}";
            return new ImageGenerationResult(true, dataUrl, model, null, null);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "IMPS response parsing failed.");
            return new ImageGenerationResult(
                false,
                null,
                request.Model ?? defaultModel,
                "IMAGE_GENERATION_FAILED",
                "Image provider response could not be parsed."
            );
        }
    }

    private static (int Width, int Height) ParseSize(string size)
    {
        var parts = size.Split('x', 'X', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 2 && int.TryParse(parts[0], out var width) && int.TryParse(parts[1], out var height))
        {
            return (width, height);
        }

        return (1024, 1024);
    }

    private static int ParseInt(string? rawValue, int fallback)
    {
        return int.TryParse(rawValue, out var parsed) ? parsed : fallback;
    }

    private static double ParseDouble(string? rawValue, double fallback)
    {
        return double.TryParse(rawValue, out var parsed) ? parsed : fallback;
    }

    private static (string ErrorCode, string ErrorMessage)? TryParseImpsError(string responseBody)
    {
        if (string.IsNullOrWhiteSpace(responseBody))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(responseBody);
            var root = document.RootElement;

            if (root.TryGetProperty("errors", out var errors)
                && errors.ValueKind == JsonValueKind.Array
                && errors.GetArrayLength() > 0)
            {
                var firstError = errors[0];
                var code = firstError.TryGetProperty("code", out var codeElement)
                    ? codeElement.GetString()
                    : null;
                var message = firstError.TryGetProperty("message", out var messageElement)
                    ? messageElement.GetString()
                    : null;

                if (!string.IsNullOrWhiteSpace(code) || !string.IsNullOrWhiteSpace(message))
                {
                    return (code ?? "IMAGE_GENERATION_FAILED", message ?? "Image provider rejected the request.");
                }
            }

            if (root.TryGetProperty("data", out var data)
                && data.ValueKind == JsonValueKind.Object)
            {
                var code = data.TryGetProperty("errorCode", out var codeElement)
                    ? codeElement.GetString()
                    : null;
                var message = data.TryGetProperty("errorMessage", out var messageElement)
                    ? messageElement.GetString()
                    : null;

                if (!string.IsNullOrWhiteSpace(code) || !string.IsNullOrWhiteSpace(message))
                {
                    return (code ?? "IMAGE_GENERATION_FAILED", message ?? "Image provider rejected the request.");
                }
            }

            return null;
        }
        catch
        {
            return null;
        }
    }
}

public interface IRoomImageGenerationJobService
{
    Task<RoomImageGenerationJobSnapshot> QueueAsync(GenerateRoomImageRequest request, string prompt, CancellationToken cancellationToken);
    bool TryGet(string jobId, out RoomImageGenerationJobSnapshot snapshot);
}

public static class RoomImageGenerationJobStatuses
{
    public const string Queued = "queued";
    public const string Processing = "processing";
    public const string Completed = "completed";
    public const string Failed = "failed";
}

public sealed record RoomImageGenerationJobSnapshot(
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

internal sealed record QueuedRoomImageGenerationJob(
    string JobId,
    string Prompt,
    string? GonfName,
    int? RoomId,
    string RoomName,
    int AttemptIndex,
    string GenerationSeed);

public sealed class RoomImageGenerationJobService : BackgroundService, IRoomImageGenerationJobService
{
    private readonly Channel<QueuedRoomImageGenerationJob> _jobs = Channel.CreateUnbounded<QueuedRoomImageGenerationJob>();
    private readonly ConcurrentDictionary<string, RoomImageGenerationJobSnapshot> _snapshots = new(StringComparer.Ordinal);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RoomImageGenerationJobService> _logger;

    public RoomImageGenerationJobService(IServiceScopeFactory scopeFactory, ILogger<RoomImageGenerationJobService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task<RoomImageGenerationJobSnapshot> QueueAsync(GenerateRoomImageRequest request, string prompt, CancellationToken cancellationToken)
    {
        var snapshot = new RoomImageGenerationJobSnapshot(
            Guid.NewGuid().ToString("n"),
            RoomImageGenerationJobStatuses.Queued,
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
            new QueuedRoomImageGenerationJob(snapshot.JobId, prompt, request.GonfName, request.RoomId, request.RoomName, snapshot.AttemptIndex, snapshot.GenerationSeed),
            cancellationToken);

        return snapshot;
    }

    public bool TryGet(string jobId, out RoomImageGenerationJobSnapshot snapshot)
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
                _logger.LogError(ex, "Unhandled exception while processing room image generation job {JobId}.", job.JobId);
                UpdateSnapshot(job.JobId, snapshot => snapshot with
                {
                    Status = RoomImageGenerationJobStatuses.Failed,
                    ErrorCode = "IMAGE_GENERATION_FAILED",
                    ErrorMessage = "Image generation failed.",
                    CompletedUtc = DateTimeOffset.UtcNow,
                });
            }
        }
    }

    private async Task ProcessJobAsync(QueuedRoomImageGenerationJob job, CancellationToken cancellationToken)
    {
        UpdateSnapshot(job.JobId, snapshot => snapshot with { Status = RoomImageGenerationJobStatuses.Processing });

        using var scope = _scopeFactory.CreateScope();
        var provider = scope.ServiceProvider.GetRequiredService<IImageGenerationProvider>();
        var result = await provider.GenerateAsync(new GenerateImageRequest(job.Prompt), cancellationToken);

        if (!result.Success)
        {
            UpdateSnapshot(job.JobId, snapshot => snapshot with
            {
                Status = RoomImageGenerationJobStatuses.Failed,
                Model = result.Model,
                ErrorCode = result.ErrorCode ?? "IMAGE_GENERATION_FAILED",
                ErrorMessage = result.ErrorMessage ?? "Image generation failed.",
                CompletedUtc = DateTimeOffset.UtcNow,
            });

            return;
        }

        UpdateSnapshot(job.JobId, snapshot => snapshot with
        {
            Status = RoomImageGenerationJobStatuses.Completed,
            PreviewDataUrl = result.PreviewDataUrl,
            Model = result.Model,
            CompletedUtc = DateTimeOffset.UtcNow,
        });

        await PersistCompletedImageAsync(job, result.PreviewDataUrl, cancellationToken);
    }

    private async Task PersistCompletedImageAsync(QueuedRoomImageGenerationJob job, string? previewDataUrl, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(previewDataUrl) || string.IsNullOrWhiteSpace(job.GonfName) || job.RoomId is null)
        {
            return;
        }

        var gonfName = job.GonfName.Trim();
        var gonfDirectory = Path.Combine("C:\\gonf\\", gonfName);
        var imageDirectory = Path.Combine(gonfDirectory, "img");
        Directory.CreateDirectory(imageDirectory);

        var fileName = BuildRoomImageFileName(job.RoomId.Value, job.RoomName, Math.Max(0, job.AttemptIndex), ImageUploadValidation.GetExtensionFromDataUrl(previewDataUrl));
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
        var rooms = root?["rooms"]?.AsArray();
        if (rooms is null)
        {
            return;
        }

        foreach (var roomNode in rooms)
        {
            var room = roomNode?.AsObject();
            if (room is null)
            {
                continue;
            }

            var roomId = room["roomId"]?.GetValue<int?>();
            if (roomId != job.RoomId)
            {
                continue;
            }

            var currentImage = room["image"]?.AsObject();
            var currentGenerationSeed = currentImage?["generationSeed"]?.GetValue<string?>() ?? string.Empty;
            var currentAttemptIndex = currentImage?["attemptIndex"]?.GetValue<int?>() ?? 0;

            if (!string.Equals(currentGenerationSeed, job.GenerationSeed, StringComparison.Ordinal) || currentAttemptIndex != Math.Max(0, job.AttemptIndex))
            {
                return;
            }

            room["image"] = new JsonObject
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

            var json = root.ToJsonString(new JsonSerializerOptions { WriteIndented = true });
            await File.WriteAllTextAsync(gonfPath, json, cancellationToken);
            return;
        }
    }

    private static string BuildRoomImageFileName(int roomId, string roomName, int attemptIndex, string extension = ".png")
    {
        var safeSlugChars = roomName
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
            slug = "room";
        }

        return $"r{roomId:D4}_{slug}_{attemptIndex:D2}{extension}";
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

        return Encoding.UTF8.GetBytes(Uri.UnescapeDataString(payload));
    }

    private void UpdateSnapshot(string jobId, Func<RoomImageGenerationJobSnapshot, RoomImageGenerationJobSnapshot> update)
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

public interface ICharacterImageGenerationJobService
{
    Task<CharacterImageGenerationJobSnapshot> QueueAsync(GenerateCharacterImageRequest request, string prompt, CancellationToken cancellationToken);
    bool TryGet(string jobId, out CharacterImageGenerationJobSnapshot snapshot);
}

public static class CharacterImageGenerationJobStatuses
{
    public const string Queued = "queued";
    public const string Processing = "processing";
    public const string Completed = "completed";
    public const string Failed = "failed";
}

public sealed record CharacterImageGenerationJobSnapshot(
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

internal sealed record QueuedCharacterImageGenerationJob(
    string JobId,
    string Prompt,
    string? GonfName,
    int? CharacterId,
    string CharacterName,
    int AttemptIndex,
    string GenerationSeed);

public sealed class CharacterImageGenerationJobService : BackgroundService, ICharacterImageGenerationJobService
{
    private readonly Channel<QueuedCharacterImageGenerationJob> _jobs = Channel.CreateUnbounded<QueuedCharacterImageGenerationJob>();
    private readonly ConcurrentDictionary<string, CharacterImageGenerationJobSnapshot> _snapshots = new(StringComparer.Ordinal);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<CharacterImageGenerationJobService> _logger;

    public CharacterImageGenerationJobService(IServiceScopeFactory scopeFactory, ILogger<CharacterImageGenerationJobService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task<CharacterImageGenerationJobSnapshot> QueueAsync(GenerateCharacterImageRequest request, string prompt, CancellationToken cancellationToken)
    {
        var snapshot = new CharacterImageGenerationJobSnapshot(
            Guid.NewGuid().ToString("n"),
            CharacterImageGenerationJobStatuses.Queued,
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
            new QueuedCharacterImageGenerationJob(snapshot.JobId, prompt, request.GonfName, request.CharacterId, request.CharacterName, snapshot.AttemptIndex, snapshot.GenerationSeed),
            cancellationToken);

        return snapshot;
    }

    public bool TryGet(string jobId, out CharacterImageGenerationJobSnapshot snapshot)
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
                _logger.LogError(ex, "Unhandled exception while processing character image generation job {JobId}.", job.JobId);
                UpdateSnapshot(job.JobId, snapshot => snapshot with
                {
                    Status = CharacterImageGenerationJobStatuses.Failed,
                    ErrorCode = "IMAGE_GENERATION_FAILED",
                    ErrorMessage = "Image generation failed.",
                    CompletedUtc = DateTimeOffset.UtcNow,
                });
            }
        }
    }

    private async Task ProcessJobAsync(QueuedCharacterImageGenerationJob job, CancellationToken cancellationToken)
    {
        UpdateSnapshot(job.JobId, snapshot => snapshot with { Status = CharacterImageGenerationJobStatuses.Processing });

        using var scope = _scopeFactory.CreateScope();
        var provider = scope.ServiceProvider.GetRequiredService<IImageGenerationProvider>();
        var result = await provider.GenerateAsync(new GenerateImageRequest(job.Prompt), cancellationToken);

        if (!result.Success)
        {
            UpdateSnapshot(job.JobId, snapshot => snapshot with
            {
                Status = CharacterImageGenerationJobStatuses.Failed,
                Model = result.Model,
                ErrorCode = result.ErrorCode ?? "IMAGE_GENERATION_FAILED",
                ErrorMessage = result.ErrorMessage ?? "Image generation failed.",
                CompletedUtc = DateTimeOffset.UtcNow,
            });

            return;
        }

        UpdateSnapshot(job.JobId, snapshot => snapshot with
        {
            Status = CharacterImageGenerationJobStatuses.Completed,
            PreviewDataUrl = result.PreviewDataUrl,
            Model = result.Model,
            CompletedUtc = DateTimeOffset.UtcNow,
        });

        await PersistCompletedImageAsync(job, result.PreviewDataUrl, cancellationToken);
    }

    private async Task PersistCompletedImageAsync(QueuedCharacterImageGenerationJob job, string? previewDataUrl, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(previewDataUrl) || string.IsNullOrWhiteSpace(job.GonfName) || job.CharacterId is null)
        {
            return;
        }

        var gonfName = job.GonfName.Trim();
        var gonfDirectory = Path.Combine("C:\\gonf\\", gonfName);
        var imageDirectory = Path.Combine(gonfDirectory, "img");
        Directory.CreateDirectory(imageDirectory);

        var fileName = BuildCharacterImageFileName(job.CharacterId.Value, job.CharacterName, Math.Max(0, job.AttemptIndex), ImageUploadValidation.GetExtensionFromDataUrl(previewDataUrl));
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
        var characters = root?["characters"]?.AsArray();
        if (characters is null)
        {
            return;
        }

        foreach (var characterNode in characters)
        {
            var character = characterNode?.AsObject();
            if (character is null)
            {
                continue;
            }

            var characterId = character["characterId"]?.GetValue<int?>();
            if (characterId != job.CharacterId)
            {
                continue;
            }

            var currentImage = character["image"]?.AsObject();
            var currentGenerationSeed = currentImage?["generationSeed"]?.GetValue<string?>() ?? string.Empty;
            var currentAttemptIndex = currentImage?["attemptIndex"]?.GetValue<int?>() ?? 0;

            if (!string.Equals(currentGenerationSeed, job.GenerationSeed, StringComparison.Ordinal) || currentAttemptIndex != Math.Max(0, job.AttemptIndex))
            {
                return;
            }

            character["image"] = new JsonObject
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

            var json = root.ToJsonString(new JsonSerializerOptions { WriteIndented = true });
            await File.WriteAllTextAsync(gonfPath, json, cancellationToken);
            return;
        }
    }

    private static string BuildCharacterImageFileName(int characterId, string characterName, int attemptIndex, string extension = ".png")
    {
        var safeSlugChars = characterName
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
            slug = "character";
        }

        return $"c{characterId:D4}_{slug}_{attemptIndex:D2}{extension}";
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

        return Encoding.UTF8.GetBytes(Uri.UnescapeDataString(payload));
    }

    private void UpdateSnapshot(string jobId, Func<CharacterImageGenerationJobSnapshot, CharacterImageGenerationJobSnapshot> update)
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
