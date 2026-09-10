import { API_BASE_URL, allDirections, toNullableNumber, isCharacterImageOverlayEligible } from './shared'

export function buildSavedImageUrl(gonfName, image) {
  if (!gonfName || !image?.fileName) {
    return ''
  }

  return `${API_BASE_URL}/api/gonf/image/${encodeURIComponent(gonfName)}/${encodeURIComponent(image.fileName)}`
}

function normalizeImageForState(rawImage) {
  if (!rawImage || typeof rawImage !== 'object') {
    return {
      imageStatus: 'none',
      fileName: '',
      relativePath: '',
      previewDataUrl: '',
    }
  }

  return {
    imageStatus: String(rawImage.imageStatus ?? 'none'),
    fileName: String(rawImage.fileName ?? ''),
    relativePath: String(rawImage.relativePath ?? ''),
    previewDataUrl: String(rawImage.previewDataUrl ?? ''),
  }
}

function mapRawExits(rawRoom) {
  return {
    north: toNullableNumber(rawRoom.exits?.north ?? rawRoom.northExit),
    east: toNullableNumber(rawRoom.exits?.east ?? rawRoom.eastExit),
    south: toNullableNumber(rawRoom.exits?.south ?? rawRoom.southExit),
    west: toNullableNumber(rawRoom.exits?.west ?? rawRoom.westExit),
    up: toNullableNumber(rawRoom.exits?.up ?? rawRoom.upExit),
    down: toNullableNumber(rawRoom.exits?.down ?? rawRoom.downExit),
  }
}

function mapRoomForPlayerState(rawRoom, gonfName) {
  if (!rawRoom || typeof rawRoom !== 'object') {
    return null
  }

  const normalizedImage = normalizeImageForState(rawRoom.image)
  const previewDataUrl =
    normalizedImage.previewDataUrl ||
    (normalizedImage.imageStatus === 'finalized' ? buildSavedImageUrl(gonfName, normalizedImage) : '')

  return {
    roomId: Number(rawRoom.roomId),
    roomName: String(rawRoom.roomName ?? ''),
    roomDescription: String(rawRoom.roomDescription ?? ''),
    roomFloor: Number(rawRoom.roomFloor),
    isStartingRoom: Boolean(rawRoom.isStartingRoom),
    image: {
      ...normalizedImage,
      previewDataUrl,
    },
    exits: mapRawExits(rawRoom),
  }
}

function mapCharacterForPlayerState(rawCharacter, index, gonfName) {
  if (!rawCharacter || typeof rawCharacter !== 'object') {
    return null
  }

  const characterLocation = rawCharacter.location ?? rawCharacter.characterLocation ?? rawCharacter.roomId ?? ''
  const normalizedImage = normalizeImageForState(rawCharacter.image)
  const previewDataUrl =
    normalizedImage.previewDataUrl ||
    (normalizedImage.imageStatus === 'finalized' ? buildSavedImageUrl(gonfName, normalizedImage) : '')

  return {
    characterId: Number(rawCharacter.characterId ?? rawCharacter.id ?? index + 1),
    characterName: String(rawCharacter.characterName ?? rawCharacter.name ?? ''),
    characterDescription: String(rawCharacter.description ?? rawCharacter.characterDescription ?? ''),
    characterLocation: characterLocation === null || characterLocation === undefined ? '' : String(characterLocation),
    wanderer: Boolean(rawCharacter.wanderer),
    image: {
      ...normalizedImage,
      previewDataUrl,
    },
  }
}

function mapItemForPlayerState(rawItem, index) {
  if (!rawItem || typeof rawItem !== 'object') {
    return null
  }

  return {
    itemId: Number(rawItem.itemId ?? rawItem.id ?? index + 1),
    itemName: String(rawItem.itemName ?? rawItem.name ?? ''),
    itemDescription: String(rawItem.itemDescription ?? rawItem.description ?? ''),
    location: rawItem.location === null || rawItem.location === undefined ? '' : String(rawItem.location),
  }
}

export function parseLoadedGonf(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.rooms)) {
    throw new Error('File is missing a valid rooms array.')
  }

  const gonfName = String(payload.gonfName ?? '')

  const rooms = payload.rooms
    .filter((rawRoom) => rawRoom && typeof rawRoom === 'object')
    .map((rawRoom) => mapRoomForPlayerState(rawRoom, gonfName))
    .filter(Boolean)

  if (rooms.length === 0) {
    throw new Error('File does not contain any valid rooms.')
  }

  const characters = Array.isArray(payload.characters)
    ? payload.characters.map((rawCharacter, index) => mapCharacterForPlayerState(rawCharacter, index, gonfName)).filter(Boolean)
    : []

  const items = Array.isArray(payload.items)
    ? payload.items.map((rawItem, index) => mapItemForPlayerState(rawItem, index)).filter(Boolean)
    : []

  return {
    gonfName,
    rooms,
    characters,
    items,
  }
}

