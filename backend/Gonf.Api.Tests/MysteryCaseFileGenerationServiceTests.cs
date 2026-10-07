using Gonf.Api.Models;
using Gonf.Api.Services;

namespace Gonf.Api.Tests;

public class MysteryCaseFileGenerationServiceTests
{
    private static SaveGonfCharacterRequest MakeCharacter(int id, int? location, bool wanderer = false)
        => new(id, $"Character{id}", "A character.", location, wanderer, Array.Empty<int>());

    private static SaveGonfItemRequest MakeItem(int id, int? location)
        => new(id, $"Item{id}", ItemWeight: null, "An item.", ItemValue: null, CanHoldItems: false, CanBeCarried: true, location, Array.Empty<int>());

    private static SaveGonfRoomRequest MakeRoom(int id)
        => new(id, $"Room{id}", "A room.", RoomFloor: 0, new SaveGonfExitsRequest(null, null, null, null, null, null));

    [Fact]
    public void Generate_ReturnsNull_WhenNoCharacters()
    {
        var result = MysteryCaseFileGenerationService.Generate(
            Array.Empty<SaveGonfCharacterRequest>(),
            new[] { MakeItem(1, 1) },
            new[] { MakeRoom(1) },
            seed: 42);

        Assert.Null(result);
    }

    [Fact]
    public void Generate_GuiltyCharacterExistsInRoster()
    {
        var characters = new[] { MakeCharacter(1, 1), MakeCharacter(2, 1), MakeCharacter(3, 2) };
        var items = new[] { MakeItem(10, 1), MakeItem(11, 2), MakeItem(12, 1) };
        var rooms = new[] { MakeRoom(1), MakeRoom(2) };

        var result = MysteryCaseFileGenerationService.Generate(characters, items, rooms, seed: 7);

        Assert.NotNull(result);
        Assert.Contains(result!.GuiltyCharacterId, characters.Select(c => c.CharacterId));
    }

    [Fact]
    public void Generate_ClueItemsExistInItemData()
    {
        var characters = new[] { MakeCharacter(1, 1), MakeCharacter(2, 2) };
        var items = new[] { MakeItem(10, 1), MakeItem(11, 2), MakeItem(12, 1), MakeItem(13, 2) };
        var rooms = new[] { MakeRoom(1), MakeRoom(2) };

        var result = MysteryCaseFileGenerationService.Generate(characters, items, rooms, seed: 99);

        Assert.NotNull(result);
        var validItemIds = items.Select(i => i.ItemId).ToHashSet();
        foreach (var clue in result!.Clues)
        {
            Assert.Contains(clue.ItemId, validItemIds);
        }
    }

    [Fact]
    public void Generate_WitnessAssignmentsReferenceRealCharacters()
    {
        var characters = new[] { MakeCharacter(1, 1), MakeCharacter(2, 2, wanderer: true), MakeCharacter(3, 1) };
        var items = new[] { MakeItem(10, 1), MakeItem(11, 2), MakeItem(12, 1), MakeItem(13, 2) };
        var rooms = new[] { MakeRoom(1), MakeRoom(2) };

        var result = MysteryCaseFileGenerationService.Generate(characters, items, rooms, seed: 123);

        Assert.NotNull(result);
        var validCharacterIds = characters.Select(c => c.CharacterId).ToHashSet();
        foreach (var clue in result!.Clues)
        {
            if (clue.WitnessCharacterId is not null)
            {
                Assert.Contains(clue.WitnessCharacterId.Value, validCharacterIds);
            }
        }
    }

    [Fact]
    public void Generate_DegradesGracefully_WithNoItemsAndNoRooms()
    {
        var characters = new[] { MakeCharacter(1, 1) };
        var result = MysteryCaseFileGenerationService.Generate(characters, Array.Empty<SaveGonfItemRequest>(), Array.Empty<SaveGonfRoomRequest>(), seed: 5);

        Assert.NotNull(result);
        Assert.Empty(result!.Clues);
        Assert.Empty(result.ClueCombinationRules);
        Assert.Empty(result.SynthesizedItems);
    }

