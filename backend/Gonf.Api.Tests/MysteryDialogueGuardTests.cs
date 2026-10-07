using Gonf.Api.Models;
using Gonf.Api.Services;

namespace Gonf.Api.Tests;

public class MysteryDialogueGuardTests
{
    private static MysteryCaseFile MakeCaseFile(int guiltyCharacterId, string motive = "a grudge over an old debt")
        => new(
            GuiltyCharacterId: guiltyCharacterId,
            Clues: Array.Empty<MysteryClue>(),
            ClueCombinationRules: Array.Empty<MysteryClueCombinationRule>(),
            SynthesizedItems: Array.Empty<SaveGonfItemRequest>(),
            Motive: motive);

    [Fact]
    public void Enforce_LeavesInnocentCharacterLinesUnchanged()
    {
        var caseFile = MakeCaseFile(guiltyCharacterId: 1);
        var lines = new[] { new ConversationLine("Alice", "I saw nothing unusual.") };

        var result = MysteryDialogueGuard.Enforce(caseFile, "Karen", lines);

        Assert.Equal("I saw nothing unusual.", result[0].Text);
    }

    [Fact]
    public void Enforce_LeavesGuiltyCharacterLineUnchanged_WhenNoViolation()
    {
        var caseFile = MakeCaseFile(guiltyCharacterId: 1);
        var lines = new[] { new ConversationLine("Karen", "I was in the kitchen all evening.") };

        var result = MysteryDialogueGuard.Enforce(caseFile, "Karen", lines);

        Assert.Equal("I was in the kitchen all evening.", result[0].Text);
    }

    [Theory]
    [InlineData("Fine, I'm guilty!")]
    [InlineData("Okay, I confess.")]
    [InlineData("I did it, are you happy now?")]
    [InlineData("It was all because of a grudge over an old debt.")]
    public void Enforce_ReplacesGuiltyCharacterLine_WhenItContainsDoNotRevealPhrase(string violatingText)
    {
        var caseFile = MakeCaseFile(guiltyCharacterId: 1);
        var lines = new[] { new ConversationLine("Karen", violatingText) };

        var result = MysteryDialogueGuard.Enforce(caseFile, "Karen", lines);

        Assert.NotEqual(violatingText, result[0].Text);
    }

    [Fact]
    public void ContainsViolation_IsCaseInsensitive()
    {
        var doNotReveal = new[] { "guilty" };

        Assert.True(MysteryDialogueGuard.ContainsViolation("I am GUILTY of nothing.", doNotReveal));
    }

    [Fact]
    public void ContainsViolation_ReturnsFalse_ForEmptyText()
    {
        var doNotReveal = new[] { "guilty" };

        Assert.False(MysteryDialogueGuard.ContainsViolation("", doNotReveal));
    }
}
