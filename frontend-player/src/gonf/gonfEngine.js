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
  const containsSource = Array.isArray(rawCharacter.contains ?? rawCharacter.characterContains)
    ? rawCharacter.contains ?? rawCharacter.characterContains
    : []

  return {
    characterId: Number(rawCharacter.characterId ?? rawCharacter.id ?? index + 1),
    characterName: String(rawCharacter.characterName ?? rawCharacter.name ?? ''),
    characterDescription: String(rawCharacter.description ?? rawCharacter.characterDescription ?? ''),
    characterLocation: characterLocation === null || characterLocation === undefined ? '' : String(characterLocation),
    originalLocation: characterLocation === null || characterLocation === undefined ? '' : String(characterLocation),
    wanderer: Boolean(rawCharacter.wanderer),
    contains: containsSource.map(Number).filter((itemId) => Number.isFinite(itemId)),
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

export function getCarriedItemsForCharacter(character, items) {
  if (!character || !Array.isArray(character.contains) || character.contains.length === 0 || !Array.isArray(items)) {
    return []
  }

  const containedIds = new Set(character.contains.map(Number))
  return items
    .filter((item) => containedIds.has(Number(item.itemId)))
    .map((item) => ({
      itemId: item.itemId,
      itemName: item.itemName,
      itemDescription: item.itemDescription,
    }))
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

export function wanderCharacters(rooms, characters, randomFn = Math.random, excludeCharacterId = null) {
  if (!Array.isArray(characters) || characters.length === 0) {
    return characters
  }

  return characters.map((character) => {
    if (!character?.wanderer) {
      return character
    }

    if (excludeCharacterId !== null && excludeCharacterId !== undefined && Number(character.characterId) === Number(excludeCharacterId)) {
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

const FOLLOW_REQUEST_PATTERN = /\b(follow|come with me|come along|accompany me|join me|walk with me)\b/i
const FOLLOW_DISMISS_PATTERN = /\b(stop following|you can go|go on without me|leave me|dismiss|no longer need you|that('?ll| will) be all|go back|go on ahead)\b/i
const FOLLOW_CONFIRM_PATTERN = /\b(yes|yeah|yep|sure|please do|do it|instead|swap|switch)\b/i
const FOLLOW_DECLINE_PATTERN = /\b(no|nah|never mind|nevermind|keep|stay with|forget it)\b/i

export function detectFollowRequestTarget(playerMessage, charactersInRoom) {
  if (!playerMessage || !Array.isArray(charactersInRoom) || charactersInRoom.length === 0) {
    return null
  }

  if (!FOLLOW_REQUEST_PATTERN.test(playerMessage)) {
    return null
  }

  const lowerMessage = playerMessage.toLowerCase()
  const matches = charactersInRoom.filter((character) =>
    character?.characterName && lowerMessage.includes(character.characterName.toLowerCase()),
  )

  if (matches.length === 0) {
    return charactersInRoom.length === 1 ? charactersInRoom[0] : null
  }

  return [...matches].sort((a, b) => b.characterName.length - a.characterName.length)[0]
}

export function detectFollowDismissRequest(playerMessage, followerCharacter) {
  if (!playerMessage || !followerCharacter) {
    return false
  }

  if (FOLLOW_DISMISS_PATTERN.test(playerMessage)) {
    return true
  }

  const lowerMessage = playerMessage.toLowerCase()
  return lowerMessage.includes(followerCharacter.characterName.toLowerCase()) && /\b(go|leave|stay|stop)\b/i.test(playerMessage)
}

export function isFollowConfirmation(playerMessage) {

  return Boolean(playerMessage) && FOLLOW_CONFIRM_PATTERN.test(playerMessage) && !FOLLOW_DECLINE_PATTERN.test(playerMessage)
}

export function isFollowDecline(playerMessage) {
  return Boolean(playerMessage) && FOLLOW_DECLINE_PATTERN.test(playerMessage)
}

export function buildAlreadyFollowingLine(currentFollowerName, requestedCharacterName) {
  return {
    speaker: currentFollowerName,
    text: `It seems you already have ${currentFollowerName} following you. Do you want ${requestedCharacterName} instead?`,
  }
}

const FOLLOW_ACKNOWLEDGEMENTS = ['Alright.', 'Ok.', 'Sure thing.', 'Very well.', "I'll come along."]

function pickFollowAcknowledgement(characterName, randomFn = Math.random) {
  const index = Math.floor(randomFn() * FOLLOW_ACKNOWLEDGEMENTS.length) % FOLLOW_ACKNOWLEDGEMENTS.length
  return FOLLOW_ACKNOWLEDGEMENTS[index]
}

export function buildFollowJoinLine(characterName, randomFn = Math.random) {
  return {
    speaker: characterName,
    text: pickFollowAcknowledgement(characterName, randomFn),
  }
}

export function buildFollowStatusLine(characterName) {
  return {
    speaker: 'System',
    text: `[${characterName} is now following you]`,
  }
}

export function buildFollowDismissedStatusLine(characterName) {
  return {
    speaker: 'System',
    text: `[${characterName} is no longer following you]`,
  }
}

export function buildFollowDismissalLine(characterName) {
  return {
    speaker: characterName,
    text: `Very well. ${characterName} nods and takes their leave.`,
  }
}

export function buildFollowCancelLine(currentFollowerName) {
  return {
    speaker: currentFollowerName,
    text: `${currentFollowerName} continues to accompany you.`,
  }
}

export function buildFollowerRoomAnnouncement(characterName) {
  return `${characterName} follows you into the room.`
}

const GIVE_TO_CHARACTER_PATTERN = /\b(here'?s?|here you go|take (?:this|it)|i'?ll give you|give you)\b/i
const ACCEPT_TRANSFER_PATTERN = /\b(ok|okay|alright|sure|thanks|thank you)\b.*\b(i'?ll take (?:that|it|this)|take (?:that|it|this))\b|\bi'?ll take (?:that|it|this)\b/i
const OFFER_ITEM_PATTERN =
  /\b(here'?s?|here you go|take (?:this|it|that)|i'?ll give you|go ahead and take|hand(?:ing)? (?:it|that|this|over)|you can have|no harm in|i suppose (?:i can|there'?s)|fine,? (?:you can|here)|alright,? (?:you can|here)|i'?ll let you have)\b/i

function findItemNameMatchInMessage(message, itemCandidates) {
  if (!message || !Array.isArray(itemCandidates) || itemCandidates.length === 0) {
    return null
  }

  const lowerMessage = message.toLowerCase()
  const matches = itemCandidates.filter((item) => {
    if (!item?.itemName) {
      return false
    }
    const lowerItemName = item.itemName.toLowerCase()
    if (lowerMessage.includes(lowerItemName)) {
      return true
    }
    // Fall back to matching on the item's significant words (e.g. "pistol" matching
    // ".22 pistol") so players do not have to type the exact authored item name.
    const significantWords = lowerItemName.split(/\s+/).filter((word) => word.length > 2)
    return significantWords.length > 0 && significantWords.some((word) => {
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`\\b${escapedWord}\\b`, 'i').test(lowerMessage)
    })
  })

  if (matches.length === 0) {
    return null
  }

  return [...matches].sort((a, b) => b.itemName.length - a.itemName.length)[0]
}

/// <summary>
/// Detects a player message intending to hand a carried item to a character present in the
/// room, e.g. "here's the gun" or "take this key". Only matches items the player is actually
/// carrying, and only when exactly one character is present to receive it (ambiguous multi-
/// character rooms are left undetected to avoid guessing the wrong recipient).
/// </summary>
export function detectItemGiveToCharacterRequest(playerMessage, playerCarriedItems, charactersInRoom) {
  if (!playerMessage || !Array.isArray(charactersInRoom) || charactersInRoom.length !== 1) {
    return null
  }

  if (!GIVE_TO_CHARACTER_PATTERN.test(playerMessage)) {
    return null
  }

  const matchedItem = findItemNameMatchInMessage(playerMessage, playerCarriedItems)
  if (!matchedItem) {
    return null
  }

  return {
    character: charactersInRoom[0],
    item: matchedItem,
  }
}

/// <summary>
/// Detects a player message asking to receive/take a specific carried item from a character
/// present in the room, e.g. "can I have the gun" or "give me the key". Only matches items the
/// target character is actually carrying.
/// </summary>
export function detectItemRequestFromCharacter(playerMessage, charactersInRoom, items) {
  if (!playerMessage || !Array.isArray(charactersInRoom) || charactersInRoom.length === 0) {
    return null
  }

  if (!/\b(give me|can i have|hand (?:me|over)|i want|i'?ll take|let me have)\b/i.test(playerMessage)) {
    return null
  }

  for (const character of charactersInRoom) {
    const carriedItems = getCarriedItemsForCharacter(character, items)
    const matchedItem = findItemNameMatchInMessage(playerMessage, carriedItems)
    if (matchedItem) {
      return { character, item: matchedItem }
    }
  }

  return null
}

/// <summary>
/// Scans a single generated conversation line (spoken by a character) for phrasing that offers
/// a carried item to the player, e.g. "Here's the gun" or "Take this key". Returns the matched
/// item only if the speaking character is actually carrying it.
/// </summary>
export function detectItemOfferInLine(line, charactersInRoom, items) {
  if (!line?.text || !line?.speaker || !Array.isArray(charactersInRoom)) {
    return null
  }

  if (!OFFER_ITEM_PATTERN.test(line.text)) {
    return null
  }

  const speakingCharacter = charactersInRoom.find(
    (character) => character.characterName.toLowerCase() === line.speaker.toLowerCase(),
  )
  if (!speakingCharacter) {
    return null
  }

  const carriedItems = getCarriedItemsForCharacter(speakingCharacter, items)
  const matchedItem = findItemNameMatchInMessage(line.text, carriedItems)
  if (!matchedItem) {
    return null
  }

  return { character: speakingCharacter, item: matchedItem }
}

/// <summary>
/// Detects the player accepting a previously offered item, e.g. "ok, I'll take that" or
/// "sure, thanks". Intended to be checked against the player's next message while a pending
/// item offer from a character is outstanding.
/// </summary>
export function isItemOfferAcceptance(playerMessage) {
  return Boolean(playerMessage) && ACCEPT_TRANSFER_PATTERN.test(playerMessage)
}

export function buildItemTransferStatusLine(itemName, fromDescription, toDescription) {
  return {
    speaker: 'System',
    text: `[${itemName} transferred from ${fromDescription} to ${toDescription}]`,
  }
}

const PLAYER_COMMAND_ALIASES = {
  help: 'help',
  h: 'help',
  inventory: 'inventory',
  inv: 'inventory',
  i: 'inventory',
}

/// <summary>
/// Parses a player message as a slash command (e.g. "/inventory", "/help"), returning the
/// canonical command name or null if the message is not a recognized command. Messages that
/// merely begin with '/' but do not match a known command/alias are also treated as
/// unrecognized so the caller can show a helpful error rather than silently ignoring input.
/// </summary>
export function parsePlayerCommand(playerMessage) {
  if (!playerMessage) {
    return null
  }

  const match = /^\/(\w+)\b/.exec(playerMessage.trim())
  if (!match) {
    return null
  }

  const alias = match[1].toLowerCase()
  return PLAYER_COMMAND_ALIASES[alias] ?? 'unknown'
}

export function buildHelpCommandLine() {
  return {
    speaker: 'System',
    text: [
      'Available commands:',
      '/help - show this list',
      '/inventory (or /inv, /i) - list items you are carrying',
    ].join('\n'),
  }
}

export function buildInventoryCommandLine(playerCarriedItems) {
  if (!Array.isArray(playerCarriedItems) || playerCarriedItems.length === 0) {
    return {
      speaker: 'System',
      text: 'Inventory: you are not carrying anything',
    }
  }

  const itemNames = playerCarriedItems.map((item) => item.itemName).filter(Boolean)
  return {
    speaker: 'System',
    text: ['Inventory:', ...itemNames].join('\n'),
  }
}

export function buildUnknownCommandLine() {
  return {
    speaker: 'System',
    text: "[Unknown command. Type /help to see available commands.]",
  }
}

