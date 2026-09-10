import {
  API_BASE_URL,
  allDirections,
  floors,
  oppositeDirection,
  planarDirections,
  SYSTEM_MANAGED_ROOMS,
  toNullableNumber,
  isCharacterImageOverlayEligible,
} from './shared'

export function createEmptyForm() {
  return {
    roomId: null,
    roomName: '',
    roomDescription: '',
    roomFloor: '',
    isStartingRoom: false,
    northExit: '',
    eastExit: '',
    southExit: '',
    westExit: '',
    upExit: '',
    downExit: '',
  }
}

export function createEmptyRoomImage() {
  return {
    imageStatus: 'none',
    attemptIndex: 0,
    generationSeed: '',
    generatedUtc: null,
    finalizedUtc: null,
    fileName: '',
    relativePath: '',
    previewDataUrl: '',
    source: 'generated',
  }
}

export function normalizeRoomImageForState(rawImage) {
  if (!rawImage || typeof rawImage !== 'object') {
    return createEmptyRoomImage()
  }

  return {
    imageStatus: String(rawImage.imageStatus ?? 'none'),
    attemptIndex: Number(rawImage.attemptIndex ?? 0),
    generationSeed: String(rawImage.generationSeed ?? ''),
    generatedUtc: rawImage.generatedUtc ?? null,
    finalizedUtc: rawImage.finalizedUtc ?? null,
    fileName: String(rawImage.fileName ?? ''),
    relativePath: String(rawImage.relativePath ?? ''),
    previewDataUrl: String(rawImage.previewDataUrl ?? ''),
    source: String(rawImage.source ?? 'generated'),
  }
}

function hashString(value) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

function includesAnyKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword))
}

