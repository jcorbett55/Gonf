import { API_BASE_URL } from './shared'

export async function postItemTransfer({ itemId, characterId, toCharacter, action, playerItemIds, characters, roomItemLocations }) {
  const response = await fetch(`${API_BASE_URL}/api/item-transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      itemId,
      characterId,
      toCharacter,
      action,
      playerItemIds: playerItemIds ?? [],
      characters: characters ?? [],
      roomItemLocations: roomItemLocations ?? [],
    }),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.success) {
    const message = payload?.errors?.[0]?.message ?? 'Could not reach the item transfer service.'
    throw new Error(message)
  }

  return payload.data
}
