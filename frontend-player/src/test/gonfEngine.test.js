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
  detectItemGiveToCharacterRequest,
  detectItemRequestFromCharacter,
  detectItemOfferInLine,
  isItemOfferAcceptance,
  buildItemTransferStatusLine,
  parsePlayerCommand,
  buildHelpCommandLine,
  buildInventoryCommandLine,
  buildGoalCommandLine,
  buildUnknownCommandLine,
  deriveGoalCriteria,
  isGoalComplete,
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

describe('item transfer detection', () => {
  const karen = { characterId: 1, characterName: 'Karen', contains: [10] }
  const gun = { itemId: 10, itemName: 'gun' }
  const items = [gun]

  it('detects a player giving a carried item to the sole character present', () => {
    const result = detectItemGiveToCharacterRequest("here's the gun", [gun], [karen])
    expect(result).toEqual({ character: karen, item: gun })
  })

  it('does not detect a give request when the item is not carried by the player', () => {
    const result = detectItemGiveToCharacterRequest("here's the gun", [], [karen])
    expect(result).toBeNull()
  })

  it('does not detect a give request when multiple characters are present', () => {
    const sue = { characterId: 2, characterName: 'Sue', contains: [] }
    const result = detectItemGiveToCharacterRequest("here's the gun", [gun], [karen, sue])
    expect(result).toBeNull()
  })

  it('detects a player requesting an item a character is carrying', () => {
    const result = detectItemRequestFromCharacter('can I have the gun', [karen], items)
    expect(result).toEqual({ character: karen, item: gun })
  })

  it('does not detect a request for an item the character does not carry', () => {
    const sue = { characterId: 2, characterName: 'Sue', contains: [] }
    const result = detectItemRequestFromCharacter('can I have the gun', [sue], items)
    expect(result).toBeNull()
  })

  it('detects an item offer in a generated conversation line', () => {
    const line = { speaker: 'Karen', text: "Here's the gun, take it." }
    const result = detectItemOfferInLine(line, [karen], items)
    expect(result).toEqual({ character: karen, item: gun })
  })

  it('does not detect an item offer from a character who is not carrying it', () => {
    const sue = { characterId: 2, characterName: 'Sue', contains: [] }
    const line = { speaker: 'Sue', text: "Here's the gun, take it." }
    const result = detectItemOfferInLine(line, [sue], items)
    expect(result).toBeNull()
  })

  it('detects the player accepting a pending item offer', () => {
    expect(isItemOfferAcceptance("ok, I'll take that")).toBe(true)
    expect(isItemOfferAcceptance('no thanks')).toBe(false)
  })

  it('builds an item transfer status line', () => {
    const line = buildItemTransferStatusLine('gun', 'Karen', 'Player')
    expect(line).toEqual({ speaker: 'System', text: '[gun transferred from Karen to Player]' })
  })
})