export function generateRoomPreviewPngDataUrl(roomName, roomDescription, generationSeed, attemptIndex) {
  const seed = hashString(`${roomName}|${roomDescription}|${generationSeed}|${attemptIndex}`)

  if (typeof document === 'undefined') {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfXcAAAAASUVORK5CYII='
  }

  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 360

  const context = canvas.getContext('2d')
  if (!context) {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfXcAAAAASUVORK5CYII='
  }

  context.fillStyle = '#2b2118'
  context.fillRect(0, 0, canvas.width, canvas.height)

  const wallGradient = context.createLinearGradient(0, 0, canvas.width, 0)
  wallGradient.addColorStop(0, 'rgba(111, 74, 52, 0.94)')
  wallGradient.addColorStop(0.5, 'rgba(138, 94, 68, 0.94)')
  wallGradient.addColorStop(1, 'rgba(110, 76, 56, 0.94)')
  context.fillStyle = wallGradient
  context.fillRect(0, 0, canvas.width, 220)

  const floorGradient = context.createLinearGradient(0, 220, canvas.width, canvas.height)
  floorGradient.addColorStop(0, 'rgba(54, 34, 22, 0.85)')
  floorGradient.addColorStop(1, 'rgba(35, 23, 15, 0.95)')
  context.fillStyle = floorGradient
  context.fillRect(0, 220, canvas.width, 140)

  const description = `${roomName} ${roomDescription}`.toLowerCase()
  const drawDesk = includesAnyKeyword(description, ['desk', 'table', 'study'])
  const drawBookshelves = includesAnyKeyword(description, ['bookshelf', 'bookcase', 'books'])
  const drawWindows = includesAnyKeyword(description, ['window', 'left', 'right'])
  const drawClock = includesAnyKeyword(description, ['clock', 'timepiece'])
  const drawKitchen = includesAnyKeyword(description, ['kitchen', 'stove', 'oven', 'counter', 'sink'])
  const drawHallway = includesAnyKeyword(description, ['hallway', 'portraits', 'corridor'])

  context.strokeStyle = 'rgba(255,255,255,0.12)'
  context.lineWidth = 3
  for (let x = 34; x < canvas.width; x += 98) {
    context.strokeRect(x, 20, 76, 184)
  }

  context.strokeStyle = 'rgba(34, 20, 13, 0.6)'
  context.lineWidth = 2
  for (let y = 236; y < canvas.height; y += 18) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(canvas.width, y + 10)
    context.stroke()
  }

  if (drawWindows) {
    context.fillStyle = 'rgba(220, 244, 255, 0.55)'
    context.fillRect(20, 40, 86, 132)
    context.fillRect(canvas.width - 106, 40, 86, 132)

    context.fillStyle = 'rgba(232, 213, 182, 0.75)'
    context.fillRect(12, 34, 12, 144)
    context.fillRect(canvas.width - 24, 34, 12, 144)
  }

  if (drawBookshelves) {
    context.fillStyle = 'rgba(53, 29, 18, 0.78)'
    context.fillRect(120, 48, 90, 164)
    context.fillRect(canvas.width - 210, 48, 90, 164)

    context.fillStyle = 'rgba(190, 150, 108, 0.95)'
    for (let y = 62; y < 202; y += 26) {
      context.fillRect(126, y, 78, 4)
      context.fillRect(canvas.width - 204, y, 78, 4)
    }
  }

  if (drawDesk) {
    context.fillStyle = 'rgba(75, 41, 24, 0.92)'
    context.fillRect(190, 182, 260, 72)
    context.fillStyle = 'rgba(95, 55, 33, 0.95)'
    context.fillRect(180, 172, 280, 20)
    context.fillStyle = 'rgba(32, 19, 12, 0.7)'
    context.fillRect(206, 192, 42, 52)
    context.fillRect(392, 192, 42, 52)
  }

  if (drawKitchen) {
    context.fillStyle = 'rgba(184, 189, 194, 0.92)'
    context.fillRect(22, 150, 168, 58)
    context.fillRect(canvas.width - 190, 150, 168, 58)

    context.fillStyle = 'rgba(70, 74, 78, 0.95)'
    context.fillRect(canvas.width / 2 - 34, 130, 68, 90)
    context.fillStyle = 'rgba(227, 95, 61, 0.9)'
    context.fillRect(canvas.width / 2 - 18, 146, 36, 14)
    context.fillStyle = 'rgba(145, 84, 46, 0.9)'
    context.fillRect(178, 172, 284, 16)
  }

  if (drawHallway) {
    context.fillStyle = 'rgba(206, 187, 160, 0.92)'
    for (let x = 56; x < canvas.width - 40; x += 120) {
      context.fillRect(x, 66, 64, 54)
      context.strokeStyle = 'rgba(70, 43, 25, 0.82)'
      context.lineWidth = 4
      context.strokeRect(x, 66, 64, 54)
    }
  }

  if (drawClock) {
    context.fillStyle = 'rgba(246, 229, 186, 0.9)'
    context.beginPath()
    context.arc(canvas.width / 2, 88, 28, 0, Math.PI * 2)
    context.fill()
    context.strokeStyle = 'rgba(70, 44, 23, 0.95)'
    context.lineWidth = 3
    context.stroke()
  }

  context.fillStyle = 'rgba(255,255,255,0.14)'
  for (let i = 0; i < 4; i += 1) {
    const x = ((seed + i * 71) % canvas.width)
    const y = ((seed + i * 97) % 220)
    const width = 45 + ((seed + i * 29) % 100)
    const height = 20 + ((seed + i * 17) % 52)
    context.fillRect(x, y, width, height)
  }

  return canvas.toDataURL('image/png')
}

export function createRoomImageCandidate(room, attemptIndex) {
  const generationSeed = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const placeholderPreview = generateRoomPreviewPngDataUrl(
    room?.roomName ?? '',
    room?.roomDescription ?? '',
    generationSeed,
    attemptIndex,
  )

  return {
    imageStatus: 'generating',
    attemptIndex,
    generationSeed,
    generatedUtc: new Date().toISOString(),
    finalizedUtc: null,
    fileName: '',
    relativePath: '',
    previewDataUrl: placeholderPreview,
    source: 'generated',
  }
}

export function finalizeRoomImageState(room) {
  const currentImage = normalizeRoomImageForState(room.image)
  if (!currentImage.previewDataUrl) {
    return currentImage
  }

  return {
    ...currentImage,
    imageStatus: 'finalized',
    finalizedUtc: new Date().toISOString(),
  }
}

const ROOM_IMAGE_JOB_POLL_DELAY_MS = 2000
const ROOM_IMAGE_JOB_MAX_POLLS = 300

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function buildProviderError(payload, fallbackMessage) {
  const error = payload?.errors?.[0]

  return {
    success: false,
    errorCode: error?.code ?? payload?.data?.errorCode ?? 'IMAGE_GENERATION_FAILED',
    errorMessage: error?.message ?? payload?.data?.errorMessage ?? fallbackMessage,
  }
}

