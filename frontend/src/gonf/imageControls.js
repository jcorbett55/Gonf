import { API_BASE_URL } from './shared'

export const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024
export const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif']
export const ALLOWED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif']

const IMAGE_JOB_POLL_DELAY_MS = 2000
const IMAGE_JOB_MAX_POLLS = 300

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function getFileExtension(fileName) {
  const lastDotIndex = fileName.lastIndexOf('.')
  return lastDotIndex >= 0 ? fileName.slice(lastDotIndex).toLowerCase() : ''
}

export function validateImageFileForUpload(file) {
  if (!file) {
    return 'Please choose an image file to continue.'
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return 'Image file must be 2MB or smaller.'
  }

  const extension = getFileExtension(file.name ?? '')
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(extension)) {
    return 'Image file must be a .png, .jpg, .jpeg, or .gif file.'
  }

  if (file.type && !ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
    return 'Image file type is not supported.'
  }

  return null
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

async function pollProviderImageJob(entityType, jobId) {
  for (let attempt = 0; attempt < IMAGE_JOB_MAX_POLLS; attempt += 1) {
    const response = await fetch(`${API_BASE_URL}/api/${entityType}-image/generate-jobs/${encodeURIComponent(jobId)}`)
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

    await delay(IMAGE_JOB_POLL_DELAY_MS)
  }

  return {
    success: false,
    errorCode: 'IMAGE_GENERATION_TIMEOUT',
    errorMessage: 'Image generation is still running. Please try again shortly.',
  }
}

/**
 * Queues an async image-generation job for the given entity type ('room' | 'character' | 'item')
 * and polls until it completes, fails, or times out.
 */
export async function requestProviderEntityImage(entityType, gonfName, entityIdKey, entityNameKey, entityDescriptionKey, entity, imageState) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/${entityType}-image/generate-jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gonfName: gonfName.trim() || null,
        [entityIdKey]: entity[entityIdKey] ?? null,
        [entityNameKey]: entity[entityNameKey],
        [entityDescriptionKey]: entity[entityDescriptionKey],
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

    return await pollProviderImageJob(entityType, jobId)
  } catch {
    return {
      success: false,
      errorCode: 'IMAGE_GENERATION_FAILED',
      errorMessage: 'Could not reach the image provider.',
    }
  }
}

/**
 * Uploads a user-provided image file for the given entity type ('room' | 'character' | 'item').
 */
export async function uploadEntityImage(entityType, file, attemptIndex, generationSeed) {
  const validationError = validateImageFileForUpload(file)
  if (validationError) {
    return {
      success: false,
      errorCode: 'INVALID_IMAGE_FILE',
      errorMessage: validationError,
    }
  }

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('attemptIndex', String(attemptIndex))
    formData.append('generationSeed', generationSeed ?? '')

    const response = await fetch(`${API_BASE_URL}/api/${entityType}-image/upload`, {
      method: 'POST',
      body: formData,
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      return buildProviderError(payload, 'Image upload failed.')
    }

    return buildProviderSuccess(payload)
  } catch {
    return {
      success: false,
      errorCode: 'IMAGE_UPLOAD_FAILED',
      errorMessage: 'Could not reach the server to upload the image.',
    }
  }
}