describe('player commands', () => {
  it('parses /help and its alias', () => {
    expect(parsePlayerCommand('/help')).toBe('help')
    expect(parsePlayerCommand('/h')).toBe('help')
  })

  it('parses /inventory and its aliases', () => {
    expect(parsePlayerCommand('/inventory')).toBe('inventory')
    expect(parsePlayerCommand('/inv')).toBe('inventory')
    expect(parsePlayerCommand('/i')).toBe('inventory')
  })

  it('parses /goal and its alias', () => {
    expect(parsePlayerCommand('/goal')).toBe('goal')
    expect(parsePlayerCommand('/g')).toBe('goal')
  })

  it('is case-insensitive when parsing commands', () => {
    expect(parsePlayerCommand('/HELP')).toBe('help')
    expect(parsePlayerCommand('/Inv')).toBe('inventory')
  })

  it('returns unknown for an unrecognized slash command', () => {
    expect(parsePlayerCommand('/dance')).toBe('unknown')
  })

  it('returns null for a plain conversational message', () => {
    expect(parsePlayerCommand('hey karen, how are you?')).toBeNull()
    expect(parsePlayerCommand('')).toBeNull()
    expect(parsePlayerCommand(null)).toBeNull()
  })

  it('builds the help command line listing available commands', () => {
    const line = buildHelpCommandLine()
    expect(line.speaker).toBe('System')
    expect(line.text).toContain('/help')
    expect(line.text).toContain('/inventory')
  })

  it('puts each command on its own line in the help listing', () => {
    const line = buildHelpCommandLine()
    const lines = line.text.split('\n')
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.some((entry) => entry.includes('/help'))).toBe(true)
    expect(lines.some((entry) => entry.includes('/inventory'))).toBe(true)
  })

  it('builds an inventory command line listing carried items on separate lines', () => {
    const line = buildInventoryCommandLine([{ itemId: 10, itemName: 'gun' }, { itemId: 11, itemName: 'key' }])
    expect(line).toEqual({ speaker: 'System', text: 'Inventory:\ngun\nkey' })
  })

  it('builds an empty inventory command line when carrying nothing', () => {
    expect(buildInventoryCommandLine([])).toEqual({ speaker: 'System', text: 'Inventory: you are not carrying anything' })
    expect(buildInventoryCommandLine(null)).toEqual({ speaker: 'System', text: 'Inventory: you are not carrying anything' })
  })

  it('builds an unknown command line', () => {
    const line = buildUnknownCommandLine()
    expect(line.speaker).toBe('System')
    expect(line.text).toContain('/help')
  })

  it('builds a goal command line with a checklist of criteria and their completion status', () => {
    const criteria = [
      { type: 'speak', characterId: 1, characterName: 'Karen' },
      { type: 'give', itemId: 10, itemName: 'diamond', characterId: 1, characterName: 'Karen' },
      { type: 'reach', roomId: 5, roomName: 'Attic' },
      { type: 'hold', itemId: 11, itemName: 'key' },
    ]

    const line = buildGoalCommandLine(criteria, new Set([1]), [{ itemId: 10, characterId: 1 }], new Set(), [])
    expect(line.speaker).toBe('System')
    expect(line.text).toBe(
      ['Goal criteria:', '[x] Speak with Karen', '[x] Give the diamond to Karen', '[ ] Reach Attic', '[ ] Hold the key'].join('\n'),
    )
  })

  it('builds a message indicating there are no goal criteria when the Gonf has no parseable Goal', () => {
    const line = buildGoalCommandLine([], new Set(), [], new Set(), [])
    expect(line).toEqual({ speaker: 'System', text: 'Goal: this Gonf has no defined win criteria.' })
  })

  it('expands a compound arrive criterion into separate room/item/companion checklist lines', () => {
    const criteria = [
      {
        type: 'arrive',
        roomId: 7,
        roomName: 'Staff Quarters',
        itemIds: [10],
        itemNames: ['Diamond'],
        characterIds: [4],
        characterNames: ['Mrs. Karen Higgiebottom'],
      },
    ]

    const line = buildGoalCommandLine(criteria, new Set(), [], new Set(), [10], new Set([4]), 7)
    expect(line.speaker).toBe('System')
    expect(line.text).toBe(
      [
        'Goal criteria:',
        '[x] Be in Staff Quarters',
        '[x] Hold the Diamond',
        '[x] Have Mrs. Karen Higgiebottom with you',
      ].join('\n'),
    )
  })

  it('shows unmet sub-items of a compound arrive criterion independently', () => {
    const criteria = [
      {
        type: 'arrive',
        roomId: 7,
        roomName: 'Staff Quarters',
        itemIds: [10],
        itemNames: ['Diamond'],
        characterIds: [4],
        characterNames: ['Mrs. Karen Higgiebottom'],
      },
    ]

    const line = buildGoalCommandLine(criteria, new Set(), [], new Set(), [], new Set(), null)
    expect(line.text).toBe(
      [
        'Goal criteria:',
        '[ ] Be in Staff Quarters',
        '[ ] Hold the Diamond',
        '[ ] Have Mrs. Karen Higgiebottom with you',
      ].join('\n'),
    )
  })
})

