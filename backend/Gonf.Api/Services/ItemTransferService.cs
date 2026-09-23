using Gonf.Api.Models;

namespace Gonf.Api.Services;

public enum ItemLocationKind
{
    Room,
    Character,
    Player,
}

public sealed record ItemLocation(ItemLocationKind Kind, int? CharacterId = null);

/// <summary>
/// Performs player/character item transfers (GONF-012), enforcing the three-way single-location
/// invariant (room, character.Contains, player.ItemIds) extended from GONF-008B's two-way rule,
/// gating the request behind <see cref="ItemActionRuleGate"/>, and recording a completed transfer
/// as a character memory fact via <see cref="CharacterMemoryService"/>.
/// </summary>
public static class ItemTransferService
{
    public sealed record TransferResult(
        bool Allowed,
        IReadOnlyList<int> PlayerItemIds,
        IReadOnlyList<PlayerSaveStateCharacterRequest> Characters,
        IReadOnlyList<PlayerSaveStateItemLocationRequest> RoomItemLocations,
        CharacterMemoryEntry? MemoryFact
    );

    /// <summary>
    /// Transfers <paramref name="itemId"/> between the player and <paramref name="characterId"/>.
    /// The item is removed from wherever it currently lives (a room, any character's Contains, or
    /// the player's ItemIds) before being added to the destination, so it is never duplicated.
    /// </summary>
    public static TransferResult Transfer(
        IReadOnlyList<int> playerItemIds,
        IReadOnlyList<PlayerSaveStateCharacterRequest> characters,
        IReadOnlyList<PlayerSaveStateItemLocationRequest> roomItemLocations,
        int itemId,
        int characterId,
        bool toCharacter,
        string action,
        DateTimeOffset timestampUtc)
    {
        if (!ItemActionRuleGate.WillAllowAction(action))
        {
            return new TransferResult(false, playerItemIds, characters, roomItemLocations, MemoryFact: null);
        }

        // Edge case: the item must actually exist somewhere in the current game state (the
        // player's inventory, some character's Contains, or a room) - otherwise the request
        // references an item the player/character never had, and must be refused rather than
        // silently conjuring the item into existence at the destination. This also covers the
        // "player attempts to give an item they don't have" case, since a give request for an
        // item the player doesn't hold (and that isn't tracked anywhere else either) fails here.
        var itemExistsSomewhere = playerItemIds.Contains(itemId)
            || characters.Any(character => (character.Contains ?? Array.Empty<int>()).Contains(itemId))
            || roomItemLocations.Any(location => location.ItemId == itemId);

        if (!itemExistsSomewhere)
        {
            return new TransferResult(false, playerItemIds, characters, roomItemLocations, MemoryFact: null);
        }

        // Edge case: when taking an item from a character (character-to-player), that specific
        // character must actually currently hold the item - requesting an item from a character
        // who doesn't have it must be refused.
        if (!toCharacter)
        {
            var sourceCharacter = characters.FirstOrDefault(character => character.CharacterId == characterId);
            var characterHasItem = sourceCharacter is not null && (sourceCharacter.Contains ?? Array.Empty<int>()).Contains(itemId);
            if (!characterHasItem)
            {
                return new TransferResult(false, playerItemIds, characters, roomItemLocations, MemoryFact: null);
            }
        }

        var newPlayerItemIds = playerItemIds.Where(id => id != itemId).ToList();
        var newCharacters = characters
            .Select(character => character with
            {
                Contains = (character.Contains ?? Array.Empty<int>())
                    .Where(id => id != itemId)
                    .ToArray(),
            })
            .ToList();
        var newRoomItemLocations = roomItemLocations
            .Where(location => location.ItemId != itemId)
            .ToList();

        if (toCharacter)
        {
            var targetIndex = newCharacters.FindIndex(c => c.CharacterId == characterId);
            if (targetIndex >= 0)
            {
                var target = newCharacters[targetIndex];
                var updatedContains = (target.Contains ?? Array.Empty<int>()).Append(itemId).ToArray();
                newCharacters[targetIndex] = target with { Contains = updatedContains };
            }
        }
        else
        {
            newPlayerItemIds.Add(itemId);
        }

        var factKey = $"item-transfer-{itemId}-{characterId}-{(toCharacter ? "to-character" : "to-player")}";
        var factText = toCharacter
            ? $"Player gave item {itemId} to character {characterId}."
            : $"Player took item {itemId} from character {characterId}.";

        var memoryFact = new CharacterMemoryEntry(
            CharacterId: characterId,
            FactKey: factKey,
            FactType: CharacterMemoryFactType.ItemInteraction,
            FactText: factText,
            WitnessedBy: new[] { characterId },
            IsCumulative: false,
            Count: 1,
            TimestampUtc: timestampUtc
        );

        return new TransferResult(true, newPlayerItemIds, newCharacters, newRoomItemLocations, memoryFact);
    }
}