    [Fact]
    public void Generate_SynthesizesClueItems_WhenAuthoredItemsAreTooSparse()
    {
        var characters = new[] { MakeCharacter(1, 1) };
        var result = MysteryCaseFileGenerationService.Generate(characters, Array.Empty<SaveGonfItemRequest>(), new[] { MakeRoom(1) }, seed: 5);

        Assert.NotNull(result);
        Assert.NotEmpty(result!.SynthesizedItems);
        Assert.NotEmpty(result.Clues);

        var validItemIds = result.SynthesizedItems.Select(i => i.ItemId).ToHashSet();
        foreach (var clue in result.Clues)
        {
            Assert.Contains(clue.ItemId, validItemIds);
        }
    }

    [Fact]
    public void Generate_SynthesizedItemIds_DoNotCollideWithExistingAuthoredItems()
    {
        var characters = new[] { MakeCharacter(1, 1) };
        var items = new[] { MakeItem(1, 1) };
        var result = MysteryCaseFileGenerationService.Generate(characters, items, new[] { MakeRoom(1) }, seed: 11);

        Assert.NotNull(result);
        var authoredItemIds = items.Select(i => i.ItemId).ToHashSet();
        foreach (var synthesizedItem in result!.SynthesizedItems)
        {
            Assert.DoesNotContain(synthesizedItem.ItemId, authoredItemIds);
        }
    }

    [Fact]
    public void Generate_CombinationRules_OnlyReferenceGeneratedClues()
    {
        var characters = new[] { MakeCharacter(1, 1), MakeCharacter(2, 2) };
        var items = new[] { MakeItem(10, 1), MakeItem(11, 2), MakeItem(12, 1), MakeItem(13, 2) };
        var rooms = new[] { MakeRoom(1), MakeRoom(2) };

        var result = MysteryCaseFileGenerationService.Generate(characters, items, rooms, seed: 321);

        Assert.NotNull(result);
        var clueItemIds = result!.Clues.Select(c => c.ItemId).ToHashSet();
        foreach (var rule in result.ClueCombinationRules)
        {
            foreach (var requiredItemId in rule.RequiredItemIds)
            {
                Assert.Contains(requiredItemId, clueItemIds);
            }
        }
    }

    [Fact]
    public void Generate_IsDeterministic_ForSameSeedAndInputs()
    {
        var characters = new[] { MakeCharacter(1, 1), MakeCharacter(2, 2, wanderer: true), MakeCharacter(3, 1) };
        var items = new[] { MakeItem(10, 1), MakeItem(11, 2), MakeItem(12, 1), MakeItem(13, 2) };
        var rooms = new[] { MakeRoom(1), MakeRoom(2) };

        var first = MysteryCaseFileGenerationService.Generate(characters, items, rooms, seed: 555);
        var second = MysteryCaseFileGenerationService.Generate(characters, items, rooms, seed: 555);

        Assert.NotNull(first);
        Assert.NotNull(second);
        Assert.Equal(first!.GuiltyCharacterId, second!.GuiltyCharacterId);
        Assert.Equal(first.Clues.Count, second.Clues.Count);
        Assert.Equal(
            first.Clues.Select(c => (c.ItemId, c.RoomId, c.WitnessCharacterId)),
            second.Clues.Select(c => (c.ItemId, c.RoomId, c.WitnessCharacterId)));
    }

    [Fact]
    public void Generate_GuiltSelection_DoesNotAlwaysPickWanderers()
    {
        // Spot-check (GONF-013 QA Note 2): across many seeds, guilt should sometimes land on a
        // non-wanderer character, proving wanderer status isn't excluded/favored for guilt.
        var characters = new[] { MakeCharacter(1, 1, wanderer: true), MakeCharacter(2, 1, wanderer: false) };
        var items = new[] { MakeItem(10, 1) };
        var rooms = new[] { MakeRoom(1) };

        var guiltyIds = new HashSet<int>();
        for (var seed = 0; seed < 50; seed++)
        {
            var result = MysteryCaseFileGenerationService.Generate(characters, items, rooms, seed);
            Assert.NotNull(result);
            guiltyIds.Add(result!.GuiltyCharacterId);
        }

        Assert.Contains(1, guiltyIds);
        Assert.Contains(2, guiltyIds);
    }
}