describe('goal criteria', () => {
  const characters = [
    { characterId: 1, characterName: 'Muffy' },
    { characterId: 2, characterName: 'Sir Faulty' },
    { characterId: 3, characterName: 'Reggie' },
    { characterId: 4, characterName: 'Karen' },
    { characterId: 5, characterName: 'Mrs. Higgiebottom' },
  ]
  const items = [{ itemId: 10, itemName: 'diamond' }]

  it('derives speak-with criteria for each named character', () => {
    const criteria = deriveGoalCriteria('Speak with Muffy, Sir Faulty, and Reggie', characters, items)
    expect(criteria).toEqual(
      expect.arrayContaining([
        { type: 'speak', characterId: 1, characterName: 'Muffy' },
        { type: 'speak', characterId: 2, characterName: 'Sir Faulty' },
        { type: 'speak', characterId: 3, characterName: 'Reggie' },
      ]),
    )
    expect(criteria).toHaveLength(3)
  })

  it('derives a give criterion for an item-to-character clause', () => {
    const criteria = deriveGoalCriteria('give the diamond to Karen', characters, items)
    expect(criteria).toEqual([
      { type: 'give', itemId: 10, itemName: 'diamond', characterId: 4, characterName: 'Karen' },
    ])
  })

  it('derives a "followed" criterion for "have CHARACTER follow you at least once"', () => {
    const criteria = deriveGoalCriteria('have Muffy follow you at least once', characters, items)
    expect(criteria).toEqual([{ type: 'followed', characterId: 1, characterName: 'Muffy' }])
  })

  it('derives the exact bullet-formatted goal reported by the user (bug regression)', () => {
    const criteria = deriveGoalCriteria(
      '- Speak with Muffy McSterling\n- Have each character follow you at least once\n- Give Rare Book to Reggie Winthrope III',
      [
        { characterId: 1, characterName: 'Muffy McSterling' },
        { characterId: 2, characterName: 'Reggie Winthrope III' },
      ],
      [{ itemId: 20, itemName: 'Rare Book' }],
    )
    expect(criteria).toEqual(
      expect.arrayContaining([
        { type: 'speak', characterId: 1, characterName: 'Muffy McSterling' },
        { type: 'followed', characterId: 1, characterName: 'Muffy McSterling' },
        { type: 'followed', characterId: 2, characterName: 'Reggie Winthrope III' },
        { type: 'give', itemId: 20, itemName: 'Rare Book', characterId: 2, characterName: 'Reggie Winthrope III' },
      ]),
    )
    expect(criteria).toHaveLength(4)
  })

  it('derives speak and followed criteria for each character with an "each of the characters" style goal', () => {
    const criteria = deriveGoalCriteria(
      'Talk to each of the characters at least once, and have each of them follow you at least once.',
      characters,
      items,
    )
    expect(criteria).toEqual(
      expect.arrayContaining([
        { type: 'speak', characterId: 1, characterName: 'Muffy' },
        { type: 'speak', characterId: 2, characterName: 'Sir Faulty' },
        { type: 'speak', characterId: 3, characterName: 'Reggie' },
        { type: 'speak', characterId: 4, characterName: 'Karen' },
        { type: 'speak', characterId: 5, characterName: 'Mrs. Higgiebottom' },
        { type: 'followed', characterId: 1, characterName: 'Muffy' },
        { type: 'followed', characterId: 2, characterName: 'Sir Faulty' },
        { type: 'followed', characterId: 3, characterName: 'Reggie' },
        { type: 'followed', characterId: 4, characterName: 'Karen' },
        { type: 'followed', characterId: 5, characterName: 'Mrs. Higgiebottom' },
      ]),
    )
    expect(criteria).toHaveLength(10)
  })

  it('derives independent criteria for a real-world bullet goal mixing speak-all, follow-once, and give', () => {
    const criteria = deriveGoalCriteria(
      '- talk to each of the characters at least once\n- have Muffy follow you at least once\n- give diamond to Karen',
      characters,
      items,
    )
    expect(criteria).toEqual(
      expect.arrayContaining([
        { type: 'speak', characterId: 1, characterName: 'Muffy' },
        { type: 'speak', characterId: 2, characterName: 'Sir Faulty' },
        { type: 'speak', characterId: 3, characterName: 'Reggie' },
        { type: 'speak', characterId: 4, characterName: 'Karen' },
        { type: 'speak', characterId: 5, characterName: 'Mrs. Higgiebottom' },
        { type: 'followed', characterId: 1, characterName: 'Muffy' },
        { type: 'give', itemId: 10, itemName: 'diamond', characterId: 4, characterName: 'Karen' },
      ]),
    )
    expect(criteria).toHaveLength(7)
  })

  it('reports a "followed" criterion complete only once the character has ever followed the player', () => {
    const criteria = deriveGoalCriteria('have Muffy follow you at least once', characters, items)
    expect(isGoalComplete(criteria, new Set(), [], new Set(), [], new Set(), null, new Set())).toBe(false)
    expect(isGoalComplete(criteria, new Set(), [], new Set(), [], new Set(), null, new Set([1]))).toBe(true)
  })

  it('derives criteria from a bullet-formatted goal list using "-" markers', () => {
    const criteria = deriveGoalCriteria(
      '- Speak with Muffy.\n- Give the diamond to Karen.\n- Hold the diamond.',
      characters,
      items,
    )
    expect(criteria).toEqual(
      expect.arrayContaining([
        { type: 'speak', characterId: 1, characterName: 'Muffy' },
        { type: 'give', itemId: 10, itemName: 'diamond', characterId: 4, characterName: 'Karen' },
        { type: 'hold', itemId: 10, itemName: 'diamond' },
      ]),
    )
    expect(criteria).toHaveLength(3)
  })

  it('derives a compound arrive criterion from a bullet-formatted goal line', () => {
    const rooms = [{ roomId: 7, roomName: 'Staff Quarters' }]
    const criteria = deriveGoalCriteria(
      '* While holding the diamond, and Karen following, reach the staff quarters.',
      characters,
      items,
      rooms,
    )
    expect(criteria).toEqual([
      {
        type: 'arrive',
        roomId: 7,
        roomName: 'Staff Quarters',
        itemIds: [10],
        itemNames: ['diamond'],
        characterIds: [4],
        characterNames: ['Karen'],
      },
    ])
  })

  it('derives combined criteria from the full example goal', () => {
    const criteria = deriveGoalCriteria(
      'Speak with Muffy, Sir Faulty, and Reggie, then give the diamond to Karen',
      characters,
      items,
    )
    expect(criteria).toHaveLength(4)
    expect(criteria.filter((criterion) => criterion.type === 'speak')).toHaveLength(3)
    expect(criteria.filter((criterion) => criterion.type === 'give')).toHaveLength(1)
  })

  it('derives a reach criterion for a room-arrival clause, plus a present criterion for a named companion', () => {
    const rooms = [{ roomId: 5, roomName: "Servant's Quarters" }]
    const criteria = deriveGoalCriteria("Make it to the servant's quarters with Karen", characters, items, rooms)
    expect(criteria).toEqual(
      expect.arrayContaining([
        { type: 'reach', roomId: 5, roomName: "Servant's Quarters" },
        { type: 'present', characterId: 4, characterName: 'Karen' },
      ]),
    )
    expect(criteria).toHaveLength(2)
  })

  it('derives a hold criterion for a "hold/carry/have" clause', () => {
    expect(deriveGoalCriteria('Hold the diamond', characters, items)).toEqual([
      { type: 'hold', itemId: 10, itemName: 'diamond' },
    ])
    expect(deriveGoalCriteria('Carry the diamond', characters, items)).toEqual([
      { type: 'hold', itemId: 10, itemName: 'diamond' },
    ])
  })

  it('derives a hold criterion for a "take" clause (take is a synonym for hold)', () => {
    expect(deriveGoalCriteria('Take the diamond', characters, items)).toEqual([
      { type: 'hold', itemId: 10, itemName: 'diamond' },
    ])
    expect(deriveGoalCriteria('Taking the diamond', characters, items)).toEqual([
      { type: 'hold', itemId: 10, itemName: 'diamond' },
    ])
  })

  it('derives a speak criterion for an "ask CHARACTER about TOPIC" clause (ask is a synonym for speak)', () => {
    expect(deriveGoalCriteria('Ask Karen about the diamond', characters, items)).toEqual([
      { type: 'speak', characterId: 4, characterName: 'Karen' },
    ])
  })

  it('derives an avoid criterion for "avoid speaking to/never talk to CHARACTER"', () => {
    expect(deriveGoalCriteria('Avoid speaking to Karen', characters, items)).toEqual([
      { type: 'avoid', subtype: 'speak', characterId: 4, characterName: 'Karen' },
    ])
    expect(deriveGoalCriteria('Never talk to Karen', characters, items)).toEqual([
      { type: 'avoid', subtype: 'speak', characterId: 4, characterName: 'Karen' },
    ])
  })

  it('derives an avoid criterion for "avoid giving ITEM to CHARACTER"', () => {
    expect(deriveGoalCriteria('Avoid giving the diamond to Karen', characters, items)).toEqual([
      { type: 'avoid', subtype: 'give', itemId: 10, itemName: 'diamond', characterId: 4, characterName: 'Karen' },
    ])
    expect(deriveGoalCriteria('Never give the diamond to Karen', characters, items)).toEqual([
      { type: 'avoid', subtype: 'give', itemId: 10, itemName: 'diamond', characterId: 4, characterName: 'Karen' },
    ])
  })

  it('an avoid criterion is met until the forbidden action occurs, then permanently unmet', () => {
    const speakCriteria = [{ type: 'avoid', subtype: 'speak', characterId: 4, characterName: 'Karen' }]
    expect(isGoalComplete(speakCriteria, new Set(), [], new Set(), [])).toBe(true)
    expect(isGoalComplete(speakCriteria, new Set([4]), [], new Set(), [])).toBe(false)

    const giveCriteria = [{ type: 'avoid', subtype: 'give', itemId: 10, characterId: 4 }]
    expect(isGoalComplete(giveCriteria, new Set(), [], new Set(), [])).toBe(true)
    expect(isGoalComplete(giveCriteria, new Set(), [{ itemId: 10, characterId: 4 }], new Set(), [])).toBe(false)
  })
    it('derives a compound arrive criterion from a comma-joined goal with a leading "while" conditional clause', () => {
      const rooms = [{ roomId: 5, roomName: 'Staff Quarters' }]
      const criteria = deriveGoalCriteria(
        'While carrying the diamond, reach the Staff Quarters with Karen.',
        characters,
        items,
        rooms,
    )
    expect(criteria).toEqual([
      {
        type: 'arrive',
        roomId: 5,
        roomName: 'Staff Quarters',
        itemIds: [10],
        itemNames: ['diamond'],
        characterIds: [4],
        characterNames: ['Karen'],
      },
    ])
  })

  it('silently skips clauses referencing characters/items/rooms that do not exist in this Gonf', () => {
    const criteria = deriveGoalCriteria(
      'Speak with the Alien, then give the guitar to Karen, then reach the Moon Base',
      characters,
      items,
    )
    expect(criteria).toEqual([])
  })

  it('parses multi-clause goals joined with "and" before a recognized verb, without splitting name lists', () => {
    const rooms = [{ roomId: 5, roomName: 'Attic' }]
    const criteria = deriveGoalCriteria('Reach the Attic and speak with Muffy, Sir Faulty, and Reggie', characters, items, rooms)
    expect(criteria).toEqual(
      expect.arrayContaining([
        { type: 'reach', roomId: 5, roomName: 'Attic' },
        { type: 'speak', characterId: 1, characterName: 'Muffy' },
        { type: 'speak', characterId: 2, characterName: 'Sir Faulty' },
        { type: 'speak', characterId: 3, characterName: 'Reggie' },
      ]),
    )
    expect(criteria).toHaveLength(4)
  })

  it('returns an empty array for blank goal text', () => {
    expect(deriveGoalCriteria('', characters, items)).toEqual([])
    expect(deriveGoalCriteria(null, characters, items)).toEqual([])
  })

  it('does not mis-split a goal on a period inside a character title abbreviation like "Mrs."', () => {
    const rooms = [{ roomId: 7, roomName: 'Staff Quarters' }]
    const criteria = deriveGoalCriteria(
      'While carrying the diamond, reach the Staff Quarters with Mrs. Higgiebottom.',
      characters,
      items,
      rooms,
    )
    expect(criteria).toEqual([
      {
        type: 'arrive',
        roomId: 7,
        roomName: 'Staff Quarters',
        itemIds: [10],
        itemNames: ['diamond'],
        characterIds: [5],
        characterNames: ['Mrs. Higgiebottom'],
      },
    ])
  })

  it('derives a compound arrive criterion (item + companion) for a full example goal with an embedded "talked ... about" condition', () => {
    const rooms = [{ roomId: 6, roomName: 'Kitchen' }]
    const criteria = deriveGoalCriteria(
      'While carrying the diamond, and have talked to Muffy about her parrot, arrive in the kitchen with Karen',
      characters,
      items,
      rooms,
    )
    // The "talked to Muffy about her parrot" condition isn't a hold/follow phrase, so it can't be
    // resolved as an arrive condition and is dropped; only the item + companion conditions apply.
    expect(criteria).toEqual([
      {
        type: 'arrive',
        roomId: 6,
        roomName: 'Kitchen',
        itemIds: [10],
        itemNames: ['diamond'],
        characterIds: [4],
        characterNames: ['Karen'],
      },
    ])
  })

  it('derives a compound arrive criterion from the recommended "while holding X, and Y following, reach Z" phrasing', () => {
    const rooms = [{ roomId: 7, roomName: 'Staff Quarters' }]
    const criteria = deriveGoalCriteria(
      'While holding the diamond, and Karen following, reach the staff quarters',
      characters,
      items,
      rooms,
    )
    expect(criteria).toEqual([
      {
        type: 'arrive',
        roomId: 7,
        roomName: 'Staff Quarters',
        itemIds: [10],
        itemNames: ['diamond'],
        characterIds: [4],
        characterNames: ['Karen'],
      },
    ])
  })

  it('keeps the companion condition when phrased as "have Karen following" instead of dropping it', () => {
    const rooms = [{ roomId: 7, roomName: 'Staff Quarters' }]
    const criteria = deriveGoalCriteria(
      'While holding the diamond, and have Karen following, reach the staff quarters',
      characters,
      items,
      rooms,
    )
    expect(criteria).toEqual([
      {
        type: 'arrive',
        roomId: 7,
        roomName: 'Staff Quarters',
        itemIds: [10],
        itemNames: ['diamond'],
        characterIds: [4],
        characterNames: ['Karen'],
      },
    ])
  })

  it('reports incomplete when not all criteria are satisfied', () => {
    const criteria = deriveGoalCriteria(
      'Speak with Muffy, Sir Faulty, and Reggie, then give the diamond to Karen',
      characters,
      items,
    )
    expect(isGoalComplete(criteria, new Set([1, 2]), [])).toBe(false)
  })

  it('reports complete once every speak and give criterion is satisfied', () => {
    const criteria = deriveGoalCriteria(
      'Speak with Muffy, Sir Faulty, and Reggie, then give the diamond to Karen',
      characters,
      items,
    )
    expect(
      isGoalComplete(criteria, new Set([1, 2, 3]), [{ itemId: 10, characterId: 4 }]),
    ).toBe(true)
  })

  it('reports a hold criterion complete only while the item is currently carried, reverting if it is given away', () => {
    const criteria = deriveGoalCriteria('Hold the diamond', characters, items)
    expect(isGoalComplete(criteria, new Set(), [], new Set(), [10])).toBe(true)
    expect(isGoalComplete(criteria, new Set(), [], new Set(), [])).toBe(false)
  })

  it('returns false for empty criteria', () => {
    expect(isGoalComplete([], new Set([1]), [])).toBe(false)
  })

  it('reports a compound arrive criterion complete only when currently in the room, holding the item, and the companion is present, all simultaneously', () => {
    const rooms = [{ roomId: 5, roomName: 'Staff Quarters' }]
    const criteria = deriveGoalCriteria(
      'While carrying the diamond, reach the Staff Quarters with Karen.',
      characters,
      items,
      rooms,
    )
    // Diamond held and room visited historically, but not currently in the room -> incomplete
    expect(isGoalComplete(criteria, new Set(), [], new Set([5]), [10], new Set([4]), 1)).toBe(false)
    // Currently in the room, but Karen not present -> incomplete
    expect(isGoalComplete(criteria, new Set(), [], new Set([5]), [10], new Set(), 5)).toBe(false)
    // Currently in the room, holding the diamond, and Karen present -> complete
    expect(isGoalComplete(criteria, new Set(), [], new Set([5]), [10], new Set([4]), 5)).toBe(true)
    // Leaving the room afterward reverts it to incomplete (live check, not history-based)
    expect(isGoalComplete(criteria, new Set(), [], new Set([5]), [10], new Set([4]), 1)).toBe(false)
  })
})

