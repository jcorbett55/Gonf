namespace Gonf.Api.Infrastructure;

public static class ImageDataUrlHelpers
{
    public static bool IsEmbeddedImageDataUrl(string? value)
    {
        return !string.IsNullOrWhiteSpace(value) && value.StartsWith("data:", StringComparison.OrdinalIgnoreCase);
    }

    public static byte[] DecodeDataUrl(string value)
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
}
