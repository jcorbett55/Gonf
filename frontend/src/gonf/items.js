import { API_BASE_URL, DOTNET_DECIMAL_MAX, toNullableNumber } from './shared'
import {
  createEmptyRoomImage,
  generateRoomPreviewPngDataUrl,
  normalizeRoomImageForState,
  roomNameById,
} from './rooms'

const ITEM_IMAGE_JOB_POLL_DELAY_MS = 2000
const ITEM_IMAGE_JOB_MAX_POLLS = 300

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

export function createEmptyItemImage() {
  return createEmptyRoomImage()
}

export function normalizeItemImageForState(rawImage) {
  return normalizeRoomImageForState(rawImage)
}

export function createItemImageCandidate(item, attemptIndex) {
  const generationSeed =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${attemptIndex}`
  const placeholderPreview = generateRoomPreviewPngDataUrl(
    item?.itemName ?? '',
    item?.itemDescription ?? '',
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

export function finalizeItemImageState(item) {
  const currentImage = normalizeItemImageForState(item.image)
  if (!currentImage.previewDataUrl) {
    return currentImage
  }

  return {
    ...currentImage,
    imageStatus: 'finalized',
    finalizedUtc: new Date().toISOString(),
  }
}

async function pollProviderItemImageJob(jobId) {
  for (let attempt = 0; attempt < ITEM_IMAGE_JOB_MAX_POLLS; attempt += 1) {
    const response = await fetch(`${API_BASE_URL}/api/item-image/generate-jobs/${encodeURIComponent(jobId)}`)
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

    await delay(ITEM_IMAGE_JOB_POLL_DELAY_MS)
  }

  return {
    success: false,
    errorCode: 'IMAGE_GENERATION_TIMEOUT',
    errorMessage: 'Image generation is still running. Please try again shortly.',
  }
}

export async function requestProviderItemImage(gonfName, item, imageState) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/item-image/generate-jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gonfName: gonfName.trim() || null,
        itemId: item.itemId ?? null,
        itemName: item.itemName,
        itemDescription: item.itemDescription,
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

    return await pollProviderItemImageJob(jobId)
  } catch {
    return {
      success: false,
      errorCode: 'IMAGE_GENERATION_FAILED',
      errorMessage: 'Could not reach the image provider.',
    }
  }
}

export function createEmptyItemForm() {
  return {
    itemId: null,
    itemName: '',
    itemWeight: '',
    itemDescription: '',
    itemValue: '',
    canHoldItems: false,
    canBeCarried: false,
    itemLocation: '',
    itemContents: [],
  }
}

export function normalizeOptionalNumericForState(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return ''
  }

  const numericValue = Number(rawValue)
  return Number.isFinite(numericValue) ? numericValue : ''
}

export function mapItemForState(rawItem, index) {
  if (!rawItem || typeof rawItem !== 'object') {
    return null
  }

  const itemLocation = rawItem.location ?? rawItem.itemLocation ?? rawItem.roomId ?? ''
  const contentsSource = Array.isArray(rawItem.contents) ? rawItem.contents : []

  const itemContents = contentsSource
    .map((content) => {
      if (content === null || content === undefined) {
        return null
      }

      if (typeof content === 'object') {
        const nestedId = content.itemId ?? content.id
        return nestedId === null || nestedId === undefined ? null : String(nestedId)
      }

      return String(content)
    })
    .filter(Boolean)

  return {
    itemId: Number(rawItem.itemId ?? rawItem.id ?? index + 1),
    itemName: String(rawItem.itemName ?? rawItem.name ?? ''),
    itemWeight: normalizeOptionalNumericForState(rawItem.itemWeight ?? rawItem.weight),
    itemDescription: String(rawItem.itemDescription ?? rawItem.description ?? ''),
    itemValue: normalizeOptionalNumericForState(rawItem.itemValue ?? rawItem.value),
    canHoldItems: Boolean(rawItem.canHoldItems ?? rawItem.canHold ?? false),
    canBeCarried: Boolean(rawItem.canBeCarried ?? rawItem.canCarry ?? false),
    itemLocation: itemLocation === null || itemLocation === undefined ? '' : String(itemLocation),
    itemContents,
    image: normalizeItemImageForState(rawItem.image),
  }
}

export function getValidatedItemLocation(itemForm, roomsById) {
  const itemLocation = itemForm.itemLocation === '' ? null : toNullableNumber(itemForm.itemLocation)
  if (itemForm.itemLocation !== '' && (itemLocation === null || !roomsById.has(itemLocation))) {
    return { error: 'Selected item room was not found.' }
  }

  return { itemLocation }
}

export function getValidatedNumericValue(rawValue, label) {
  const normalizedValue = rawValue === '' ? null : Number(rawValue)
  if (normalizedValue !== null && Number.isNaN(normalizedValue)) {
    return { error: `${label} must be a number.` }
  }

  if (normalizedValue !== null && !Number.isFinite(normalizedValue)) {
    return { error: `${label} must be a finite number.` }
  }

  if (normalizedValue !== null && Math.abs(normalizedValue) > DOTNET_DECIMAL_MAX) {
    return { error: `${label} is out of supported range.` }
  }

  return { value: normalizedValue }
}

export function getNormalizedContents(itemForm) {
  return Array.isArray(itemForm.itemContents)
    ? Array.from(new Set(itemForm.itemContents.filter(Boolean)))
    : []
}

export function validateContentsSelection(itemForm, selectedContents, currentItems) {
  if (!itemForm.canHoldItems) {
    return null
  }

  const availableItemIds = new Set(currentItems.map((item) => String(item.itemId)))
  const hasInvalidContents = selectedContents.some((itemId) => !availableItemIds.has(itemId))
  return hasInvalidContents ? 'One or more selected contents items are invalid.' : null
}

export function buildItemSaveResult({
  gonfName,
  itemForm,
  roomsById,
  currentItems,
  currentCharacters,
  currentSelectedRoomId,
}) {
  if (!gonfName.trim()) {
    return { error: 'Gonf Name is required before saving items.' }
  }

  if (!itemForm.itemName.trim()) {
    return { error: 'Item Name is required.' }
  }

  const defaultLocation = itemForm.defaultItemLocation ?? ''
  const effectiveLocationValue = itemForm.itemLocation === '' ? defaultLocation : itemForm.itemLocation

  const locationResult = getValidatedItemLocation(
    {
      ...itemForm,
      itemLocation: effectiveLocationValue,
    },
    roomsById,
  )
  if (locationResult.error) {
    return { error: locationResult.error }
  }
  const itemLocation = locationResult.itemLocation

  const weightResult = getValidatedNumericValue(itemForm.itemWeight, 'Item Weight')
  if (weightResult.error) {
    return { error: weightResult.error }
  }
  const itemWeight = weightResult.value

  const valueResult = getValidatedNumericValue(itemForm.itemValue, 'Item Value')
  if (valueResult.error) {
    return { error: valueResult.error }
  }
  const itemValue = valueResult.value

  const selectedContents = getNormalizedContents(itemForm)
  const selectedContentsSet = new Set(selectedContents.map(String))

  const contentsError = validateContentsSelection(itemForm, selectedContents, currentItems)
  if (contentsError) {
    return { error: contentsError }
  }

  const editingItemId = toNullableNumber(itemForm.itemId)
  const nextItemId = editingItemId ?? (Math.max(0, ...currentItems.map((item) => item.itemId)) + 1)
  const existingItemForImage = currentItems.find((item) => item.itemId === nextItemId)
  const savedItem = {
    itemId: nextItemId,
    itemName: itemForm.itemName.trim(),
    itemWeight,
    itemDescription: itemForm.itemDescription.trim(),
    itemValue,
    canHoldItems: Boolean(itemForm.canHoldItems),
    canBeCarried: Boolean(itemForm.canBeCarried),
    itemLocation: itemLocation === null ? '' : String(itemLocation),
    itemContents: itemForm.canHoldItems ? selectedContents : [],
    image: existingItemForImage?.image ?? createEmptyItemImage(),
  }

  const normalizedItems = currentItems.map((item) => {
    if (item.itemId === nextItemId) {
      return item
    }

    const nextContents = Array.isArray(item.itemContents)
      ? item.itemContents.filter((containedId) => !selectedContentsSet.has(String(containedId)))
      : []

    if (selectedContentsSet.has(String(item.itemId))) {
      return {
        ...item,
        itemLocation: '',
        itemContents: nextContents,
      }
    }

    return {
      ...item,
      itemContents: nextContents,
    }
  })

  const nextItems = normalizedItems.some((item) => item.itemId === nextItemId)
    ? normalizedItems.map((item) => (item.itemId === nextItemId ? savedItem : item))
    : [...normalizedItems, savedItem]

  const nextCharacters = currentCharacters.map((character) => {
    if (!Array.isArray(character.characterContains)) {
      return character
    }

    return {
      ...character,
      characterContains: character.characterContains.filter((itemId) => !selectedContentsSet.has(String(itemId))),
    }
  })

  return {
    nextItems,
    nextCharacters,
    nextSelectedRoomId: itemLocation ?? currentSelectedRoomId,
    message: `Saved item ${savedItem.itemName} to ${itemLocation ? roomNameById(roomsById, itemLocation) : 'the Gonf without a room assignment'}.`,
  }
}
