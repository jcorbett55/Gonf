using Gonf.Api.Models;
using Gonf.Api.Services;

namespace Gonf.Api.Tests;

public class MysteryDialogueServiceTests
{
    private static MysteryCaseFile MakeCaseFile(int guiltyCharacterId, IReadOnlyList<MysteryClue>? clues = null, string motive = "a grudge")
        => new(
            GuiltyCharacterId: guiltyCharacterId,
            Clues: clues ?? Array.Empty<MysteryClue>(),
            ClueCombinationRules: Array.Empty<MysteryClueCombinationRule>(),
            SynthesizedItems: Array.Empty<SaveGonfItemRequest>(),
            Motive: motive);

    [Fact]
    public void CountRelevantKnownClues_ReturnsNull_ForNonGuiltyCharacter()
    {
        var caseFile = MakeCaseFile(guiltyCharacterId: 1, clues: new[] { new MysteryClue(10, 1, null) });

        var result = MysteryDialogueService.CountRelevantKnownClues(caseFile, characterId: 2, playerHeldItemIds: new[] { 10 });

        Assert.Null(result);
    }

    [Fact]
    public void CountRelevantKnownClues_ReturnsZero_WhenPlayerHoldsNoClueItems()
    {
        var caseFile = MakeCaseFile(guiltyCharacterId: 1, clues: new[] { new MysteryClue(10, 1, null) });

        var result = MysteryDialogueService.CountRelevantKnownClues(caseFile, characterId: 1, playerHeldItemIds: new[] { 99 });

        Assert.Equal(0, result);
    }

    [Fact]
    public void CountRelevantKnownClues_CountsOnlyClueItemsHeld()
    {
        var caseFile = MakeCaseFile(
            guiltyCharacterId: 1,
            clues: new[] { new MysteryClue(10, 1, null), new MysteryClue(11, 1, null), new MysteryClue(12, 1, null) });

        var result = MysteryDialogueService.CountRelevantKnownClues(caseFile, characterId: 1, playerHeldItemIds: new[] { 10, 12, 999 });

        Assert.Equal(2, result);
    }

    [Fact]
    public void BuildGuiltyCharacterInstruction_ZeroClues_DescribesBaselineInnocentBehavior()
    {
        var caseFile = MakeCaseFile(guiltyCharacterId: 1, clues: new[] { new MysteryClue(10, 1, null) });

        var instruction = MysteryDialogueService.BuildGuiltyCharacterInstruction(caseFile, "Karen", relevantKnownClueCount: 0);

        Assert.Contains("innocent", instruction, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("never confess", instruction, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void BuildGuiltyCharacterInstruction_WithKnownClues_DescribesEscalation()
    {
        var caseFile = MakeCaseFile(guiltyCharacterId: 1, clues: new[] { new MysteryClue(10, 1, null), new MysteryClue(11, 1, null) });

        var instruction = MysteryDialogueService.BuildGuiltyCharacterInstruction(caseFile, "Karen", relevantKnownClueCount: 1);

        Assert.Contains("evasive", instruction, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void BuildGuiltyCharacterInstruction_AlwaysIncludesDoNotRevealList()
    {
        var caseFile = MakeCaseFile(guiltyCharacterId: 1, motive: "a desperate need for money");

        var instruction = MysteryDialogueService.BuildGuiltyCharacterInstruction(caseFile, "Karen", relevantKnownClueCount: 0);

        Assert.Contains("a desperate need for money", instruction);
        Assert.Contains("guilty", instruction, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void BuildWitnessedClueFacts_OnlyReturnsCluesWitnessedByGivenCharacter()
    {
        var caseFile = MakeCaseFile(
            guiltyCharacterId: 1,
            clues: new[]
            {
                new MysteryClue(10, 1, WitnessCharacterId: 2),
                new MysteryClue(11, 1, WitnessCharacterId: 3),
                new MysteryClue(12, 1, WitnessCharacterId: null),
            });

        var facts = MysteryDialogueService.BuildWitnessedClueFacts(caseFile, characterId: 2);

        Assert.Single(facts);
        Assert.Contains("10", facts[0]);
    }

    [Fact]
    public void BuildSharedPremiseInstruction_MentionsAntiUniformity()
    {
        var instruction = MysteryDialogueService.BuildSharedPremiseInstruction();

        Assert.Contains("premise", instruction, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("never phrase", instruction, StringComparison.OrdinalIgnoreCase);
    }
}
