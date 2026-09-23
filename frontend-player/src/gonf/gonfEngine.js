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
    goal: String(payload.goal ?? ''),
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
  goal: 'goal',
  g: 'goal',
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
      '/goal (or /g) - list the criteria needed to win, and which are already complete',
    ].join('\n'),
  }
}

/// <summary>
/// Describes a single derived goal criterion in a short, human-readable form for the /goal command,
/// e.g. "Speak with Karen", "Give the diamond to Karen", "Reach the Attic", "Hold the diamond".
/// </summary>
function describeGoalCriterion(criterion) {
  switch (criterion.type) {
    case 'speak':
      return `Speak with ${criterion.characterName}`
    case 'give':
      return `Give the ${criterion.itemName} to ${criterion.characterName}`
    case 'reach':
      return `Reach ${criterion.roomName}`
    case 'hold':
      return `Hold the ${criterion.itemName}`
    case 'present':
      return `Have ${criterion.characterName} with you`
    case 'arrive': {
      const parts = []
      if (criterion.itemNames?.length) {
        parts.push(`holding ${criterion.itemNames.join(' and ')}`)
      }
      if (criterion.characterNames?.length) {
        parts.push(`${criterion.characterNames.join(' and ')} with you`)
      }
      const requirements = parts.length ? ` while ${parts.join(' and ')}` : ''
      return `Reach ${criterion.roomName}${requirements}`
    }
    default:
      return 'Unknown goal criterion'
  }
}

/// <summary>
/// Breaks a single criterion down into one or more independently-displayed checklist sub-items,
/// each with its own "met" status. Most criterion types produce exactly one sub-item identical to
/// describeGoalCriterion's output; a compound "arrive" criterion is expanded into a separate line
/// per room/item/companion condition so the player can see which individual parts are still
/// outstanding, even though all of them must be true simultaneously for the criterion itself (and
/// the overall goal) to be considered complete.
/// </summary>
function describeGoalCriterionSubItems(criterion, spokenSet, transfers, visitedSet, heldSet, presentSet, currentRoomId) {
  if (criterion.type !== 'arrive') {
    return [
      {
        text: describeGoalCriterion(criterion),
        isMet: isGoalCriterionMet(criterion, spokenSet, transfers, visitedSet, heldSet, presentSet, currentRoomId),
      },
    ]
  }

  const items = []
  items.push({
    text: `Be in ${criterion.roomName}`,
    isMet: currentRoomId != null && Number(currentRoomId) === Number(criterion.roomId),
  })
  for (let i = 0; i < (criterion.itemIds ?? []).length; i += 1) {
    items.push({
      text: `Hold the ${criterion.itemNames[i]}`,
      isMet: heldSet.has(criterion.itemIds[i]),
    })
  }
  for (let i = 0; i < (criterion.characterIds ?? []).length; i += 1) {
    items.push({
      text: `Have ${criterion.characterNames[i]} with you`,
      isMet: presentSet.has(criterion.characterIds[i]),
    })
  }
  return items
}


function isGoalCriterionMet(criterion, spokenSet, transfers, visitedSet, heldSet, presentSet, currentRoomId) {
  if (criterion.type === 'speak') {
    return spokenSet.has(criterion.characterId)
  }
  if (criterion.type === 'reach') {
    return visitedSet.has(criterion.roomId)
  }
  if (criterion.type === 'hold') {
    return heldSet.has(criterion.itemId)
  }
  if (criterion.type === 'give') {
    return transfers.some((transfer) => transfer.itemId === criterion.itemId && transfer.characterId === criterion.characterId)
  }
  if (criterion.type === 'present') {
    return presentSet.has(criterion.characterId)
  }
  if (criterion.type === 'arrive') {
    return isArriveCriterionMet(criterion, heldSet, presentSet, currentRoomId)
  }
  return false
}

/// <summary>
/// Evaluates a compound "arrive" criterion: the player must be *currently* standing in the target
/// room, while *currently* holding every listed item and having every listed companion character
/// *currently* present (in the same room or following) - all simultaneously. Unlike "reach", this
/// does not stay satisfied once achieved; if the player leaves the room, loses an item, or a
/// companion departs, this reverts to unmet until all conditions line up again.
/// </summary>
function isArriveCriterionMet(criterion, heldSet, presentSet, currentRoomId) {
  if (currentRoomId == null || Number(currentRoomId) !== Number(criterion.roomId)) {
    return false
  }
  const itemsSatisfied = (criterion.itemIds ?? []).every((itemId) => heldSet.has(itemId))
  const companionsSatisfied = (criterion.characterIds ?? []).every((characterId) => presentSet.has(characterId))
  return itemsSatisfied && companionsSatisfied
}

