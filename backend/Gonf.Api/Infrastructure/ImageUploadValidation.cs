namespace Gonf.Api.Infrastructure;

public static class ImageUploadValidation
{
    public static readonly IReadOnlyDictionary<string, string> AllowedContentTypesByExtension =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [".png"] = "image/png",
            [".jpg"] = "image/jpeg",
            [".jpeg"] = "image/jpeg",
            [".gif"] = "image/gif",
        };

    public static readonly IReadOnlySet<string> AllowedCharacterExtensions =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".png", ".gif" };

    public static readonly IReadOnlyDictionary<string, string> ExtensionByContentType =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/png"] = ".png",
            ["image/jpeg"] = ".jpeg",
            ["image/gif"] = ".gif",
        };

    public static string GetExtensionFromDataUrl(string? dataUrl, string defaultExtension = ".png")
    {
        if (string.IsNullOrWhiteSpace(dataUrl) || !dataUrl.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            return defaultExtension;
        }

        var commaIndex = dataUrl.IndexOf(',');
        var metadata = commaIndex >= 0 ? dataUrl[5..commaIndex] : dataUrl[5..];
        var semicolonIndex = metadata.IndexOf(';');
        var mimeType = semicolonIndex >= 0 ? metadata[..semicolonIndex] : metadata;

        return ExtensionByContentType.TryGetValue(mimeType, out var extension) ? extension : defaultExtension;
    }
}
