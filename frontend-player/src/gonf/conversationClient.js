import { API_BASE_URL } from './shared'
import { getCarriedItemsForCharacter } from './gonfEngine'

export async function fetchConversationTurn({ roomName, roomDescription, characters, items, transcript, playerMessage, previousLines, characterMemory }) {
  const response = await fetch(`${API_BASE_URL}/api/conversation/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomName,
      roomDescription,
      characters: characters.map((character) => ({
        characterId: character.characterId,
        characterName: character.characterName,
        characterDescription: character.characterDescription,
        carriedItems: getCarriedItemsForCharacter(character, items),
        memoryFacts: (characterMemory ?? []).filter((fact) => fact.witnessedBy?.includes(character.characterId)),
      })),
      transcript: transcript ?? [],
      playerMessage: playerMessage ?? null,
      previousLines: previousLines ?? [],
      characterMemory: characterMemory ?? [],
    }),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.success) {
    const message = payload?.errors?.[0]?.message ?? 'Could not reach the conversation service.'
    throw new Error(message)
  }

  return {
    lines: payload.data?.lines ?? [],
    updatedCharacterMemory: payload.data?.updatedCharacterMemory ?? characterMemory ?? [],
  }
}
