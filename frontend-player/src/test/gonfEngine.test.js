import { describe, expect, it } from 'vitest'
import {
  parseLoadedGonf,
  resolveStartingRoomId,
  getCharactersInRoom,
  getOverlayEligibleCharactersInRoom,
  getValidExits,
  buildRoomNarrationText,
  findRoomById,
  wanderCharacters,
  getDepartedWandererNames,
  buildMissedWandererLine,
} from '../gonf/gonfEngine'

function buildPayload(overrides = {}) {
  return {
    gonfName: 'TestGonf',
    rooms: [
      {
        roomId: 1,
        roomName: 'Entryway',
        roomDescription: "It's an entryway.",
        roomFloor: 1,
        isStartingRoom: true,
        exits: { north: 3, east: 2, south: null, west: null, up: null, down: null },
      },
      {
        roomId: 2,
        roomName: 'Coat Closet',
        roomDescription: 'Hang your coat here.',
        roomFloor: 1,
        isStartingRoom: false,
        exits: { north: null, east: null, south: null, west: 1, up: null, down: null },
      },
      {
        roomId: 3,
        roomName: 'Study',
        roomDescription: 'A quiet study.',
        roomFloor: 1,
        isStartingRoom: false,
        exits: { north: null, east: null, south: 1, west: null, up: null, down: null },
      },
    ],
    characters: [
      {
        characterId: 1,
        characterName: 'Sir Fawlty',
        location: 3,
        image: { imageStatus: 'finalized', fileName: 'c0001_sir-fawlty.png', previewDataUrl: 'data:image/png;base64,abc' },
      },
      {
        characterId: 2,
        characterName: 'Mrs. Karen',
        location: 3,
        image: { imageStatus: 'none', fileName: '', previewDataUrl: '' },
      },
    ],
    items: [],
    ...overrides,
  }
}

