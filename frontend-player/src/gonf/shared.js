export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5131'
export const planarDirections = ['north', 'east', 'south', 'west']
export const allDirections = ['north', 'east', 'south', 'west', 'up', 'down']

export const directionLabels = {
  north: 'North',
  east: 'East',
  south: 'South',
  west: 'West',
  up: 'Up',
  down: 'Down',
}

const OVERLAY_ELIGIBLE_IMAGE_EXTENSIONS = ['.png', '.gif']

export function isCharacterImageOverlayEligible(image) {
  if (!image || image.imageStatus !== 'finalized' || !image.previewDataUrl) {
    return false
  }

  const fileName = String(image.fileName ?? '').toLowerCase()
  return OVERLAY_ELIGIBLE_IMAGE_EXTENSIONS.some((extension) => fileName.endsWith(extension))
}

export function toNullableNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}