function buildProviderSuccess(payload) {
  const previewDataUrl = payload?.data?.previewDataUrl
  if (typeof previewDataUrl !== 'string' || !previewDataUrl.startsWith('data:image/')) {
    return {
      success: false,
      errorCode: 'IMAGE_GENERATION_FAILED',
      errorMessage: 'Image provider returned an invalid image payload.',
    }
  }

  return {
    success: true,
    previewDataUrl,
  }
}

async function pollProviderRoomImageJob(jobId) {
  for (let attempt = 0; attempt < ROOM_IMAGE_JOB_MAX_POLLS; attempt += 1) {
    const response = await fetch(`${API_BASE_URL}/api/room-image/generate-jobs/${encodeURIComponent(jobId)}`)
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      return buildProviderError(payload, 'Image generation failed.')
    }

    const status = String(payload?.data?.status ?? '')
    if (status === 'completed') {
      return buildProviderSuccess(payload)
    }

    if (status === 'failed') {
      return buildProviderError(payload, 'Image generation failed.')
    }

    if (status !== 'queued' && status !== 'processing') {
      return {
        success: false,
        errorCode: 'IMAGE_GENERATION_FAILED',
        errorMessage: 'Image generation returned an invalid job status.',
      }
    }

    await delay(ROOM_IMAGE_JOB_POLL_DELAY_MS)
  }

  return {
    success: false,
    errorCode: 'IMAGE_GENERATION_TIMEOUT',
    errorMessage: 'Image generation is still running. Please try again shortly.',
  }
}

export async function requestProviderRoomImage(gonfName, room, imageState) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/room-image/generate-jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gonfName: gonfName.trim() || null,
        roomId: room.roomId ?? null,
        roomName: room.roomName,
        roomDescription: room.roomDescription,
        attemptIndex: imageState.attemptIndex,
        generationSeed: imageState.generationSeed,
      }),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      return buildProviderError(payload, 'Image generation failed.')
    }

    if (typeof payload?.data?.previewDataUrl === 'string') {
      return buildProviderSuccess(payload)
    }

    const jobId = payload?.data?.jobId
    if (typeof jobId !== 'string' || jobId.length === 0) {
      return {
        success: false,
        errorCode: 'IMAGE_GENERATION_FAILED',
        errorMessage: 'Image generation job could not be started.',
      }
    }

    return await pollProviderRoomImageJob(jobId)
  } catch {
    return {
      success: false,
      errorCode: 'IMAGE_GENERATION_FAILED',
      errorMessage: 'Could not reach the image provider.',
    }
  }
}

export function buildSavedRoomImageUrl(gonfName, image) {
  if (!gonfName || !image?.fileName) {
    return ''
  }

  return `${API_BASE_URL}/api/gonf/image/${encodeURIComponent(gonfName)}/${encodeURIComponent(image.fileName)}`
}

export function isProviderNotConfiguredError(providerResult) {
  return providerResult?.errorCode === 'IMAGE_PROVIDER_NOT_CONFIGURED'
}

export function isProviderTimeoutError(providerResult) {
  return providerResult?.errorCode === 'IMAGE_GENERATION_TIMEOUT'
}

export function getTargetFloor(selectedFloor, direction) {
  if (selectedFloor === null || direction === '') {
    return null
  }

  if (direction === 'up') {
    const next = selectedFloor + 1
    const target = next === 0 ? selectedFloor + 2 : next
    return floors.includes(target) ? target : null
  }

  const next = selectedFloor - 1
  const target = next === 0 ? selectedFloor - 2 : next
  return floors.includes(target) ? target : null
}

export function roomNameById(roomsById, roomId) {
  if (!roomId) {
    return 'None'
  }

  return roomsById.get(roomId)?.roomName ?? `Room ${roomId}`
}