describe('gonfEngine', () => {
  it('parses a valid payload into rooms/characters/items', () => {
    const parsed = parseLoadedGonf(buildPayload())
    expect(parsed.gonfName).toBe('TestGonf')
    expect(parsed.rooms).toHaveLength(3)
    expect(parsed.characters).toHaveLength(2)
  })

  it('throws when rooms array is missing', () => {
    expect(() => parseLoadedGonf({ gonfName: 'x' })).toThrow()
  })

  it('resolves the starting room from the isStartingRoom flag', () => {
    const parsed = parseLoadedGonf(buildPayload())
    expect(resolveStartingRoomId(parsed.rooms)).toBe(1)
  })

  it('falls back to lowest floor/id room when no isStartingRoom flag is set', () => {
    const payload = buildPayload()
    payload.rooms = payload.rooms.map((room) => ({ ...room, isStartingRoom: false }))
    const parsed = parseLoadedGonf(payload)
    expect(resolveStartingRoomId(parsed.rooms)).toBe(1)
  })

  it('finds a room by id', () => {
    const parsed = parseLoadedGonf(buildPayload())
    const room = findRoomById(parsed.rooms, 3)
    expect(room?.roomName).toBe('Study')
  })

  it('returns only valid (non-null) exits for a room', () => {
    const parsed = parseLoadedGonf(buildPayload())
    const entryway = findRoomById(parsed.rooms, 1)
    expect(getValidExits(entryway).sort()).toEqual(['east', 'north'])
  })

  it('returns characters located in a given room', () => {
    const parsed = parseLoadedGonf(buildPayload())
    const charactersInStudy = getCharactersInRoom(parsed.characters, 3)
    expect(charactersInStudy).toHaveLength(2)
  })

  it('filters to only overlay-eligible (finalized png/gif) characters', () => {
    const parsed = parseLoadedGonf(buildPayload())
    const overlayEligible = getOverlayEligibleCharactersInRoom(parsed.characters, 3)
    expect(overlayEligible).toHaveLength(1)
    expect(overlayEligible[0].characterName).toBe('Sir Fawlty')
  })

  it('builds narration text with no characters present', () => {
    const parsed = parseLoadedGonf(buildPayload())
    const closet = findRoomById(parsed.rooms, 2)
    const text = buildRoomNarrationText(closet, getCharactersInRoom(parsed.characters, 2))
    expect(text).toBe('Hang your coat here.')
  })

  it('builds narration text with one character present', () => {
    const parsed = parseLoadedGonf(buildPayload())
    const study = findRoomById(parsed.rooms, 3)
    const characters = [getCharactersInRoom(parsed.characters, 3)[0]]
    const text = buildRoomNarrationText(study, characters)
    expect(text).toBe('A quiet study. Sir Fawlty is here as well.')
  })

  it('builds narration text with multiple characters present', () => {
    const parsed = parseLoadedGonf(buildPayload())
    const study = findRoomById(parsed.rooms, 3)
    const characters = getCharactersInRoom(parsed.characters, 3)
    const text = buildRoomNarrationText(study, characters)
    expect(text).toBe('A quiet study. Sir Fawlty and Mrs. Karen are here as well.')
  })

  it('moves a wanderer character to a random valid exit or keeps it in place', () => {
    const payload = buildPayload()
    payload.characters[0].wanderer = true
    const parsed = parseLoadedGonf(payload)

    // Study (room 3) has one exit: south -> room 1. Candidates are [3, 1].
    const forcedToExit = wanderCharacters(parsed.rooms, parsed.characters, () => 0.99)
    expect(forcedToExit[0].characterLocation).toBe('1')

    const forcedToStay = wanderCharacters(parsed.rooms, parsed.characters, () => 0)
    expect(forcedToStay[0].characterLocation).toBe('3')
  })

  it('never moves a non-wanderer character', () => {
    const parsed = parseLoadedGonf(buildPayload())
    const result = wanderCharacters(parsed.rooms, parsed.characters, () => 0.99)
    expect(result[0].characterLocation).toBe('3')
    expect(result[1].characterLocation).toBe('3')
  })

  it('keeps a wanderer character in place when its room has no exits', () => {
    const payload = buildPayload()
    payload.characters[0].wanderer = true
    payload.characters[0].location = 2
    payload.rooms[1].exits = { north: null, east: null, south: null, west: null, up: null, down: null }
    const parsed = parseLoadedGonf(payload)

    const result = wanderCharacters(parsed.rooms, parsed.characters, () => 0.99)
    expect(result[0].characterLocation).toBe('2')
  })

  it('detects departed wanderer names between previous and next room occupants', () => {
    const bob = { characterId: 1, characterName: 'Bob', wanderer: true }
    const sue = { characterId: 2, characterName: 'Sue', wanderer: false }
    const departed = getDepartedWandererNames([bob, sue], [sue])
    expect(departed).toEqual(['Bob'])
  })

  it('does not count a non-wanderer as departed even if missing from next occupants', () => {
    const bob = { characterId: 1, characterName: 'Bob', wanderer: false }
    const departed = getDepartedWandererNames([bob], [])
    expect(departed).toEqual([])
  })

  it('builds a missed-wanderer line when a remaining character wins the 50/50 roll', () => {
    const sue = { characterId: 2, characterName: 'Sue' }
    const message = buildMissedWandererLine([sue], ['Bob'], () => 0)
    expect(message).toEqual({ speaker: 'Sue', line: 'Oh! You just missed Bob.' })
  })

  it('returns null when all remaining characters fail their 50/50 roll', () => {
    const sue = { characterId: 2, characterName: 'Sue' }
    const message = buildMissedWandererLine([sue], ['Bob'], () => 0.99)
    expect(message).toBeNull()
  })

  it('combines multiple departed wanderer names in the missed-wanderer line', () => {
    const sue = { characterId: 2, characterName: 'Sue' }
    const message = buildMissedWandererLine([sue], ['Bob', 'Tom'], () => 0)
    expect(message.line).toBe('Oh! You just missed Bob and Tom.')
  })

  it('returns null when there are no remaining characters or no departed wanderers', () => {
    expect(buildMissedWandererLine([], ['Bob'], () => 0)).toBeNull()
    expect(buildMissedWandererLine([{ characterId: 2, characterName: 'Sue' }], [], () => 0)).toBeNull()
  })
})