/// <summary>
/// Builds the /goal (or /g) command output: a checklist of every derived win-condition criterion
/// with its current complete/incomplete status, so the player can see exactly what remains.
/// Returns a friendly message when the Gonf has no (parseable) Goal text at all.
/// </summary>
export function buildGoalCommandLine(criteria, spokenCharacterIds, completedGiveTransfers, visitedRoomIds, currentPlayerItemIds, presentCharacterIds, currentRoomId) {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    return {
      speaker: 'System',
      text: 'Goal: this Gonf has no defined win criteria.',
    }
  }

  const spokenSet = spokenCharacterIds instanceof Set ? spokenCharacterIds : new Set(spokenCharacterIds ?? [])
  const transfers = Array.isArray(completedGiveTransfers) ? completedGiveTransfers : []
  const visitedSet = visitedRoomIds instanceof Set ? visitedRoomIds : new Set(visitedRoomIds ?? [])
  const heldSet = currentPlayerItemIds instanceof Set ? currentPlayerItemIds : new Set(currentPlayerItemIds ?? [])
  const presentSet = presentCharacterIds instanceof Set ? presentCharacterIds : new Set(presentCharacterIds ?? [])

  const criteriaLines = criteria.flatMap((criterion) => {
    const subItems = describeGoalCriterionSubItems(criterion, spokenSet, transfers, visitedSet, heldSet, presentSet, currentRoomId)
    return subItems.map(({ text, isMet }) => `${isMet ? '[x]' : '[ ]'} ${text}`)
  })

  return {
    speaker: 'System',
    text: ['Goal criteria:', ...criteriaLines].join('\n'),
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

/// <summary>
/// Splits a freeform "Goal" text into independent clauses so each clause can be matched against
/// a single criterion pattern. Clauses are separated by "then"/"and then"/"after that", sentence
/// punctuation, newlines, a comma, or an "and" that immediately precedes another recognized goal
/// verb (e.g. "reach the attic and speak with Karen", "while carrying the diamond, reach the
/// attic"). Splitting on the verb keyword avoids breaking up "A, B, and C" name lists inside a
/// single "speak with" clause. Leading conditional words ("while"/"when"/"if"/"once"/"after") are
/// stripped from each clause since they don't change what must be true to satisfy it.
/// </summary>
function splitGoalClauses(goalText) {
  const clauseVerbLookahead =
    /(?=speak\b|talk\b|talked\b|spoken\b|spoke\b|give\b|make it\b|get to\b|reach\b|arrive\b|go to\b|hold\b|holding\b|carry\b|carrying\b|have\b|obtain\b|keep\b|possess\b)/i

  // Guard common name/title abbreviations (Mr., Mrs., Ms., Dr., St.) so a trailing "." in the
  // middle of a character name doesn't get mistaken for sentence-ending punctuation.
  const protectedText = goalText.replace(/\b(Mr|Mrs|Ms|Dr|St)\./gi, '$1\u0000')

  return protectedText
    .split(/(?:,?\s*(?:then|and then|after that)\s+|[.;\n]+)/i)
    .flatMap((segment) => segment.split(new RegExp(`\\s+and\\s+${clauseVerbLookahead.source}`, 'i')))
    .flatMap((segment) => segment.split(new RegExp(`,\\s*${clauseVerbLookahead.source}`, 'i')))
    .map((clause) =>
      clause
        .trim()
        .replace(/^(?:[-*\u2022]|\d+[.)])\s+/, '')
        .replace(/^(?:while|when|if|once|after)\s+/i, '')
        .replace(/^and\s+/i, '')
        .replace(/[,;]+$/, '')
        .replace(/\u0000/g, '.')
        .trim(),
    )
    .filter(Boolean)
}

/// <summary>
/// Splits a freeform "Goal" text into top-level "sentences" only (separated by "then"/"and
/// then"/"after that", sentence punctuation, or newlines) - NOT by commas or "and" before a verb.
/// This coarser split is used to detect a compound "arrive" sentence (see tryParseArriveSentence)
/// before the finer splitGoalClauses breakdown is attempted, since a compound arrival sentence's
/// internal commas/"and"s describe conditions of the same criterion rather than separate criteria.
/// </summary>
function splitGoalSentences(goalText) {
  const protectedText = goalText.replace(/\b(Mr|Mrs|Ms|Dr|St)\./gi, '$1\u0000')
  return protectedText
    .split(/(?:,?\s*(?:then|and then|after that)\s+|[.;\n]+)/i)
    .map((sentence) =>
      sentence
        .replace(/\u0000/g, '.')
        .trim()
        .replace(/^(?:[-*\u2022]|\d+[.)])\s+/, '')
        .trim(),
    )
    .filter(Boolean)
}

