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
