import { toNullableNumber } from './shared'
import { ensureSecretStorageRoom, isSystemManagedRoom, roomNameById } from './rooms'

export function createEmptyCharacterForm() {
  return {
    characterId: null,
    characterName: '',
    characterDescription: '',
    characterLocation: '',
    characterWanderer: false,
    characterContains: [],
  }
}

export function mapCharacterForState(rawCharacter, index) {
  if (!rawCharacter || typeof rawCharacter !== 'object') {
    return null
  }

  const characterLocation = rawCharacter.location ?? rawCharacter.characterLocation ?? rawCharacter.roomId ?? ''
  const characterContainsSource = Array.isArray(rawCharacter.contains) ? rawCharacter.contains : []

  const characterContains = characterContainsSource
    .map((containedItem) => {
      if (containedItem === null || containedItem === undefined) {
        return null
      }

      if (typeof containedItem === 'object') {
        const nestedId = containedItem.itemId ?? containedItem.id
        return nestedId === null || nestedId === undefined ? null : String(nestedId)
      }

      return String(containedItem)
    })
    .filter(Boolean)

  return {
    characterId: Number(rawCharacter.characterId ?? rawCharacter.id ?? index + 1),
    characterName: String(rawCharacter.characterName ?? rawCharacter.name ?? ''),
    characterDescription: String(rawCharacter.description ?? rawCharacter.characterDescription ?? ''),
    characterLocation: characterLocation === null || characterLocation === undefined ? '' : String(characterLocation),
    characterWanderer: Boolean(rawCharacter.wanderer ?? false),
    characterContains,
  }
}

export function getNormalizedCharacterContains(characterForm) {
  return Array.isArray(characterForm.characterContains)
    ? Array.from(new Set(characterForm.characterContains.filter(Boolean)))
    : []
}

export function validateCharacterContainsSelection(selectedContains, currentItems) {
  const availableItemIds = new Set(currentItems.map((item) => String(item.itemId)))
  const hasInvalidContents = selectedContains.some((itemId) => !availableItemIds.has(itemId))
  return hasInvalidContents ? 'One or more selected carried items are invalid.' : null
}

export function buildCharacterSaveResult({
  gonfName,
  characterForm,
  rooms,
  currentItems,
  currentCharacters,
}) {
  if (!gonfName.trim()) {
    return { error: 'Gonf Name is required before saving characters.' }
  }

  if (!characterForm.characterName.trim()) {
    return { error: 'Character Name is required.' }
  }

  let nextRooms = rooms
  let characterLocationId = null

  if (characterForm.characterLocation === '') {
    const ensuredSecretStorage = ensureSecretStorageRoom(rooms)
    nextRooms = ensuredSecretStorage.rooms
    characterLocationId = ensuredSecretStorage.roomId
  } else {
    characterLocationId = toNullableNumber(characterForm.characterLocation)
    if (characterLocationId === null) {
      return { error: 'Selected character room was not found.' }
    }

    const selectedRoom = nextRooms.find((room) => room.roomId === characterLocationId)
    if (!selectedRoom) {
      return { error: 'Selected character room was not found.' }
    }

    if (isSystemManagedRoom(selectedRoom)) {
      return { error: `${selectedRoom.roomName} is system-managed and cannot be assigned manually.` }
    }
  }

  const selectedContains = getNormalizedCharacterContains(characterForm)
  const containsError = validateCharacterContainsSelection(selectedContains, currentItems)
  if (containsError) {
    return { error: containsError }
  }

  const selectedContainsSet = new Set(selectedContains.map(String))
  const nextItems = currentItems.map((item) => {
    const nextContents = Array.isArray(item.itemContents)
      ? item.itemContents.filter((containedId) => !selectedContainsSet.has(String(containedId)))
      : []

    if (!selectedContainsSet.has(String(item.itemId))) {
      return {
        ...item,
        itemContents: nextContents,
      }
    }

    return {
      ...item,
      itemLocation: '',
      itemContents: nextContents,
    }
  })

  const editingCharacterId = toNullableNumber(characterForm.characterId)
  const nextCharacterId = editingCharacterId ?? (Math.max(0, ...currentCharacters.map((character) => character.characterId)) + 1)

  const savedCharacter = {
    characterId: nextCharacterId,
    characterName: characterForm.characterName.trim(),
    characterDescription: characterForm.characterDescription.trim(),
    characterLocation: String(characterLocationId),
    characterWanderer: Boolean(characterForm.characterWanderer),
    characterContains: selectedContains,
  }

  const normalizedCharacters = currentCharacters.map((character) => ({
    ...character,
    characterContains: Array.isArray(character.characterContains) ? character.characterContains.map(String) : [],
  }))

  const nextCharactersWithoutConflicts = normalizedCharacters.map((character) => {
    if (character.characterId === nextCharacterId) {
      return character
    }

    return {
      ...character,
      characterContains: character.characterContains.filter((itemId) => !selectedContainsSet.has(String(itemId))),
    }
  })

  const nextCharacters = nextCharactersWithoutConflicts.some((character) => character.characterId === nextCharacterId)
    ? nextCharactersWithoutConflicts.map((character) => (character.characterId === nextCharacterId ? savedCharacter : character))
    : [...nextCharactersWithoutConflicts, savedCharacter]

  const nextRoomsById = new Map(nextRooms.map((room) => [room.roomId, room]))
  const locationName = roomNameById(nextRoomsById, characterLocationId)

  return {
    nextRooms,
    nextItems,
    nextCharacters,
    nextSelectedRoomId: characterLocationId,
    nextSelectedFloor: nextRoomsById.get(characterLocationId)?.roomFloor ?? 1,
    message: `Saved character ${savedCharacter.characterName} to ${locationName}.`,
  }
}