/// <summary>
/// Attempts to parse a whole sentence as a compound "arrive" criterion: reach a room while
/// simultaneously holding one or more items and/or having one or more companions present, e.g.
/// "While carrying the diamond, reach the Staff Quarters with Mrs. Higgiebottom" or "While holding
/// the diamond, and Karen following, reach the staff quarters". Requires a leading conditional
/// word (while/when/if/once/after) introducing the condition list, ending in a
/// reach/arrive/get-to/make-it-to/go-to/be-in/be-at ROOM clause, with an optional trailing
/// "with CHARACTER(S)" companion phrase. Returns null if the sentence doesn't match this shape at
/// all (so the caller falls back to independent per-clause parsing); returns an array (possibly
/// empty, if the room or conditions can't be resolved) if the shape matches.
/// </summary>
function tryParseArriveSentence(sentence, lookups) {
  const match = sentence.match(
    /^(?:while|when|if|once|after)\s+(.+?),?\s+(?:and\s+)?(?:make it to|get to|reach|arrive at|arrive in|go to|be in|be at)\s+(?:the\s+)?(.+?)(?:\s+with\s+(.+))?$/i,
  )
  if (!match) {
    return null
  }

  const [, conditionsText, roomNameCandidate, trailingCompanionsText] = match
  const room = lookups.findRoomByName(roomNameCandidate)
  if (!room) {
    return []
  }

  const itemIds = []
  const itemNames = []
  const characterIds = []
  const characterNames = []

  const addItem = (item) => {
    if (item && !itemIds.includes(item.itemId)) {
      itemIds.push(item.itemId)
      itemNames.push(item.itemName)
    }
  }
  const addCharacter = (character) => {
    if (character && !characterIds.includes(character.characterId)) {
      characterIds.push(character.characterId)
      characterNames.push(character.characterName)
    }
  }

  const conditions = conditionsText
    .split(/,|\band\b/i)
    .map((condition) => condition.trim().replace(/[.!?]+$/, '').trim())
    .filter(Boolean)

  for (const condition of conditions) {
    const holdMatch = condition.match(/^(?:be\s+)?(?:holding|hold|carry|carrying|have|having|obtain|keep|possess)\s+(?:the\s+)?(.+)$/i)
    if (holdMatch) {
      const item = lookups.findItemByName(holdMatch[1])
      if (item) {
        addItem(item)
        continue
      }
      // Falls through: e.g. "have Karen following"/"have Karen with you" isn't an item, so try
      // to resolve the remainder as a companion condition instead of silently dropping it.
    }

    const followMatch = condition.match(/^(?:have\s+|having\s+)?(.+?)\s+(?:is\s+)?following$/i)
    if (followMatch) {
      addCharacter(lookups.findCharacterByName(followMatch[1]))
      continue
    }

    // Bare character name used as a condition (e.g. "with Karen present").
    const presentMatch = condition.match(/^(?:have\s+|having\s+)?(.+?)\s+(?:is\s+)?present$/i)
    if (presentMatch) {
      addCharacter(lookups.findCharacterByName(presentMatch[1]))
      continue
    }

    // Bare "have/having CHARACTER" with no trailing keyword (e.g. "have Karen with you").
    const bareHaveMatch = condition.match(/^(?:have|having)\s+(.+)$/i)
    addCharacter(lookups.findCharacterByName(bareHaveMatch ? bareHaveMatch[1] : condition))
  }

  if (trailingCompanionsText) {
    for (const name of trailingCompanionsText
      .split(/,|\band\b/i)
      .map((n) => n.trim().replace(/[.!?]+$/, '').trim())
      .filter(Boolean)) {
      addCharacter(lookups.findCharacterByName(name))
    }
  }

  return [
    {
      criterion: {
        type: 'arrive',
        roomId: room.roomId,
        roomName: room.roomName,
        itemIds,
        itemNames,
        characterIds,
        characterNames,
      },
      key: `arrive:${room.roomId}:${[...itemIds].sort().join(',')}:${[...characterIds].sort().join(',')}`,
    },
  ]
}

