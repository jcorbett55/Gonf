import { API_BASE_URL } from './shared'
import { getCarriedItemsForCharacter } from './gonfEngine'

export async function fetchConversationTurn({ roomName, roomDescription, characters, items, transcript, playerMessage, previousLines }) {
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
      })),
      transcript: transcript ?? [],
      playerMessage: playerMessage ?? null,
      previousLines: previousLines ?? [],
    }),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.success) {
    const message = payload?.errors?.[0]?.message ?? 'Could not reach the conversation service.'
    throw new Error(message)
  }

  return payload.data?.lines ?? []
}
