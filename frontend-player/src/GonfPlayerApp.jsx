import { useEffect, useMemo, useRef, useState } from 'react'
import './gonfPlayer.css'
import {
  parseLoadedGonf,
  resolveStartingRoomId,
  findRoomById,
  getCharactersInRoom,
  getOverlayEligibleCharactersInRoom,
  getValidExits,
  buildRoomNarrationText,
  wanderCharacters,
  getDepartedWandererNames,
  buildMissedWandererLine,
  detectFollowRequestTarget,
  detectFollowDismissRequest,
  isFollowConfirmation,
  isFollowDecline,
  buildAlreadyFollowingLine,
  buildFollowJoinLine,
  buildFollowDismissalLine,
  buildFollowCancelLine,
  buildFollowerRoomAnnouncement,
  buildFollowStatusLine,
  buildFollowDismissedStatusLine,
  getCarriedItemsForCharacter,
  detectItemGiveToCharacterRequest,
  detectItemRequestFromCharacter,
  detectItemOfferInLine,
  buildItemTransferStatusLine,
  parsePlayerCommand,
  buildHelpCommandLine,
  buildInventoryCommandLine,
  buildGoalCommandLine,
  buildUnknownCommandLine,
  deriveGoalCriteria,
  isGoalComplete,
  detectAccusationRequest,
  isAccusationConfirmation,
  isAccusationDecline,
  buildAccusationConfirmationLine,
  buildAccusationCancelledLine,
  buildAccusationCorrectLine,
  buildAccusationIncorrectLine,
  buildGuiltyConfessionLines,
  parseInspectionRequest,
  resolveInspectionTarget,
  buildInspectionResultLine,
  mergeSynthesizedItems,
} from './gonf/gonfEngine'
import { directionLabels } from './gonf/shared'
import { fetchConversationTurn } from './gonf/conversationClient'
import { postItemTransfer } from './gonf/itemTransferClient'
import { postAccusation } from './gonf/accusationClient'
import { fetchSynthesizedItems } from './gonf/mysteryItemsClient'

const MAX_VISIBLE_ROOM_OVERLAYS = 4
const MAX_CONVERSATION_MEMORY_ENTRIES = 16
// GONF-014: the mystery case file is looked up server-side by (gonfName, saveId). This player
// app does not yet have a save/load-slot UI, so every playthrough of a given Gonf uses this fixed
// save id, matching the id used by the backend's playstate/casefile test fixtures.
const DEFAULT_SAVE_ID = 'default'
const staircaseDirections = new Set(['up', 'down'])
const SPEAKER_COLOR_HUES = [210, 15, 145, 45, 280, 0, 190, 320]


const appendConversationMemory = (existingEntries, newEntries) => {
  const combined = [...existingEntries, ...newEntries]
  return combined.length > MAX_CONVERSATION_MEMORY_ENTRIES
    ? combined.slice(combined.length - MAX_CONVERSATION_MEMORY_ENTRIES)
    : combined
}

function getSpeakerColorHueFromHash(speakerName) {
  let hash = 0
  for (let index = 0; index < speakerName.length; index += 1) {
    hash = (hash * 31 + speakerName.charCodeAt(index)) >>> 0
  }

  return SPEAKER_COLOR_HUES[hash % SPEAKER_COLOR_HUES.length]
}

function buildSpeakerColorAssignments(speakerNames) {
  const uniqueNames = Array.from(new Set(speakerNames.filter(Boolean)))
  const assignments = new Map()
  const usedHueIndices = new Set()

  uniqueNames.forEach((name, index) => {
    const preferredIndex = SPEAKER_COLOR_HUES.indexOf(getSpeakerColorHueFromHash(name))
    let hueIndex = preferredIndex

    if (usedHueIndices.has(hueIndex)) {
      hueIndex = SPEAKER_COLOR_HUES.findIndex((_, candidateIndex) => !usedHueIndices.has(candidateIndex))
    }

    if (hueIndex === -1 || hueIndex === undefined) {
      hueIndex = index % SPEAKER_COLOR_HUES.length
    }

    usedHueIndices.add(hueIndex)
    assignments.set(name, `hsl(${SPEAKER_COLOR_HUES[hueIndex]}, 70%, 72%)`)
  })

  return assignments
}

