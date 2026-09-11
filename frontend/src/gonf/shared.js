export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5131'
export const floors = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]
export const DOTNET_DECIMAL_MAX = 7.922816251426433e28
export const planarDirections = ['north', 'east', 'south', 'west']
export const allDirections = ['north', 'east', 'south', 'west', 'up', 'down']
export const SYSTEM_MANAGED_ROOMS = [
  {
    key: 'secret-storage',
    name: 'Secret Storage',
    description: 'Storage room for items that have no home.',
    floor: -5,
  },
]
export const oppositeDirection = {
  north: 'south',
  east: 'west',
  south: 'north',
  west: 'east',
  up: 'down',
  down: 'up',
}

export function toNullableNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

const OVERLAY_ELIGIBLE_IMAGE_EXTENSIONS = ['.png', '.gif']

export function isCharacterImageOverlayEligible(image) {
  if (!image || image.imageStatus !== 'finalized' || !image.previewDataUrl) {
    return false
  }

  const fileName = String(image.fileName ?? '').toLowerCase()
  return OVERLAY_ELIGIBLE_IMAGE_EXTENSIONS.some((extension) => fileName.endsWith(extension))
}