export function resolveStartingRoomId(rooms) {
  if (!Array.isArray(rooms) || rooms.length === 0) {
    return null
  }

  const explicitStartingRoom = rooms.find((room) => room.isStartingRoom)
  if (explicitStartingRoom) {
    return explicitStartingRoom.roomId
  }

  const lowestFloorRoom = [...rooms].sort((a, b) => a.roomFloor - b.roomFloor || a.roomId - b.roomId)[0]
  return lowestFloorRoom?.roomId ?? null
}

export function getCharactersInRoom(characters, roomId) {
  if (!Array.isArray(characters) || roomId === null || roomId === undefined) {
    return []
  }

  return characters.filter((character) => Number(character.characterLocation) === Number(roomId))
}

export function getOverlayEligibleCharactersInRoom(characters, roomId) {
  return getCharactersInRoom(characters, roomId).filter((character) => isCharacterImageOverlayEligible(character.image))
}

export function getValidExits(room) {
  if (!room?.exits) {
    return []
  }

  return allDirections.filter((direction) => room.exits[direction] !== null && room.exits[direction] !== undefined)
}

function joinNames(names) {
  if (names.length === 0) {
    return ''
  }

  if (names.length === 1) {
    return names[0]
  }

  const allButLast = names.slice(0, -1).join(', ')
  const last = names[names.length - 1]
  return `${allButLast} and ${last}`
}

function buildCharacterPresenceSentence(characters) {
  if (characters.length === 0) {
    return ''
  }

  const names = characters.map((character) => character.characterName)
  return `${joinNames(names)}${names.length === 1 ? ' is' : ' are'} here as well.`
}

export function buildRoomNarrationText(room, characters) {
  const description = room?.roomDescription ?? ''
  const presenceSentence = buildCharacterPresenceSentence(characters)

  return presenceSentence ? `${description} ${presenceSentence}`.trim() : description
}

export function findRoomById(rooms, roomId) {
  if (!Array.isArray(rooms) || roomId === null || roomId === undefined) {
    return null
  }

  return rooms.find((room) => room.roomId === Number(roomId)) ?? null
}

export function wanderCharacters(rooms, characters, randomFn = Math.random) {
  if (!Array.isArray(characters) || characters.length === 0) {
    return characters
  }

  return characters.map((character) => {
    if (!character?.wanderer) {
      return character
    }

    const currentRoom = findRoomById(rooms, character.characterLocation)
    if (!currentRoom) {
      return character
    }

    const exitRoomIds = getValidExits(currentRoom)
      .map((direction) => currentRoom.exits[direction])
      .filter((roomId) => roomId !== null && roomId !== undefined)

    const candidateRoomIds = [currentRoom.roomId, ...exitRoomIds]
    const chosenRoomId = candidateRoomIds[Math.floor(randomFn() * candidateRoomIds.length)]

    if (chosenRoomId === undefined || Number(chosenRoomId) === Number(character.characterLocation)) {
      return character
    }

    return {
      ...character,
      characterLocation: String(chosenRoomId),
    }
  })
}

export function getDepartedWandererNames(previousCharactersInRoom, nextCharactersInRoom) {
  if (!Array.isArray(previousCharactersInRoom) || previousCharactersInRoom.length === 0) {
    return []
  }

  const nextCharacterIds = new Set(
    (Array.isArray(nextCharactersInRoom) ? nextCharactersInRoom : []).map((character) => character.characterId),
  )

  return previousCharactersInRoom
    .filter((character) => character?.wanderer && !nextCharacterIds.has(character.characterId))
    .map((character) => character.characterName)
}

export function buildMissedWandererLine(remainingCharacters, departedWandererNames, randomFn = Math.random) {
  if (
    !Array.isArray(remainingCharacters) ||
    remainingCharacters.length === 0 ||
    !Array.isArray(departedWandererNames) ||
    departedWandererNames.length === 0
  ) {
    return null
  }

  const shuffledCandidates = [...remainingCharacters]
  for (let i = shuffledCandidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1))
    ;[shuffledCandidates[i], shuffledCandidates[j]] = [shuffledCandidates[j], shuffledCandidates[i]]
  }

  const speaker = shuffledCandidates.find(() => randomFn() < 0.5)
  if (!speaker) {
    return null
  }

  return {
    speaker: speaker.characterName,
    line: `Oh! You just missed ${joinNames(departedWandererNames)}.`,
  }
}
