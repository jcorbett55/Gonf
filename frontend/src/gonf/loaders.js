import { floors } from './shared'
import { mapRoomForState, stripSecretStorageExits } from './rooms'
import { mapItemForState } from './items'
import { mapCharacterForState } from './characters'

export function parseLoadedGonf(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.rooms)) {
    throw new Error('File is missing a valid rooms array.')
  }

  const rawRooms = payload.rooms
    .filter((rawRoom) => rawRoom && typeof rawRoom === 'object')
    .map((rawRoom) => {
      const roomFloor = Number(rawRoom.roomFloor)
      if (!Number.isFinite(roomFloor) || !floors.includes(roomFloor)) {
        return null
      }

      return mapRoomForState(rawRoom, String(payload.gonfName ?? ''))
    })
    .filter(Boolean)

  const rooms = stripSecretStorageExits(rawRooms)

  const items = Array.isArray(payload.items)
    ? payload.items
        .map((rawItem, index) => mapItemForState(rawItem, index))
        .filter(Boolean)
    : []

  const characters = Array.isArray(payload.characters)
    ? payload.characters
        .map((rawCharacter, index) => mapCharacterForState(rawCharacter, index))
        .filter(Boolean)
    : []

  return {
    gonfName: String(payload.gonfName ?? ''),
    rooms,
    items,
    characters,
  }
}
