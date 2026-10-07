using Gonf.Api.Models;

namespace Gonf.Api.Services;

/// <summary>
/// Deterministic, independently testable enforcement of the guilty character's do-not-reveal list
/// (GONF-014 Business Rule 4, Acceptance Criteria 4, Non-Functional Requirement 1): scans already-
/// parsed <see cref="ConversationLine"/>s for a violation and substitutes a safe scripted fallback
/// line rather than letting the offending line reach the player (Edge Case 4).
/// </summary>
public static class MysteryDialogueGuard
{
    private const string FallbackLineText = "...";

    /// <summary>
    /// Scans <paramref name="lines"/> and replaces any line spoken by the case file's guilty
    /// character that contains a do-not-reveal phrase with a safe fallback line. Lines from other
    /// characters, and lines from the guilty character that don't violate the list, pass through
    /// unchanged.
    /// </summary>
    public static IReadOnlyList<ConversationLine> Enforce(
        MysteryCaseFile caseFile,
        string guiltyCharacterName,
        IReadOnlyList<ConversationLine> lines)
    {
        var doNotRevealPhrases = MysteryDialogueService.BuildDoNotRevealList(caseFile, guiltyCharacterName);

        return lines
            .Select(line =>
            {
                if (!string.Equals(line.Speaker, guiltyCharacterName, StringComparison.OrdinalIgnoreCase))
                {
                    return line;
                }

                return ContainsViolation(line.Text, doNotRevealPhrases)
                    ? line with { Text = FallbackLineText }
                    : line;
            })
            .ToArray();
    }

    /// <summary>
    /// Returns true if <paramref name="text"/> contains any of <paramref name="doNotRevealPhrases"/>
    /// as a case-insensitive substring.
    /// </summary>
    public static bool ContainsViolation(string text, IReadOnlyList<string> doNotRevealPhrases)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return false;
        }

        return doNotRevealPhrases.Any(phrase =>
            !string.IsNullOrWhiteSpace(phrase) &&
            text.Contains(phrase, StringComparison.OrdinalIgnoreCase));
    }
}
