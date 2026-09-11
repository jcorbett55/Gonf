namespace Gonf.Api.Infrastructure;

public static class ImageFileNaming
{
    public static string BuildRoomImageFileName(int roomId, string roomName, int attemptIndex, string extension = ".png")
    {
        var slug = BuildSlug(roomName, "room");
        return $"r{roomId:D4}_{slug}_{attemptIndex:D2}{extension}";
    }

    public static string BuildCharacterImageFileName(int characterId, string characterName, int attemptIndex, string extension = ".png")
    {
        var slug = BuildSlug(characterName, "character");
        return $"c{characterId:D4}_{slug}_{attemptIndex:D2}{extension}";
    }

    public static string BuildItemImageFileName(int itemId, string itemName, int attemptIndex, string extension = ".png")
    {
        var slug = BuildSlug(itemName, "item");
        return $"i{itemId:D4}_{slug}_{attemptIndex:D2}{extension}";
    }

    private static string BuildSlug(string name, string fallback)
    {
        var safeSlugChars = name
            .ToLowerInvariant()
            .Select(character => char.IsLetterOrDigit(character) ? character : '-')
            .ToArray();

        var slug = new string(safeSlugChars).Trim('-');
        while (slug.Contains("--", StringComparison.Ordinal))
        {
            slug = slug.Replace("--", "-", StringComparison.Ordinal);
        }

        return string.IsNullOrWhiteSpace(slug) ? fallback : slug;
    }
}
