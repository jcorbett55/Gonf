import { API_BASE_URL, toNullableNumber } from './shared'
import {
  buildSavedRoomImageUrl,
  createEmptyRoomImage,
  generateRoomPreviewPngDataUrl,
  normalizeRoomImageForState,
  ensureSecretStorageRoom,
  isSystemManagedRoom,
  roomNameById,
} from './rooms'

const CHARACTER_IMAGE_JOB_POLL_DELAY_MS = 2000
const CHARACTER_IMAGE_JOB_MAX_POLLS = 300

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

export function createEmptyCharacterImage() {
  return createEmptyRoomImage()
}

export function normalizeCharacterImageForState(rawImage) {
  return normalizeRoomImageForState(rawImage)
}

export function createCharacterImageCandidate(character, attemptIndex) {
  const generationSeed =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${attemptIndex}`
  const placeholderPreview = generateRoomPreviewPngDataUrl(
    character?.characterName ?? '',
    character?.characterDescription ?? '',
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
  }
}

export function finalizeCharacterImageState(character) {
  const currentImage = normalizeCharacterImageForState(character.image)
  if (!currentImage.previewDataUrl) {
    return currentImage
  }

  return {
    ...currentImage,
    imageStatus: 'finalized',
    finalizedUtc: new Date().toISOString(),
  }
}

async function pollProviderCharacterImageJob(jobId) {
  for (let attempt = 0; attempt < CHARACTER_IMAGE_JOB_MAX_POLLS; attempt += 1) {
    const response = await fetch(`${API_BASE_URL}/api/character-image/generate-jobs/${encodeURIComponent(jobId)}`)
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

    await delay(CHARACTER_IMAGE_JOB_POLL_DELAY_MS)
  }

  return {
    success: false,
    errorCode: 'IMAGE_GENERATION_TIMEOUT',
    errorMessage: 'Image generation is still running. Please try again shortly.',
  }
}

export async function requestProviderCharacterImage(gonfName, character, imageState) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/character-image/generate-jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gonfName: gonfName.trim() || null,
        characterId: character.characterId ?? null,
        characterName: character.characterName,
        characterDescription: character.characterDescription,
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

    return await pollProviderCharacterImageJob(jobId)
  } catch {
    return {
      success: false,
      errorCode: 'IMAGE_GENERATION_FAILED',
      errorMessage: 'Could not reach the image provider.',
    }
  }
}

export function mapCharacterForState(rawCharacter, index, gonfName = '') {
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

  const normalizedImage = normalizeCharacterImageForState(rawCharacter.image)
  const fallbackGeneratingPreview =
    normalizedImage.imageStatus === 'generating' && !normalizedImage.previewDataUrl
      ? generateRoomPreviewPngDataUrl(
          String(rawCharacter.characterName ?? rawCharacter.name ?? ''),
          String(rawCharacter.description ?? rawCharacter.characterDescription ?? ''),
          normalizedImage.generationSeed,
          normalizedImage.attemptIndex,
        )
      : ''
  const resolvedImagePreview =
    normalizedImage.previewDataUrl ||
    fallbackGeneratingPreview ||
    (normalizedImage.imageStatus === 'finalized'
      ? buildSavedRoomImageUrl(gonfName, normalizedImage)
      : '')

  return {
    characterId: Number(rawCharacter.characterId ?? rawCharacter.id ?? index + 1),
    characterName: String(rawCharacter.characterName ?? rawCharacter.name ?? ''),
    characterDescription: String(rawCharacter.description ?? rawCharacter.characterDescription ?? ''),
    characterLocation: characterLocation === null || characterLocation === undefined ? '' : String(characterLocation),
    characterWanderer: Boolean(rawCharacter.wanderer ?? false),
    characterContains,
    image: {
      ...normalizedImage,
      previewDataUrl: resolvedImagePreview,
    },
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
  const existingCharacter = editingCharacterId === null
    ? null
    : currentCharacters.find((character) => character.characterId === nextCharacterId)

  const savedCharacter = {
    characterId: nextCharacterId,
    characterName: characterForm.characterName.trim(),
    characterDescription: characterForm.characterDescription.trim(),
    characterLocation: String(characterLocationId),
    characterWanderer: Boolean(characterForm.characterWanderer),
    characterContains: selectedContains,
    image: existingCharacter?.image ?? createEmptyCharacterImage(),
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