export function buildFloorConnections(floorRooms) {
  const lineKeys = new Set()
  const lines = []
  const floorRoomMap = new Map(floorRooms.map((room) => [room.roomId, room]))

  for (const room of floorRooms) {
    for (const direction of planarDirections) {
      const targetId = room.exits[direction]
      if (!targetId) {
        continue
      }

      const targetRoom = floorRoomMap.get(targetId)
      if (!targetRoom) {
        continue
      }

      const low = Math.min(room.roomId, targetRoom.roomId)
      const high = Math.max(room.roomId, targetRoom.roomId)
      const key = `${low}-${high}`

      if (lineKeys.has(key)) {
        continue
      }

      lineKeys.add(key)
      lines.push({ from: room, to: targetRoom })
    }
  }

  return lines
}

export function getRoomCenter(room, gridColumns, gridRows) {
  return {
    x: ((room.x + 0.5) / gridColumns) * 100,
    y: ((room.y + 0.5) / gridRows) * 100,
  }
}

function findNearestOpenSlot(occupied, startX, startY) {
  const startKey = `${startX},${startY}`
  if (!occupied.has(startKey)) {
    return { x: startX, y: startY }
  }

  for (let radius = 1; radius <= 20; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        const x = startX + dx
        const y = startY + dy
        const key = `${x},${y}`
        if (!occupied.has(key)) {
          return { x, y }
        }
      }
    }
  }

  return { x: startX, y: startY }
}

function queueDirectionalNeighbors(room, roomById, placed, queue, slot, directionOffset) {
  for (const direction of planarDirections) {
    const targetId = room.exits[direction]
    if (!targetId || placed.has(targetId) || !roomById.has(targetId)) {
      continue
    }

    const delta = directionOffset[direction]
    queue.push({ roomId: targetId, x: slot.x + delta.x, y: slot.y + delta.y })
  }
}

function placeDirectionalComponent(seedRoomId, startX, roomById, occupied, placed, directionOffset) {
  const queue = [{ roomId: seedRoomId, x: startX, y: 0 }]

  while (queue.length > 0) {
    const next = queue.shift()
    if (!next || placed.has(next.roomId)) {
      continue
    }

    const room = roomById.get(next.roomId)
    if (!room) {
      continue
    }

    const slot = findNearestOpenSlot(occupied, next.x, next.y)
    occupied.add(`${slot.x},${slot.y}`)
    placed.set(room.roomId, slot)

    queueDirectionalNeighbors(room, roomById, placed, queue, slot, directionOffset)
  }

  return startX + 6
}

export function buildDirectionalFloorLayout(floorRooms) {
  if (floorRooms.length === 0) {
    return []
  }

  const directionOffset = {
    north: { x: 0, y: -1 },
    east: { x: 1, y: 0 },
    south: { x: 0, y: 1 },
    west: { x: -1, y: 0 },
  }

  const roomById = new Map(floorRooms.map((room) => [room.roomId, room]))
  const sortedRooms = [...floorRooms].sort((a, b) => a.roomId - b.roomId)
  const placed = new Map()
  const occupied = new Set()
  let componentStartX = 0

  for (const seed of sortedRooms) {
    if (placed.has(seed.roomId)) {
      continue
    }

    componentStartX = placeDirectionalComponent(
      seed.roomId,
      componentStartX,
      roomById,
      occupied,
      placed,
      directionOffset,
    )
  }

  const placedValues = Array.from(placed.values())
  const minX = Math.min(...placedValues.map((point) => point.x))
  const minY = Math.min(...placedValues.map((point) => point.y))

  return sortedRooms.map((room, index) => {
    const fallback = { x: index % 5, y: Math.floor(index / 5) }
    const position = placed.get(room.roomId) ?? fallback
    return {
      ...room,
      x: position.x - minX,
      y: position.y - minY,
    }
  })
}

export function applyReciprocalLinks(rooms, savedRoom) {
  const nextRooms = rooms.map((room) => ({ ...room, exits: { ...room.exits } }))
  const savedRoomCopy = { ...savedRoom, exits: { ...savedRoom.exits } }
  const existingIndex = nextRooms.findIndex((room) => room.roomId === savedRoomCopy.roomId)

  if (existingIndex >= 0) {
    nextRooms[existingIndex] = savedRoomCopy
  } else {
    nextRooms.push(savedRoomCopy)
  }

  for (const room of nextRooms) {
    if (room.roomId === savedRoomCopy.roomId) {
      continue
    }

    for (const direction of allDirections) {
      if (room.exits[direction] === savedRoomCopy.roomId) {
        room.exits[direction] = null
      }
    }
  }

  for (const direction of allDirections) {
    const targetId = savedRoomCopy.exits[direction]
    if (!targetId) {
      continue
    }

    const targetRoom = nextRooms.find((room) => room.roomId === targetId)
    if (!targetRoom) {
      continue
    }

    const reverseDirection = oppositeDirection[direction]
    targetRoom.exits[reverseDirection] = savedRoomCopy.roomId
  }

  return nextRooms
}

