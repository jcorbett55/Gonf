using Gonf.Api.Models;
using Gonf.Api.Services;

namespace Gonf.Api.Tests;

public class OpenAiChatCompletionProviderPromptTests
{
    [Fact]
    public void BuildSystemPrompt_IncludesRememberedFact_ForCharacterWhoWitnessedIt()
    {
        var timestampUtc = DateTimeOffset.UtcNow;
        var memory = new CharacterMemoryEntry(
            CharacterId: 1,
            FactKey: "world-event:vault-opened",
            FactType: CharacterMemoryFactType.WorldEvent,
            FactText: "The player pried open the old vault door",
            WitnessedBy: new[] { 1 },
            IsCumulative: false,
            Count: 0,
            TimestampUtc: timestampUtc);

        var character = new ConversationCharacterInfo(
            CharacterId: 1,
            CharacterName: "Karen",
            CharacterDescription: "A suspicious caretaker.",
            CarriedItems: null,
            MemoryFacts: new[] { memory });

        var request = new ConversationTurnRequest(
            RoomName: "Cellar",
            RoomDescription: "A dusty cellar.",
            Characters: new[] { character },
            Transcript: null,
            PlayerMessage: "What happened here?",
            PreviousLines: null,
            CharacterMemory: new[] { memory });

        var prompt = OpenAiChatCompletionProvider.BuildSystemPrompt(request);

        Assert.Contains("The player pried open the old vault door", prompt);
    }

    [Fact]
    public void BuildSystemPrompt_ExcludesRememberedFact_ForCharacterWhoDidNotWitnessOrGetTold()
    {
        var timestampUtc = DateTimeOffset.UtcNow;
        var memory = new CharacterMemoryEntry(
            CharacterId: 2,
            FactKey: "world-event:vault-opened",
            FactType: CharacterMemoryFactType.WorldEvent,
            FactText: "The player pried open the old vault door",
            WitnessedBy: new[] { 2 },
            IsCumulative: false,
            Count: 0,
            TimestampUtc: timestampUtc);

        var character = new ConversationCharacterInfo(
            CharacterId: 1,
            CharacterName: "Karen",
            CharacterDescription: "A suspicious caretaker.",
            CarriedItems: null,
            MemoryFacts: new[] { memory });

        var request = new ConversationTurnRequest(
            RoomName: "Cellar",
            RoomDescription: "A dusty cellar.",
            Characters: new[] { character },
            Transcript: null,
            PlayerMessage: "What happened here?",
            PreviousLines: null,
            CharacterMemory: new[] { memory });

        var prompt = OpenAiChatCompletionProvider.BuildSystemPrompt(request);

        Assert.DoesNotContain("The player pried open the old vault door", prompt);
    }

    [Fact]
    public void BuildSystemPrompt_IncludesRepeatCount_ForCumulativeRepeatedTopicFact()
    {
        var timestampUtc = DateTimeOffset.UtcNow;
        var memory = new CharacterMemoryEntry(
            CharacterId: 1,
            FactKey: "repeated-topic:1:diamond",
            FactType: CharacterMemoryFactType.RepeatedTopicQuery,
            FactText: "The player has asked about \"diamond\"",
            WitnessedBy: new[] { 1 },
            IsCumulative: true,
            Count: 3,
            TimestampUtc: timestampUtc);

        var character = new ConversationCharacterInfo(
            CharacterId: 1,
            CharacterName: "Karen",
            CharacterDescription: "A suspicious caretaker.",
            CarriedItems: null,
            MemoryFacts: new[] { memory });

        var request = new ConversationTurnRequest(
            RoomName: "Cellar",
            RoomDescription: "A dusty cellar.",
            Characters: new[] { character },
            Transcript: null,
            PlayerMessage: "Tell me about the diamond again.",
            PreviousLines: null,
            CharacterMemory: new[] { memory });

        var prompt = OpenAiChatCompletionProvider.BuildSystemPrompt(request);

        Assert.Contains("asked 3 times", prompt);
    }
}
