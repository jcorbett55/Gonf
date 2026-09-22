using Gonf.Api.Models;
using Gonf.Api.Services;

namespace Gonf.Api.Tests;

public class ItemTransferServiceTests
{
    [Fact]
    public void WillAllowAction_AlwaysReturnsTrue_InV1()
    {
        Assert.True(ItemActionRuleGate.WillAllowAction("give"));
        Assert.True(ItemActionRuleGate.WillAllowAction("take"));
        Assert.True(ItemActionRuleGate.WillAllowAction(""));
    }

    [Fact]
    public void Transfer_PlayerToCharacter_MovesItemFromPlayerToCharacter()
    {
        var playerItemIds = new[] { 7, 8 };
        var characters = new[]
        {
            new PlayerSaveStateCharacterRequest(1, "2", Array.Empty<int>()),
        };

        var result = ItemTransferService.Transfer(
            playerItemIds,
            characters,
            roomItemLocations: Array.Empty<PlayerSaveStateItemLocationRequest>(),
            itemId: 7,
            characterId: 1,
            toCharacter: true,
            action: "give",
            timestampUtc: DateTimeOffset.UtcNow);

        Assert.True(result.Allowed);
        Assert.DoesNotContain(7, result.PlayerItemIds);
        Assert.Contains(8, result.PlayerItemIds);

        var character = Assert.Single(result.Characters);
        Assert.Contains(7, character.Contains!);
        Assert.NotNull(result.MemoryFact);
        Assert.Equal(CharacterMemoryFactType.ItemInteraction, result.MemoryFact!.FactType);
    }

    [Fact]
    public void Transfer_CharacterToPlayer_MovesItemFromCharacterToPlayer()
    {
        var playerItemIds = Array.Empty<int>();
        var characters = new[]
        {
            new PlayerSaveStateCharacterRequest(1, "2", new[] { 7 }),
        };

        var result = ItemTransferService.Transfer(
            playerItemIds,
            characters,
            roomItemLocations: Array.Empty<PlayerSaveStateItemLocationRequest>(),
            itemId: 7,
            characterId: 1,
            toCharacter: false,
            action: "take",
            timestampUtc: DateTimeOffset.UtcNow);

        Assert.True(result.Allowed);
        Assert.Contains(7, result.PlayerItemIds);

        var character = Assert.Single(result.Characters);
        Assert.DoesNotContain(7, character.Contains!);
    }

    [Fact]
    public void Transfer_ItemHeldByADifferentCharacter_RemovesFromThatCharacterAndPreventsDuplication()
    {
        var playerItemIds = Array.Empty<int>();
        var characters = new[]
        {
            new PlayerSaveStateCharacterRequest(1, "2", new[] { 7 }),
            new PlayerSaveStateCharacterRequest(2, "3", Array.Empty<int>()),
        };

        var result = ItemTransferService.Transfer(
            playerItemIds,
            characters,
            roomItemLocations: Array.Empty<PlayerSaveStateItemLocationRequest>(),
            itemId: 7,
            characterId: 2,
            toCharacter: true,
            action: "give",
            timestampUtc: DateTimeOffset.UtcNow);

        Assert.True(result.Allowed);
        Assert.DoesNotContain(7, result.PlayerItemIds);

        var characterOne = result.Characters.Single(c => c.CharacterId == 1);
        var characterTwo = result.Characters.Single(c => c.CharacterId == 2);
        Assert.DoesNotContain(7, characterOne.Contains!);
        Assert.Contains(7, characterTwo.Contains!);

        // Total occurrences of the item across all three buckets must be exactly one.
        var occurrences = result.PlayerItemIds.Count(id => id == 7)
            + result.Characters.Sum(c => c.Contains!.Count(id => id == 7));
        Assert.Equal(1, occurrences);
    }

    [Fact]
    public void Transfer_ItemCurrentlyInARoom_RemovesFromRoomItemLocationsAndAddsToCharacter()
    {
        var playerItemIds = Array.Empty<int>();
        var characters = new[]
        {
            new PlayerSaveStateCharacterRequest(1, "2", Array.Empty<int>()),
        };
        var roomItemLocations = new[]
        {
            new PlayerSaveStateItemLocationRequest(ItemId: 7, RoomId: 2),
        };

        var result = ItemTransferService.Transfer(
            playerItemIds,
            characters,
            roomItemLocations,
            itemId: 7,
            characterId: 1,
            toCharacter: true,
            action: "give",
            timestampUtc: DateTimeOffset.UtcNow);

        Assert.True(result.Allowed);
        Assert.DoesNotContain(result.RoomItemLocations, location => location.ItemId == 7);

        var character = Assert.Single(result.Characters);
        Assert.Contains(7, character.Contains!);

        // Total occurrences of the item across all three buckets must be exactly one.
        var occurrences = result.PlayerItemIds.Count(id => id == 7)
            + result.Characters.Sum(c => c.Contains!.Count(id => id == 7))
            + result.RoomItemLocations.Count(location => location.ItemId == 7);
        Assert.Equal(1, occurrences);
    }
}