export function normalizeRoomName(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function getSystemManagedRoomDefinitionByName(roomName) {
  return SYSTEM_MANAGED_ROOMS.find((room) => normalizeRoomName(room.name) === normalizeRoomName(roomName)) ?? null
}

export function getSystemManagedRoomDefinitionByKey(roomKey) {
  return SYSTEM_MANAGED_ROOMS.find((room) => room.key === roomKey) ?? null
}

export function mapRawRoomExits(rawRoom) {
  return {
    north: toNullableNumber(rawRoom.exits?.north ?? rawRoom.northExit),
    east: toNullableNumber(rawRoom.exits?.east ?? rawRoom.eastExit),
    south: toNullableNumber(rawRoom.exits?.south ?? rawRoom.southExit),
    west: toNullableNumber(rawRoom.exits?.west ?? rawRoom.westExit),
    up: toNullableNumber(rawRoom.exits?.up ?? rawRoom.upExit),
    down: toNullableNumber(rawRoom.exits?.down ?? rawRoom.downExit),
  }
}

export function hasNoExits(exits) {
  if (!exits) {
    return true
  }

  return allDirections.every((direction) => exits[direction] === null)
}

export function getLegacySystemManagedRoomDefinition(room) {
  const matchedDefinition = getSystemManagedRoomDefinitionByName(room?.roomName)
  if (!matchedDefinition) {
    return null
  }

  return Number(room?.roomFloor) === matchedDefinition.floor ? matchedDefinition : null
}

export function getSystemManagedRoomDefinition(room) {
  if (room?.systemManagedRoomKey) {
    return getSystemManagedRoomDefinitionByKey(room.systemManagedRoomKey)
  }

  if (room?.isSecretStorage) {
    return getSystemManagedRoomDefinitionByKey('secret-storage')
  }

  return null
}

export function isSystemManagedRoom(room) {
  return Boolean(getSystemManagedRoomDefinition(room))
}

export function normalizeSystemManagedRoom(room, definition) {
  return {
    ...room,
    systemManagedRoomKey: definition.key,
    isSecretStorage: definition.key === 'secret-storage',
    roomName: definition.name,
    roomDescription: definition.description,
    roomFloor: definition.floor,
    exits: {
      north: null,
      east: null,
      south: null,
      west: null,
      up: null,
      down: null,
    },
  }
}

export function createSecretStorageRoom(roomId) {
  const secretStorageDefinition = getSystemManagedRoomDefinitionByKey('secret-storage')

  return normalizeSystemManagedRoom({
    roomId,
    roomName: secretStorageDefinition.name,
    roomDescription: secretStorageDefinition.description,
    roomFloor: secretStorageDefinition.floor,
    image: createEmptyRoomImage(),
    systemManagedRoomKey: secretStorageDefinition.key,
    isSecretStorage: true,
    exits: {
      north: null,
      east: null,
      south: null,
      west: null,
      up: null,
      down: null,
    },
  }, secretStorageDefinition)
}

export function ensureSecretStorageRoom(rooms) {
  const existing = rooms.find((room) => getSystemManagedRoomDefinition(room)?.key === 'secret-storage')
  if (existing) {
    const normalizedExisting = normalizeSystemManagedRoom(
      existing,
      getSystemManagedRoomDefinitionByKey('secret-storage'),
    )

    const nextRooms = rooms.map((room) =>
      room.roomId === existing.roomId ? normalizedExisting : room,
    )
    return {
      rooms: stripSecretStorageExits(nextRooms),
      roomId: existing.roomId,
      created: false,
    }
  }

  const nextRoomId = Math.max(0, ...rooms.map((room) => room.roomId)) + 1
  const nextRooms = [...rooms, createSecretStorageRoom(nextRoomId)]
  return {
    rooms: stripSecretStorageExits(nextRooms),
    roomId: nextRoomId,
    created: true,
  }
}

export function stripSecretStorageExits(rooms) {
  const secretStorageRoom = rooms.find((room) => getSystemManagedRoomDefinition(room)?.key === 'secret-storage')
  if (!secretStorageRoom) {
    return rooms
  }

  const secretRoomId = secretStorageRoom.roomId

  return rooms.map((room) => {
    if (room.roomId === secretRoomId) {
      return normalizeSystemManagedRoom(room, getSystemManagedRoomDefinitionByKey('secret-storage'))
    }

    const nextExits = { ...room.exits }
    for (const direction of allDirections) {
      if (nextExits[direction] === secretRoomId) {
        nextExits[direction] = null
      }
    }

    return {
      ...room,
      exits: nextExits,
    }
  })
}

export function mapRoomForState(rawRoom, gonfName) {
  if (!rawRoom || typeof rawRoom !== 'object') {
    return null
  }

  const exits = mapRawRoomExits(rawRoom)
  const explicitSystemManagedDefinition = getSystemManagedRoomDefinition(rawRoom)
  const legacySystemManagedDefinition = getLegacySystemManagedRoomDefinition(rawRoom)
  const normalizedImage = normalizeRoomImageForState(rawRoom.image)
  const fallbackGeneratingPreview =
    normalizedImage.imageStatus === 'generating' && !normalizedImage.previewDataUrl
      ? generateRoomPreviewPngDataUrl(
          String(rawRoom.roomName ?? ''),
          String(rawRoom.roomDescription ?? ''),
          normalizedImage.generationSeed,
          normalizedImage.attemptIndex,
        )
      : ''
  const resolvedImagePreview =
    normalizedImage.previewDataUrl ||
    fallbackGeneratingPreview ||
    (normalizedImage.imageStatus === 'finalized' ? buildSavedRoomImageUrl(gonfName, normalizedImage) : '')

  const mappedRoom = {
    roomId: Number(rawRoom.roomId),
    roomName: String(rawRoom.roomName ?? ''),
    roomDescription: String(rawRoom.roomDescription ?? ''),
    roomFloor: Number(rawRoom.roomFloor),
    image: {
      ...normalizedImage,
      previewDataUrl: resolvedImagePreview,
    },
    systemManagedRoomKey:
      explicitSystemManagedDefinition?.key ??
      (legacySystemManagedDefinition && hasNoExits(exits) ? legacySystemManagedDefinition.key : null),
    isSecretStorage:
      explicitSystemManagedDefinition?.key === 'secret-storage' ||
      (legacySystemManagedDefinition?.key === 'secret-storage' && hasNoExits(exits)),
    isStartingRoom: Boolean(rawRoom.isStartingRoom),
    exits,
  }

  const mappedDefinition = getSystemManagedRoomDefinition(mappedRoom)
  return mappedDefinition ? normalizeSystemManagedRoom(mappedRoom, mappedDefinition) : mappedRoom
}

export function canEditRoom(room) {
  return room && !isSystemManagedRoom(room)
}

export function roomToFormState(room) {
  return {
    roomId: room.roomId,
    roomName: room.roomName,
    roomDescription: room.roomDescription,
    roomFloor: String(room.roomFloor),
    isStartingRoom: Boolean(room.isStartingRoom),
    northExit: room.exits.north ? String(room.exits.north) : '',
    eastExit: room.exits.east ? String(room.exits.east) : '',
    southExit: room.exits.south ? String(room.exits.south) : '',
    westExit: room.exits.west ? String(room.exits.west) : '',
    upExit: room.exits.up ? String(room.exits.up) : '',
    downExit: room.exits.down ? String(room.exits.down) : '',
  }
}

function itemNameById(itemsById, itemId) {
  if (!itemId) {
    return 'Unknown Item'
  }

  return itemsById.get(String(itemId))?.itemName ?? `Item ${itemId}`
}

export function renderSelectedRoomPanel({
  selectedRoomPanelMode,
  selectedRoom,
  selectedRoomItems,
  selectedRoomCharacters,
  roomsById,
  itemsById,
  onRetryRoomImage,
  onUploadRoomImage,
  onConfirmRoomImage,
  onRetryCharacterImage,
  onUploadCharacterImage,
  onConfirmCharacterImage,
  onSelectItemForEdit,
  onSelectContainedItem,
  onSelectCharacterForEdit,
}) {
  const isGeneratingImage = selectedRoom?.image?.imageStatus === 'generating'
  const overlayCharacters = (selectedRoomCharacters ?? []).filter((character) =>
    isCharacterImageOverlayEligible(character.image),
  )
  const MAX_VISIBLE_ROOM_OVERLAYS = 4
  const visibleOverlayCharacters = overlayCharacters.slice(0, MAX_VISIBLE_ROOM_OVERLAYS)
  const hiddenOverlayCount = overlayCharacters.length - visibleOverlayCharacters.length

  if (selectedRoomPanelMode === 'items') {
    return (
      <>
        <h3>{selectedRoom.roomName} Items</h3>
        {selectedRoomItems.length === 0 ? (
          <p className="muted">No items are currently assigned to this room.</p>
        ) : (
          <ul className="gg-item-list">
            {selectedRoomItems.map((item) => (
              <li key={item.itemId}>
                <button
                  type="button"
                  className="gg-item-select-button"
                  onClick={() => onSelectItemForEdit(item)}
                  aria-label={`Edit ${item.itemName}`}
                >
                  <strong>{item.itemName}</strong>
                  <span>{item.itemDescription || 'No description.'}</span>
                </button>
                {Array.isArray(item.itemContents) && item.itemContents.length > 0 && (
                  <div className="gg-item-contents-block">
                    <p className="gg-item-contents-title">Contents</p>
                    <ul className="gg-item-contents-list">
                      {item.itemContents.map((contentItemId) => (
                        <li key={`${item.itemId}-${contentItemId}`}>
                          <button
                            type="button"
                            className="gg-item-contents-button"
                            onClick={() => onSelectContainedItem(String(contentItemId))}
                            aria-label={`Edit contained item ${itemNameById(itemsById, contentItemId)}`}
                          >
                            {itemNameById(itemsById, contentItemId)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </>
    )
  }

  if (selectedRoomPanelMode === 'characters') {
    return (
      <>
        <h3>{selectedRoom.roomName} Characters</h3>
        {selectedRoomCharacters.length === 0 ? (
          <p className="muted">No characters are currently assigned to this room.</p>
        ) : (
          <ul className="gg-item-list">
            {selectedRoomCharacters.map((character) => (
              <li key={character.characterId}>
                <button
                  type="button"
                  className="gg-item-select-button"
                  onClick={() => onSelectCharacterForEdit(character)}
                  aria-label={`Edit ${character.characterName}`}
                >
                  <strong>{character.characterName}</strong>
                  <span>{character.characterDescription || 'No description.'}</span>
                </button>
                <section className="gg-room-image-preview" aria-label={`Character image preview for ${character.characterName}`}>
                  <div className={`gg-room-image-frame ${character.image?.imageStatus === 'generating' ? 'is-generating' : ''}`}>
                    {character.image?.previewDataUrl ? (
                      <img
                        src={character.image.previewDataUrl}
                        alt={`Generated character preview for ${character.characterName}`}
                      />
                    ) : (
                      <div className="gg-room-image-empty">No generated image yet.</div>
                    )}
                    {character.image?.imageStatus === 'generating' && (
                      <div className="gg-room-image-badge" aria-live="polite">
                        Generating final render...
                      </div>
                    )}
                  </div>

                  <div className="gg-room-image-actions">
                    <label className="gg-room-image-upload" title="Upload image (.png or .gif with a transparent background for map overlays)">
                      <span aria-hidden="true">⬆</span>
                      <input
                        type="file"
                        accept=".png,.gif,image/png,image/gif"
                        className="gg-room-image-upload-input"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          event.target.value = ''
                          if (file) {
                            onUploadCharacterImage(character, file)
                          }
                        }}
                        aria-label={`Upload image for ${character.characterName}`}
                      />
                    </label>
                    <button
                      type="button"
                      className="gg-room-image-retry"
                      onClick={() => onRetryCharacterImage(character)}
                      aria-label={`Generate image for ${character.characterName}`}
                      title="Generate image"
                    >
                      <span aria-hidden="true">↻</span>
                    </button>
                    <button
                      type="button"
                      className="gg-room-image-confirm"
                      onClick={() => onConfirmCharacterImage(character)}
                      aria-label={`Confirm image for ${character.characterName}`}
                      title="Confirm image"
                    >
                      <span aria-hidden="true">✓</span>
                    </button>
                  </div>

                  <p className="gg-room-image-status">Image status: {character.image?.imageStatus ?? 'none'}</p>
                  <p className="gg-room-image-hint">Uploads must be .png or .gif with a transparent background for map overlays.</p>
                </section>
                {Array.isArray(character.characterContains) && character.characterContains.length > 0 && (
                  <div className="gg-item-contents-block">
                    <p className="gg-item-contents-title">Carries</p>
                    <ul className="gg-item-contents-list">
                      {character.characterContains.map((contentItemId) => (
                        <li key={`${character.characterId}-${contentItemId}`}>
                          <button
                            type="button"
                            className="gg-item-contents-button"
                            onClick={() => onSelectContainedItem(String(contentItemId))}
                            aria-label={`Edit carried item ${itemNameById(itemsById, contentItemId)}`}
                          >
                            {itemNameById(itemsById, contentItemId)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </>
    )
  }

  return (
    <>
      <h3>{selectedRoom.roomName}</h3>
      <section className="gg-room-image-preview" aria-label="Room image preview">
        <div className={`gg-room-image-frame ${isGeneratingImage ? 'is-generating' : ''}`}>
          {selectedRoom.image?.previewDataUrl ? (
            <img src={selectedRoom.image.previewDataUrl} alt={`Generated room preview for ${selectedRoom.roomName}`} />
          ) : (
            <div className="gg-room-image-empty">No generated image yet.</div>
          )}
          {overlayCharacters.length > 0 && (
            <div className="gg-room-character-overlays">
              {visibleOverlayCharacters.map((character) => (
                <div key={character.characterId} className="gg-room-character-overlay-frame">
                  <img
                    className="gg-room-character-overlay"
                    src={character.image.previewDataUrl}
                    alt={`${character.characterName} in ${selectedRoom.roomName}`}
                    title={character.characterName}
                  />
                </div>
              ))}
              {hiddenOverlayCount > 0 && (
                <div
                  className="gg-room-character-overlay-more"
                  title={`${hiddenOverlayCount} more character${hiddenOverlayCount === 1 ? '' : 's'} in this room`}
                  aria-label={`${hiddenOverlayCount} more character${hiddenOverlayCount === 1 ? '' : 's'} in this room`}
                >
                  +{hiddenOverlayCount}
                </div>
              )}
            </div>
          )}
          {isGeneratingImage && (
            <div className="gg-room-image-badge" aria-live="polite">
              Generating final render...
            </div>
          )}
        </div>

        <div className="gg-room-image-actions">
          <label className="gg-room-image-upload" title="Upload image">
            <span aria-hidden="true">⬆</span>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.gif,image/png,image/jpeg,image/gif"
              className="gg-room-image-upload-input"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) {
                  onUploadRoomImage(selectedRoom, file)
                }
              }}
              aria-label={`Upload image for ${selectedRoom.roomName}`}
            />
          </label>
          <button
            type="button"
            className="gg-room-image-retry"
            onClick={() => onRetryRoomImage(selectedRoom)}
            aria-label={`Generate image for ${selectedRoom.roomName}`}
            title="Generate image"
          >
            <span aria-hidden="true">↻</span>
          </button>
          <button
            type="button"
            className="gg-room-image-confirm"
            onClick={() => onConfirmRoomImage(selectedRoom)}
            aria-label={`Confirm image for ${selectedRoom.roomName}`}
            title="Confirm image"
          >
            <span aria-hidden="true">✓</span>
          </button>
        </div>

        <p className="gg-room-image-status">Image status: {selectedRoom.image?.imageStatus ?? 'none'}</p>
      </section>
      <p>{selectedRoom.roomDescription || 'No description.'}</p>
      <ul>
        <li>North: {roomNameById(roomsById, selectedRoom.exits.north)}</li>
        <li>East: {roomNameById(roomsById, selectedRoom.exits.east)}</li>
        <li>South: {roomNameById(roomsById, selectedRoom.exits.south)}</li>
        <li>West: {roomNameById(roomsById, selectedRoom.exits.west)}</li>
        <li>Up: {roomNameById(roomsById, selectedRoom.exits.up)}</li>
        <li>Down: {roomNameById(roomsById, selectedRoom.exits.down)}</li>
      </ul>
    </>
  )
}