/// <summary>
/// Ordered list of clause matchers used by deriveGoalCriteria. Each matcher has a regex anchored
/// to a full (trimmed) clause and a build function that turns the match plus resolved
/// character/item/room lookups into zero or more criteria. Matchers are tried in order and the
/// first one whose regex matches the clause wins; if the referenced character/item/room name(s)
/// cannot be resolved against the Gonf's known entities, the clause simply yields no criteria
/// (an unwinnable goal reference does not throw or otherwise fail parsing).
/// </summary>
const GOAL_CLAUSE_MATCHERS = [
  {
    // "give ITEM to CHARACTER"
    regex: /^give\s+(?:the\s+)?(.+?)\s+to\s+(.+)$/i,
    build: (match, { findItemByName, findCharacterByName }) => {
      const item = findItemByName(match[1])
      const character = findCharacterByName(match[2])
      if (!item || !character) {
        return []
      }
      return [
        {
          criterion: {
            type: 'give',
            itemId: item.itemId,
            itemName: item.itemName,
            characterId: character.characterId,
            characterName: character.characterName,
          },
          key: `give:${item.itemId}:${character.characterId}`,
        },
      ]
    },
  },
  {
    // "make it to/get to/reach/arrive at/arrive in/go to (the) ROOM (with CHARACTER)"
    regex: /^(?:make it to|get to|reach|arrive at|arrive in|go to|be in|be at)\s+(?:the\s+)?(.+?)(?:\s+with\s+(.+))?$/i,
    build: (match, { findRoomByName, findCharacterByName }) => {
      const results = []
      const room = findRoomByName(match[1])
      if (room) {
        results.push({ criterion: { type: 'reach', roomId: room.roomId, roomName: room.roomName }, key: `reach:${room.roomId}` })
      }

      const characterNameCandidate = match[2]?.trim()
      if (characterNameCandidate) {
        const character = findCharacterByName(characterNameCandidate)
        if (character) {
          results.push({
            criterion: { type: 'present', characterId: character.characterId, characterName: character.characterName },
            key: `present:${character.characterId}`,
          })
        }
      }

      return results
    },
  },
  {
    // "have CHARACTER with you" - CHARACTER must currently be present (in the same room or
    // following), not merely spoken to at some point. Distinct from the "have (the) ITEM" hold
    // pattern below - this one requires an explicit trailing "with you"/"with me" companion phrase.
    regex: /^have\s+(.+?)\s+with\s+(?:you|me)$/i,
    build: (match, { findCharacterByName }) => {
      const character = findCharacterByName(match[1])
      if (!character) {
        return []
      }
      return [
        {
          criterion: { type: 'present', characterId: character.characterId, characterName: character.characterName },
          key: `present:${character.characterId}`,
        },
      ]
    },
  },
  {
    // "(have) talked/talk/spoken/speak to/with CHARACTER about TOPIC" - topic text is accepted
    // for authoring readability but is not separately tracked; this still just requires having
    // spoken with the named character at least once. Requires an explicit "about ..." suffix so
    // this doesn't shadow the plain "speak with A, B, and C" name-list matcher below.
    regex: /^(?:have\s+)?(?:talked|talk|spoken|speak)\s+(?:to|with)\s+(.+?)\s+about\s+.+$/i,
    build: (match, { findCharacterByName }) => {
      const character = findCharacterByName(match[1])
      if (!character) {
        return []
      }
      return [
        {
          criterion: { type: 'speak', characterId: character.characterId, characterName: character.characterName },
          key: `speak:${character.characterId}`,
        },
      ]
    },
  },
  {
    // "hold/carry/have/obtain/keep/possess (the) ITEM" - live inventory state, can revert
    regex: /^(?:be\s+)?(?:holding|hold|carry|carrying|have|obtain|keep|possess)\s+(?:the\s+)?(.+)$/i,
    build: (match, { findItemByName }) => {
      const item = findItemByName(match[1])
      if (!item) {
        return []
      }
      return [{ criterion: { type: 'hold', itemId: item.itemId, itemName: item.itemName }, key: `hold:${item.itemId}` }]
    },
  },
  {
    // "speak with/talk to A, B, and C"
    regex: /^(?:speak with|talk (?:with|to))\s+(.+)$/i,
    build: (match, { findCharacterByName }) => {
      const names = match[1]
        .split(/,|\band\b/i)
        .map((name) => name.trim())
        .filter(Boolean)

      const results = []
      for (const name of names) {
        const character = findCharacterByName(name)
        if (character) {
          results.push({
            criterion: { type: 'speak', characterId: character.characterId, characterName: character.characterName },
            key: `speak:${character.characterId}`,
          })
        }
      }
      return results
    },
  },
]