function DirectionIcon({ direction }) {
  if (direction === 'up') {
    return <span aria-hidden="true">🪜⬆</span>
  }

  if (direction === 'down') {
    return <span aria-hidden="true">🪜⬇</span>
  }

  const arrows = {
    north: '↑',
    east: '→',
    south: '↓',
    west: '←',
  }

  return <span aria-hidden="true">{arrows[direction]}</span>
}

function GonfPlayerApp() {
  const [gonfData, setGonfData] = useState(null)
  const [currentRoomId, setCurrentRoomId] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [missedWandererMessage, setMissedWandererMessage] = useState(null)
  const [conversationLog, setConversationLog] = useState([])
  const [conversationDraft, setConversationDraft] = useState('')
  const [conversationError, setConversationError] = useState('')
  const [isConversationLoading, setIsConversationLoading] = useState(false)
  const [followerCharacterId, setFollowerCharacterId] = useState(null)
  const [pendingFollowSwap, setPendingFollowSwap] = useState(null)
  const [playerItemIds, setPlayerItemIds] = useState([])
  const [spokenCharacterIds, setSpokenCharacterIds] = useState(() => new Set())
  const [completedGiveTransfers, setCompletedGiveTransfers] = useState([])
  const [visitedRoomIds, setVisitedRoomIds] = useState(() => new Set())
  const [everFollowedCharacterIds, setEverFollowedCharacterIds] = useState(() => new Set())
  const [hasWon, setHasWon] = useState(false)
  const [hasLost, setHasLost] = useState(false)
  const [pendingAccusation, setPendingAccusation] = useState(null)
  const [pendingConfession, setPendingConfession] = useState(false)
  const conversationRoomKeyRef = useRef(null)
  const conversationMemoryRef = useRef([])
  const characterMemoryRef = useRef([])


  const onFileChange = async (event) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''

    if (!file) {
      return
    }

    setLoadError('')

    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      let parsed = parseLoadedGonf(payload)
      const startingRoomId = resolveStartingRoomId(parsed.rooms)

      if (startingRoomId === null) {
        setLoadError('This Gonf file does not contain any rooms to start in.')
        return
      }

      // GONF-013: hydrate any synthesized clue items generated for this playthrough's hidden
      // mystery case file, so `/look` can reveal them even though they aren't authored items.
      const synthesizedItems = await fetchSynthesizedItems({
        gonfName: parsed.gonfName,
        saveId: DEFAULT_SAVE_ID,
      }).catch(() => [])
      parsed = mergeSynthesizedItems(parsed, synthesizedItems)

      setGonfData(parsed)
      setCurrentRoomId(startingRoomId)
      setMissedWandererMessage(null)
      setFollowerCharacterId(null)
      setPendingFollowSwap(null)
      setPlayerItemIds([])
      setSpokenCharacterIds(new Set())
      setCompletedGiveTransfers([])
      setVisitedRoomIds(new Set([startingRoomId]))
      setEverFollowedCharacterIds(new Set())
      setHasWon(false)
      setHasLost(false)
      setPendingAccusation(null)
      setPendingConfession(false)
      conversationMemoryRef.current = []
      characterMemoryRef.current = []
    } catch (error) {
      setLoadError(error?.message ?? 'Could not load this Gonf file. Please verify it is valid.')
      setGonfData(null)
      setCurrentRoomId(null)
      setMissedWandererMessage(null)
      setFollowerCharacterId(null)
      setPendingFollowSwap(null)
      setPlayerItemIds([])
      setSpokenCharacterIds(new Set())
      setCompletedGiveTransfers([])
      setVisitedRoomIds(new Set())
      setEverFollowedCharacterIds(new Set())
      setHasWon(false)
      setHasLost(false)
      setPendingAccusation(null)
      setPendingConfession(false)
      conversationMemoryRef.current = []
      characterMemoryRef.current = []
    }
  }

  const currentRoom = useMemo(
    () => (gonfData ? findRoomById(gonfData.rooms, currentRoomId) : null),
    [gonfData, currentRoomId],
  )

  const charactersInRoom = useMemo(
    () => (gonfData ? getCharactersInRoom(gonfData.characters, currentRoomId) : []),
    [gonfData, currentRoomId],
  )

  const followerCharacter = useMemo(
    () => (gonfData ? gonfData.characters.find((character) => character.characterId === followerCharacterId) ?? null : null),
    [gonfData, followerCharacterId],
  )

  const nonFollowerCharactersInRoom = useMemo(
    () => charactersInRoom.filter((character) => character.characterId !== followerCharacterId),
    [charactersInRoom, followerCharacterId],
  )

  const overlayCharacters = useMemo(
    () => (gonfData ? getOverlayEligibleCharactersInRoom(gonfData.characters, currentRoomId) : []),
    [gonfData, currentRoomId],
  )

  const speakerColorAssignments = useMemo(() => {
    const roomSpeakerNames = charactersInRoom.map((character) => character.characterName)
    const logSpeakerNames = conversationLog
      .map((entry) => entry.speaker)
      .filter((speaker) => speaker !== 'Player' && speaker !== 'System')
    return buildSpeakerColorAssignments([...roomSpeakerNames, ...logSpeakerNames])
  }, [charactersInRoom, conversationLog])
  const visibleOverlayCharacters = overlayCharacters.slice(0, MAX_VISIBLE_ROOM_OVERLAYS)
  const hiddenOverlayCount = Math.max(0, overlayCharacters.length - MAX_VISIBLE_ROOM_OVERLAYS)

  const validExits = useMemo(() => (currentRoom ? getValidExits(currentRoom) : []), [currentRoom])

  const playerCarriedItems = useMemo(
    () => (gonfData ? (gonfData.items ?? []).filter((item) => playerItemIds.includes(Number(item.itemId))) : []),
    [gonfData, playerItemIds],
  )

  const applyItemTransferResult = (transferResult) => {
    setPlayerItemIds(transferResult.playerItemIds ?? [])
    setGonfData((previousGonfData) => {
      if (!previousGonfData || !Array.isArray(transferResult.characters)) {
        return previousGonfData
      }
      const updatedCharactersById = new Map(transferResult.characters.map((character) => [Number(character.characterId), character]))
      return {
        ...previousGonfData,
        characters: previousGonfData.characters.map((character) => {
          const updated = updatedCharactersById.get(Number(character.characterId))
          return updated ? { ...character, contains: updated.contains ?? [] } : character
        }),
      }
    })
  }

  const recordGiveTransfer = (itemId, characterId) => {
    setCompletedGiveTransfers((previousTransfers) => [
      ...previousTransfers,
      { itemId: Number(itemId), characterId: Number(characterId) },
    ])
  }

  const markCharactersSpoken = (characterList) => {
    if (!Array.isArray(characterList) || characterList.length === 0) {
      return
    }

    setSpokenCharacterIds((previousSpoken) => {
      const nextSpoken = new Set(previousSpoken)
      characterList.forEach((character) => nextSpoken.add(Number(character.characterId)))
      return nextSpoken
    })
  }

  const buildCharacterTransferPayload = (characters) =>
    (characters ?? []).map((character) => ({
      characterId: character.characterId,
      location: character.characterLocation,
      contains: character.contains ?? [],
    }))

  const goalCriteria = useMemo(
    () => (gonfData ? deriveGoalCriteria(gonfData.goal, gonfData.characters, gonfData.items, gonfData.rooms) : []),
    [gonfData],
  )

  // Characters currently "with" the player: physically in the same room, or following.
  const presentCharacterIds = useMemo(() => {
    const ids = new Set(charactersInRoom.map((character) => Number(character.characterId)))
    if (followerCharacterId != null) {
      ids.add(Number(followerCharacterId))
    }
    return ids
  }, [charactersInRoom, followerCharacterId])

  useEffect(() => {
    if (hasWon || goalCriteria.length === 0) {
      return
    }

    if (
      isGoalComplete(
        goalCriteria,
        spokenCharacterIds,
        completedGiveTransfers,
        visitedRoomIds,
        playerItemIds,
        presentCharacterIds,
        currentRoomId,
        everFollowedCharacterIds,
      )
    ) {
      setHasWon(true)
    }
  }, [
    goalCriteria,
    spokenCharacterIds,
    completedGiveTransfers,
    visitedRoomIds,
    playerItemIds,
    presentCharacterIds,
    currentRoomId,
    everFollowedCharacterIds,
    hasWon,
  ])

  const narrationText = useMemo(() => {
    if (!currentRoom) {
      return ''
    }

    const baseNarration = buildRoomNarrationText(currentRoom, nonFollowerCharactersInRoom)
    if (!followerCharacter) {
      return baseNarration
    }

    return `${baseNarration} ${buildFollowerRoomAnnouncement(followerCharacter.characterName)}`.trim()
  }, [currentRoom, nonFollowerCharactersInRoom, followerCharacter])

  useEffect(() => {
    if (!currentRoom) {
      return
    }

    if (conversationRoomKeyRef.current === currentRoomId) {
      return
    }

    conversationRoomKeyRef.current = currentRoomId
    setConversationLog([])
    setConversationDraft('')
    setConversationError('')

    if (nonFollowerCharactersInRoom.length === 0) {
      setIsConversationLoading(false)
      return
    }

    let cancelled = false
    setIsConversationLoading(true)

    fetchConversationTurn({
      roomName: currentRoom.roomName,
      roomDescription: currentRoom.roomDescription,
      characters: nonFollowerCharactersInRoom,
      items: gonfData.items,
      transcript: [],
      playerMessage: null,
      previousLines: conversationMemoryRef.current,
      characterMemory: characterMemoryRef.current,
      gonfName: gonfData.gonfName,
      saveId: DEFAULT_SAVE_ID,
      playerHeldItemIds: playerItemIds,
      goal: gonfData.goal,
    })
      .then(({ lines, updatedCharacterMemory }) => {
        if (cancelled) {
          return
        }
        const newEntries = lines.map((line) => ({ speaker: line.speaker, text: line.text }))
        setConversationLog(newEntries)
        conversationMemoryRef.current = appendConversationMemory(conversationMemoryRef.current, newEntries)
        characterMemoryRef.current = updatedCharacterMemory
        markCharactersSpoken(nonFollowerCharactersInRoom)
      })
      .catch((error) => {
        if (cancelled) {
          return
        }
        setConversationError(error?.message ?? 'Could not start conversation.')
      })
      .finally(() => {
        if (!cancelled) {
          setIsConversationLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [currentRoom, currentRoomId, nonFollowerCharactersInRoom])

  const onSubmitConversation = async (event) => {
    event.preventDefault()

    const trimmedMessage = conversationDraft.trim()
    if (!currentRoom || isConversationLoading || hasWon || hasLost) {
      return
    }

    if (pendingConfession) {
      setConversationDraft('')
      setPendingConfession(false)
      setHasWon(true)
      return
    }

    if (!trimmedMessage) {
      return
    }

    setConversationDraft('')
    setConversationError('')

    if (pendingAccusation) {
      const nextLogWithPlayer = [...conversationLog, { speaker: 'Player', text: trimmedMessage }]

      if (isAccusationConfirmation(trimmedMessage)) {
        const accusedCharacter = pendingAccusation.character
        setPendingAccusation(null)
        setConversationLog(nextLogWithPlayer)

        try {
          const { correct, motive } = await postAccusation({
            gonfName: gonfData?.gonfName,
            saveId: DEFAULT_SAVE_ID,
            accusedCharacterId: accusedCharacter.characterId,
          })

          if (correct) {
            const confessionLines = buildGuiltyConfessionLines(accusedCharacter.characterName, motive)
            setConversationLog([
              ...nextLogWithPlayer,
              buildAccusationCorrectLine(accusedCharacter.characterName),
              ...confessionLines,
            ])
            setPendingConfession(true)
          } else {
            setConversationLog([...nextLogWithPlayer, buildAccusationIncorrectLine(accusedCharacter.characterName)])
            setHasLost(true)
          }
        } catch (error) {
          setConversationError(error?.message ?? 'Could not resolve the accusation.')
        }
      } else if (isAccusationDecline(trimmedMessage)) {
        setConversationLog([...nextLogWithPlayer, buildAccusationCancelledLine()])
        setPendingAccusation(null)
      } else {
        setConversationLog(nextLogWithPlayer)
      }

      return
    }

    const accusedCharacter = detectAccusationRequest(trimmedMessage, charactersInRoom)
    if (accusedCharacter) {
      const nextLogWithPlayer = [...conversationLog, { speaker: 'Player', text: trimmedMessage }]
      setConversationLog([...nextLogWithPlayer, buildAccusationConfirmationLine(accusedCharacter.characterName)])
      setPendingAccusation({ character: accusedCharacter })
      return
    }

    const inspectionSearchText = parseInspectionRequest(trimmedMessage)
    if (inspectionSearchText !== null) {
      const nextLogWithPlayer = [...conversationLog, { speaker: 'Player', text: trimmedMessage }]
      const inspectionTarget = resolveInspectionTarget(inspectionSearchText, {
        charactersInRoom,
        items: gonfData?.items ?? [],
        room: currentRoom,
        playerItemIds,
      })
      setConversationLog([...nextLogWithPlayer, buildInspectionResultLine(inspectionTarget, gonfData?.items ?? [])])
      return
    }

    const playerCommand = parsePlayerCommand(trimmedMessage)
    if (playerCommand) {
      const nextLogWithPlayer = [...conversationLog, { speaker: 'Player', text: trimmedMessage }]

      if (playerCommand === 'help') {
        setConversationLog([...nextLogWithPlayer, buildHelpCommandLine()])
      } else if (playerCommand === 'inventory') {
        setConversationLog([...nextLogWithPlayer, buildInventoryCommandLine(playerCarriedItems)])
      } else if (playerCommand === 'goal') {
        setConversationLog([
          ...nextLogWithPlayer,
          buildGoalCommandLine(
            goalCriteria,
            spokenCharacterIds,
            completedGiveTransfers,
            visitedRoomIds,
            playerItemIds,
            presentCharacterIds,
            currentRoomId,
            everFollowedCharacterIds,
            gonfData?.goal,
          ),
        ])
      } else {
        setConversationLog([...nextLogWithPlayer, buildUnknownCommandLine()])
      }

      return
    }

    if (charactersInRoom.length === 0) {
      return
    }

    if (pendingFollowSwap) {
      const nextLogWithPlayer = [...conversationLog, { speaker: 'Player', text: trimmedMessage }]

      if (isFollowConfirmation(trimmedMessage)) {
        const dismissedLine = buildFollowDismissalLine(pendingFollowSwap.currentFollowerName)
        const dismissedStatusLine = buildFollowDismissedStatusLine(pendingFollowSwap.currentFollowerName)
        const joinLine = buildFollowJoinLine(pendingFollowSwap.requestedCharacter.characterName)
        const joinStatusLine = buildFollowStatusLine(pendingFollowSwap.requestedCharacter.characterName)
        setConversationLog([...nextLogWithPlayer, dismissedLine, dismissedStatusLine, joinLine, joinStatusLine])
        conversationMemoryRef.current = appendConversationMemory(conversationMemoryRef.current, [dismissedLine, joinLine])
        setFollowerCharacterId(pendingFollowSwap.requestedCharacter.characterId)
        setEverFollowedCharacterIds((previousIds) => {
          const nextIds = new Set(previousIds)
          nextIds.add(Number(pendingFollowSwap.requestedCharacter.characterId))
          return nextIds
        })
        setGonfData((previousGonfData) => {
          if (!previousGonfData) {
            return previousGonfData
          }
          return {
            ...previousGonfData,
            characters: previousGonfData.characters.map((character) =>
              character.characterId === pendingFollowSwap.currentFollowerId
                ? { ...character, characterLocation: character.originalLocation || character.characterLocation }
                : character,
            ),
          }
        })
      } else if (isFollowDecline(trimmedMessage)) {
        const cancelLine = buildFollowCancelLine(pendingFollowSwap.currentFollowerName)
        setConversationLog([...nextLogWithPlayer, cancelLine])
        conversationMemoryRef.current = appendConversationMemory(conversationMemoryRef.current, [cancelLine])
      } else {
        setConversationLog(nextLogWithPlayer)
      }

      setPendingFollowSwap(null)
      return
    }

    if (followerCharacter) {
      const dismissRequested = detectFollowDismissRequest(trimmedMessage, followerCharacter)
      if (dismissRequested) {
        const nextLogWithPlayer = [...conversationLog, { speaker: 'Player', text: trimmedMessage }]
        const dismissedLine = buildFollowDismissalLine(followerCharacter.characterName)
        const dismissedStatusLine = buildFollowDismissedStatusLine(followerCharacter.characterName)
        setConversationLog([...nextLogWithPlayer, dismissedLine, dismissedStatusLine])
        conversationMemoryRef.current = appendConversationMemory(conversationMemoryRef.current, [dismissedLine])
        setFollowerCharacterId(null)
        setGonfData((previousGonfData) => {
          if (!previousGonfData) {
            return previousGonfData
          }
          return {
            ...previousGonfData,
            characters: previousGonfData.characters.map((character) =>
              character.characterId === followerCharacter.characterId
                ? { ...character, characterLocation: character.originalLocation || character.characterLocation }
                : character,
            ),
          }
        })
        return
      }
    }

    const giveRequest = detectItemGiveToCharacterRequest(trimmedMessage, playerCarriedItems, charactersInRoom)
    if (giveRequest) {
      const nextLogWithPlayer = [...conversationLog, { speaker: 'Player', text: trimmedMessage }]

      try {
        const transferResult = await postItemTransfer({
          itemId: giveRequest.item.itemId,
          characterId: giveRequest.character.characterId,
          toCharacter: true,
          action: 'give',
          playerItemIds,
          characters: buildCharacterTransferPayload(gonfData.characters),
          roomItemLocations: [],
        })
        applyItemTransferResult(transferResult)
        recordGiveTransfer(giveRequest.item.itemId, giveRequest.character.characterId)
        const statusLine = buildItemTransferStatusLine(giveRequest.item.itemName, 'Player', giveRequest.character.characterName)
        setConversationLog([...nextLogWithPlayer, statusLine])
        conversationMemoryRef.current = appendConversationMemory(conversationMemoryRef.current, [statusLine])
      } catch (error) {
        setConversationLog(nextLogWithPlayer)
        setConversationError(error?.message ?? 'Could not complete the item transfer.')
      }
      return
    }

    const requestFromCharacter = detectItemRequestFromCharacter(trimmedMessage, charactersInRoom, gonfData.items)
    if (requestFromCharacter) {
      const nextLogWithPlayer = [...conversationLog, { speaker: 'Player', text: trimmedMessage }]

      try {
        const transferResult = await postItemTransfer({
          itemId: requestFromCharacter.item.itemId,
          characterId: requestFromCharacter.character.characterId,
          toCharacter: false,
          action: 'give',
          playerItemIds,
          characters: buildCharacterTransferPayload(gonfData.characters),
          roomItemLocations: [],
        })
        applyItemTransferResult(transferResult)
        const statusLine = buildItemTransferStatusLine(
          requestFromCharacter.item.itemName,
          requestFromCharacter.character.characterName,
          'Player',
        )
        setConversationLog([...nextLogWithPlayer, statusLine])
        conversationMemoryRef.current = appendConversationMemory(conversationMemoryRef.current, [statusLine])
      } catch (error) {
        setConversationLog(nextLogWithPlayer)
        setConversationError(error?.message ?? 'Could not complete the item transfer.')
      }
      return
    }

    const followTarget = detectFollowRequestTarget(
      trimmedMessage,
      charactersInRoom.filter((character) => character.characterId !== followerCharacterId),
    )

    if (followTarget) {
      if (followerCharacter && followerCharacter.characterId !== followTarget.characterId) {
        const nextLogWithPlayer = [...conversationLog, { speaker: 'Player', text: trimmedMessage }]
        const askLine = buildAlreadyFollowingLine(followerCharacter.characterName, followTarget.characterName)
        setConversationLog([...nextLogWithPlayer, askLine])
        setPendingFollowSwap({
          currentFollowerId: followerCharacter.characterId,
          currentFollowerName: followerCharacter.characterName,
          requestedCharacter: followTarget,
        })
        return
      }

      const nextLogWithPlayer = [...conversationLog, { speaker: 'Player', text: trimmedMessage }]
      const joinLine = buildFollowJoinLine(followTarget.characterName)
      const joinStatusLine = buildFollowStatusLine(followTarget.characterName)
      setConversationLog([...nextLogWithPlayer, joinLine, joinStatusLine])
      conversationMemoryRef.current = appendConversationMemory(conversationMemoryRef.current, [joinLine])
      setFollowerCharacterId(followTarget.characterId)
      setEverFollowedCharacterIds((previousIds) => {
        const nextIds = new Set(previousIds)
        nextIds.add(Number(followTarget.characterId))
        return nextIds
      })
      return
    }

    const transcriptSoFar = conversationLog.map((entry) => ({ speaker: entry.speaker, text: entry.text }))
    const nextLogWithPlayer = [...conversationLog, { speaker: 'Player', text: trimmedMessage }]

    setConversationLog(nextLogWithPlayer)
    setIsConversationLoading(true)

    try {
      const { lines, updatedCharacterMemory } = await fetchConversationTurn({
        roomName: currentRoom.roomName,
        roomDescription: currentRoom.roomDescription,
        characters: charactersInRoom,
        items: gonfData.items,
        transcript: [...transcriptSoFar, { speaker: 'Player', text: trimmedMessage }],
        playerMessage: trimmedMessage,
        previousLines: conversationMemoryRef.current,
        characterMemory: characterMemoryRef.current,
        gonfName: gonfData.gonfName,
        saveId: DEFAULT_SAVE_ID,
        playerHeldItemIds: playerItemIds,
        goal: gonfData.goal,
      })

      const newEntries = lines.map((line) => ({ speaker: line.speaker, text: line.text }))
      setConversationLog((previousLog) => [...previousLog, ...newEntries])
      conversationMemoryRef.current = appendConversationMemory(conversationMemoryRef.current, newEntries)
      characterMemoryRef.current = updatedCharacterMemory
      markCharactersSpoken(charactersInRoom)

      const offeredItem = lines
        .map((line) => detectItemOfferInLine(line, charactersInRoom, gonfData.items))
        .find(Boolean)
      if (offeredItem) {
        try {
          const transferResult = await postItemTransfer({
            itemId: offeredItem.item.itemId,
            characterId: offeredItem.character.characterId,
            toCharacter: false,
            action: 'give',
            playerItemIds,
            characters: buildCharacterTransferPayload(gonfData.characters),
            roomItemLocations: [],
          })
          applyItemTransferResult(transferResult)
          const statusLine = buildItemTransferStatusLine(
            offeredItem.item.itemName,
            offeredItem.character.characterName,
            'Player',
          )
          setConversationLog((previousLog) => [...previousLog, statusLine])
          conversationMemoryRef.current = appendConversationMemory(conversationMemoryRef.current, [statusLine])
        } catch (error) {
          setConversationError(error?.message ?? 'Could not complete the item transfer.')
        }
      }
    } catch (error) {
      setConversationError(error?.message ?? 'Could not reach the conversation service.')
    } finally {
      setIsConversationLoading(false)
    }
  }

  const onNavigate = (direction) => {
    if (!currentRoom || hasWon) {
      return
    }

    const targetRoomId = currentRoom.exits[direction]
    if (targetRoomId === null || targetRoomId === undefined) {
      return
    }

    setGonfData((previousGonfData) => {
      if (!previousGonfData) {
        return previousGonfData
      }

      const previousCharactersInTargetRoom = getCharactersInRoom(previousGonfData.characters, targetRoomId)
      const nextCharacters = wanderCharacters(previousGonfData.rooms, previousGonfData.characters, Math.random, followerCharacterId)
      const finalCharacters = followerCharacterId
        ? nextCharacters.map((character) =>
            character.characterId === followerCharacterId
              ? { ...character, characterLocation: String(targetRoomId) }
              : character,
          )
        : nextCharacters
      const nextCharactersInTargetRoom = getCharactersInRoom(finalCharacters, targetRoomId)

      const departedWandererNames = getDepartedWandererNames(
        previousCharactersInTargetRoom,
        nextCharactersInTargetRoom,
      )
      setMissedWandererMessage(buildMissedWandererLine(nextCharactersInTargetRoom, departedWandererNames))

      return {
        ...previousGonfData,
        characters: finalCharacters,
      }
    })
    setCurrentRoomId(targetRoomId)
    setVisitedRoomIds((previousVisited) => {
      const nextVisited = new Set(previousVisited)
      nextVisited.add(Number(targetRoomId))
      return nextVisited
    })
  }

  if (!gonfData || !currentRoom) {
    return (
      <main className="gp-load-screen">
        <h1>Gonf Player</h1>
        <p>Load a saved Gonf file (.json) to begin playing.</p>
        <label className="gp-load-button">
          Load Gonf File
          <input type="file" accept="application/json,.json" onChange={onFileChange} />
        </label>
        {loadError && (
          <p className="gp-error" role="alert">
            {loadError}
          </p>
        )}
      </main>
    )
  }

  return (
    <main className="gp-room-screen">
      <h1>{currentRoom.roomName}</h1>
      <section className="gp-room-image-frame" aria-label="Room view">
        {currentRoom.image?.previewDataUrl ? (
          <img src={currentRoom.image.previewDataUrl} alt={`View of ${currentRoom.roomName}`} />
        ) : (
          <div className="gp-room-image-empty">No image available.</div>
        )}

        {overlayCharacters.length > 0 && (
          <div className="gp-room-character-overlays" style={{ '--gp-overlay-count': visibleOverlayCharacters.length }}>
            {visibleOverlayCharacters.map((character) => (
              <div key={character.characterId} className="gp-room-character-overlay-frame">
                <img
                  className="gp-room-character-overlay"
                  src={character.image.previewDataUrl}
                  alt={`${character.characterName} in ${currentRoom.roomName}`}
                  title={character.characterName}
                />
              </div>
            ))}
            {hiddenOverlayCount > 0 && (
              <div
                className="gp-room-character-overlay-more"
                title={`${hiddenOverlayCount} more character${hiddenOverlayCount === 1 ? '' : 's'} in this room`}
              >
                +{hiddenOverlayCount}
              </div>
            )}
          </div>
        )}

        {validExits.map((direction) => (
          <button
            key={direction}
            type="button"
            className={`gp-nav-button gp-nav-${direction} ${staircaseDirections.has(direction) ? 'gp-nav-staircase' : ''}`}
            onClick={() => onNavigate(direction)}
            aria-label={`Go ${directionLabels[direction]}`}
            title={`Go ${directionLabels[direction]}`}
            disabled={hasWon}
          >
            <DirectionIcon direction={direction} />
          </button>
        ))}
      </section>

      <p className="gp-room-narration">{narrationText}</p>
      {missedWandererMessage && (
        <p className="gp-room-dialogue">
          {missedWandererMessage.speaker}: &ldquo;{missedWandererMessage.line}&rdquo;
        </p>
      )}

      <section className="gp-conversation-panel" aria-label="Conversation">
        <div className="gp-conversation-log">
          {conversationLog.length === 0 && !isConversationLoading && !conversationError && (
            <p className="gp-conversation-empty">...</p>
          )}
          {conversationLog.map((entry, index) => (
            <p
              key={`${entry.speaker}-${index}`}
              className={
                entry.speaker === 'Player'
                  ? 'gp-conversation-line gp-conversation-line-player'
                  : entry.speaker === 'System'
                    ? 'gp-conversation-line gp-conversation-line-system'
                    : 'gp-conversation-line'
              }
              style={entry.speaker !== 'Player' && entry.speaker !== 'System' ? { color: speakerColorAssignments.get(entry.speaker) } : undefined}
            >
              {entry.speaker === 'System' ? entry.text : (
                <>
                  <strong>{entry.speaker}:</strong> {entry.text}
                </>
              )}
            </p>
          ))}
          {isConversationLoading && (
            <p className="gp-conversation-typing" aria-live="polite">
              <span className="gp-typing-label">
                {charactersInRoom.length === 1
                  ? `${charactersInRoom[0].characterName} is typing`
                  : 'Someone is typing'}
              </span>
              <span className="gp-typing-dots">
                <span className="gp-typing-dot" />
                <span className="gp-typing-dot" />
                <span className="gp-typing-dot" />
              </span>
            </p>
          )}
          {conversationError && (
            <p className="gp-conversation-error" role="alert">
              {conversationError}
            </p>
          )}
        </div>
        <form className="gp-conversation-input-row" onSubmit={onSubmitConversation}>
          <input
            type="text"
            className="gp-conversation-input"
            value={conversationDraft}
            onChange={(event) => setConversationDraft(event.target.value)}
            placeholder={
              pendingConfession
                ? 'Press Enter to continue...'
                : charactersInRoom.length > 0
                  ? 'Say something...'
                  : 'Type a command, e.g. /inventory or /help...'
            }
            disabled={isConversationLoading || hasWon || hasLost}
          />
          <button type="submit" className="gp-conversation-send" disabled={isConversationLoading || hasWon || hasLost || (!pendingConfession && !conversationDraft.trim())}>
            {isConversationLoading ? 'Waiting...' : pendingConfession ? 'Continue' : 'Send'}
          </button>
        </form>
      </section>

      {hasWon && (
        <div className="gp-win-overlay" role="alertdialog" aria-label="You won">
          <p className="gp-win-overlay-text">YOU WON!</p>
        </div>
      )}

      {hasLost && (
        <div className="gp-lose-overlay" role="alertdialog" aria-label="Game over">
          <p className="gp-lose-overlay-text">GAME OVER</p>
        </div>
      )}
    </main>
  )
}

export default GonfPlayerApp


