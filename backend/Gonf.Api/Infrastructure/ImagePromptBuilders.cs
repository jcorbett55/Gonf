namespace Gonf.Api.Infrastructure;

public static class ImagePromptBuilders
{
    public static string BuildRoomImagePrompt(string roomName, string roomDescription)
    {
        var safeName = string.IsNullOrWhiteSpace(roomName) ? "Unnamed room" : roomName.Trim();
        var safeDescription = string.IsNullOrWhiteSpace(roomDescription) ? "No description provided." : roomDescription.Trim();

        return $"Create a detailed interior game background image for a room named '{safeName}'. " +
               $"Room description: {safeDescription}. " +
               "Style: hand-painted adventure game background, clean composition, no text, no UI, no logos, no watermark.";
    }

    public static string BuildCharacterImagePrompt(string characterName, string characterDescription)
    {
        var safeName = string.IsNullOrWhiteSpace(characterName) ? "Unnamed character" : characterName.Trim();
        var safeDescription = string.IsNullOrWhiteSpace(characterDescription) ? "No description provided." : characterDescription.Trim();

        return $"Create a detailed full-body adventure game character portrait for '{safeName}'. " +
               $"Character description: {safeDescription}. " +
               "Style: hand-painted fantasy adventure portrait, expressive pose, no text, no UI, no logos, no watermark.";
    }

    public static string BuildItemImagePrompt(string itemName, string itemDescription)
    {
        var safeName = string.IsNullOrWhiteSpace(itemName) ? "Unnamed item" : itemName.Trim();
        var safeDescription = string.IsNullOrWhiteSpace(itemDescription) ? "No description provided." : itemDescription.Trim();

        return $"Create a detailed adventure game item icon for '{safeName}'. " +
               $"Item description: {safeDescription}. " +
               "Style: hand-painted adventure game item art, centered composition, no text, no UI, no logos, no watermark.";
    }
}