/// <summary>
/// Derives trackable win-condition criteria from a freeform "Goal" text authored in the Gonf
/// Generator, e.g. "Speak with Muffy, Sir Faulty, and Reggie, then give the diamond to Karen".
/// The goal text is split into clauses (see splitGoalClauses) and each clause is matched against
/// GOAL_CLAUSE_MATCHERS to produce zero or more criteria of type "speak", "give", "reach", or
/// "hold". If a clause references a character/item/room name that does not exist in this Gonf
/// (e.g. an authored goal mentions "the Alien" or "a guitar" that was never created), that clause
/// is silently skipped: parsing never throws, the goal is simply harder or impossible to win.
/// This is a heuristic parser, not a full NLP solution.
/// </summary>
export function deriveGoalCriteria(goalText, characters, items, rooms) {
  if (!goalText || typeof goalText !== 'string') {
    return []
  }

  const characterList = Array.isArray(characters) ? characters : []
  const itemList = Array.isArray(items) ? items : []
  const roomList = Array.isArray(rooms) ? rooms : []
  const criteria = []
  const seen = new Set()

  const lookups = {
    findCharacterByName: (name) =>
      characterList.find((character) => character.characterName?.toLowerCase() === name?.toLowerCase().trim()),
    findItemByName: (name) => itemList.find((item) => item.itemName?.toLowerCase() === name?.toLowerCase().trim()),
    findRoomByName: (name) => roomList.find((room) => room.roomName?.toLowerCase() === name?.toLowerCase().trim()),
  }

  for (const sentence of splitGoalSentences(goalText)) {
    const arriveResults = tryParseArriveSentence(sentence, lookups)
    if (arriveResults !== null) {
      for (const { criterion, key } of arriveResults) {
        if (!seen.has(key)) {
          seen.add(key)
          criteria.push(criterion)
        }
      }
      continue
    }

    for (const clause of splitGoalClauses(sentence)) {
      for (const matcher of GOAL_CLAUSE_MATCHERS) {
        const match = clause.match(matcher.regex)
        if (!match) {
          continue
        }

        for (const { criterion, key } of matcher.build(match, lookups)) {
          if (!seen.has(key)) {
            seen.add(key)
            criteria.push(criterion)
          }
        }
        break
      }
    }
  }

  return criteria
}

/// <summary>
/// Determines whether every derived goal criterion has been satisfied. "speak", "give", and
/// "reach" criteria are history-based (once achieved they stay achieved), while "hold" criteria
/// are evaluated against the player's *current* inventory, so they revert to unmet if the item is
/// later lost, given away, or taken.
/// spokenCharacterIds: Set/array of characterIds the player has held a conversation with.
/// completedGiveTransfers: array of { itemId, characterId } transfers of an item to a character.
/// visitedRoomIds: Set/array of roomIds the player has visited (defaults to none).
/// currentPlayerItemIds: Set/array of itemIds the player is currently carrying (defaults to none).
/// </summary>
export function isGoalComplete(criteria, spokenCharacterIds, completedGiveTransfers, visitedRoomIds, currentPlayerItemIds, presentCharacterIds, currentRoomId) {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    return false
  }

  const spokenSet = spokenCharacterIds instanceof Set ? spokenCharacterIds : new Set(spokenCharacterIds ?? [])
  const transfers = Array.isArray(completedGiveTransfers) ? completedGiveTransfers : []
  const visitedSet = visitedRoomIds instanceof Set ? visitedRoomIds : new Set(visitedRoomIds ?? [])
  const heldSet = currentPlayerItemIds instanceof Set ? currentPlayerItemIds : new Set(currentPlayerItemIds ?? [])
  const presentSet = presentCharacterIds instanceof Set ? presentCharacterIds : new Set(presentCharacterIds ?? [])

  return criteria.every((criterion) => {
    if (criterion.type === 'speak') {
      return spokenSet.has(criterion.characterId)
    }

    if (criterion.type === 'reach') {
      return visitedSet.has(criterion.roomId)
    }

    if (criterion.type === 'hold') {
      return heldSet.has(criterion.itemId)
    }

    if (criterion.type === 'give') {
      return transfers.some(
        (transfer) => transfer.itemId === criterion.itemId && transfer.characterId === criterion.characterId,
      )
    }

    if (criterion.type === 'present') {
      return presentSet.has(criterion.characterId)
    }

    if (criterion.type === 'arrive') {
      return isArriveCriterionMet(criterion, heldSet, presentSet, currentRoomId)
    }

    return false
  })
}

