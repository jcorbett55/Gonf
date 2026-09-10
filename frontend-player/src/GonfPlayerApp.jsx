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
} from './gonf/gonfEngine'
import { directionLabels } from './gonf/shared'
import { fetchConversationTurn } from './gonf/conversationClient'

const MAX_VISIBLE_ROOM_OVERLAYS = 4
const staircaseDirections = new Set(['up', 'down'])
const SPEAKER_COLOR_HUES = [210, 15, 145, 45, 280, 0, 190, 320]

function getSpeakerColor(speakerName) {
  if (speakerName === 'Player') {
    return null
  }

  let hash = 0
  for (let index = 0; index < speakerName.length; index += 1) {
    hash = (hash * 31 + speakerName.charCodeAt(index)) >>> 0
  }

  const hue = SPEAKER_COLOR_HUES[hash % SPEAKER_COLOR_HUES.length]
  return `hsl(${hue}, 70%, 72%)`
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
  const conversationRoomKeyRef = useRef(null)
  const conversationMemoryRef = useRef([])

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
      const parsed = parseLoadedGonf(payload)
      const startingRoomId = resolveStartingRoomId(parsed.rooms)

      if (startingRoomId === null) {
        setLoadError('This Gonf file does not contain any rooms to start in.')
        return
      }

      setGonfData(parsed)
      setCurrentRoomId(startingRoomId)
      setMissedWandererMessage(null)
      conversationMemoryRef.current = []
    } catch (error) {
      setLoadError(error?.message ?? 'Could not load this Gonf file. Please verify it is valid.')
      setGonfData(null)
      setCurrentRoomId(null)
      setMissedWandererMessage(null)
      conversationMemoryRef.current = []
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

  const overlayCharacters = useMemo(
    () => (gonfData ? getOverlayEligibleCharactersInRoom(gonfData.characters, currentRoomId) : []),
    [gonfData, currentRoomId],
  )
  const visibleOverlayCharacters = overlayCharacters.slice(0, MAX_VISIBLE_ROOM_OVERLAYS)
  const hiddenOverlayCount = Math.max(0, overlayCharacters.length - MAX_VISIBLE_ROOM_OVERLAYS)

  const validExits = useMemo(() => (currentRoom ? getValidExits(currentRoom) : []), [currentRoom])

  const narrationText = useMemo(
    () => (currentRoom ? buildRoomNarrationText(currentRoom, charactersInRoom) : ''),
    [currentRoom, charactersInRoom],
  )

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

    if (charactersInRoom.length === 0) {
      return
    }

    let cancelled = false
    setIsConversationLoading(true)

    fetchConversationTurn({
      roomName: currentRoom.roomName,
      roomDescription: currentRoom.roomDescription,
      characters: charactersInRoom,
      transcript: [],
      playerMessage: null,
      previousLines: conversationMemoryRef.current,
    })
      .then((lines) => {
        if (cancelled) {
          return
        }
        const newEntries = lines.map((line) => ({ speaker: line.speaker, text: line.text }))
        setConversationLog(newEntries)
        conversationMemoryRef.current = [...conversationMemoryRef.current, ...newEntries]
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
  }, [currentRoom, currentRoomId, charactersInRoom])

  const onSubmitConversation = async (event) => {
    event.preventDefault()

    const trimmedMessage = conversationDraft.trim()
    if (!trimmedMessage || !currentRoom || charactersInRoom.length === 0 || isConversationLoading) {
      return
    }

    const transcriptSoFar = conversationLog.map((entry) => ({ speaker: entry.speaker, text: entry.text }))
    const nextLogWithPlayer = [...conversationLog, { speaker: 'Player', text: trimmedMessage }]

    setConversationLog(nextLogWithPlayer)
    setConversationDraft('')
    setConversationError('')
    setIsConversationLoading(true)

    try {
      const lines = await fetchConversationTurn({
        roomName: currentRoom.roomName,
        roomDescription: currentRoom.roomDescription,
        characters: charactersInRoom,
        transcript: [...transcriptSoFar, { speaker: 'Player', text: trimmedMessage }],
        playerMessage: trimmedMessage,
        previousLines: conversationMemoryRef.current,
      })

      const newEntries = lines.map((line) => ({ speaker: line.speaker, text: line.text }))
      setConversationLog((previousLog) => [...previousLog, ...newEntries])
      conversationMemoryRef.current = [...conversationMemoryRef.current, ...newEntries]
    } catch (error) {
      setConversationError(error?.message ?? 'Could not reach the conversation service.')
    } finally {
      setIsConversationLoading(false)
    }
  }

  const onNavigate = (direction) => {
    if (!currentRoom) {
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
      const nextCharacters = wanderCharacters(previousGonfData.rooms, previousGonfData.characters)
      const nextCharactersInTargetRoom = getCharactersInRoom(nextCharacters, targetRoomId)

      const departedWandererNames = getDepartedWandererNames(
        previousCharactersInTargetRoom,
        nextCharactersInTargetRoom,
      )
      setMissedWandererMessage(buildMissedWandererLine(nextCharactersInTargetRoom, departedWandererNames))

      return {
        ...previousGonfData,
        characters: nextCharacters,
      }
    })
    setCurrentRoomId(targetRoomId)
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
          <div className="gp-room-character-overlays">
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

      {charactersInRoom.length > 0 && (
        <section className="gp-conversation-panel" aria-label="Conversation">
          <div className="gp-conversation-log">
            {conversationLog.length === 0 && !isConversationLoading && !conversationError && (
              <p className="gp-conversation-empty">...</p>
            )}
            {conversationLog.map((entry, index) => (
              <p
                key={`${entry.speaker}-${index}`}
                className={entry.speaker === 'Player' ? 'gp-conversation-line gp-conversation-line-player' : 'gp-conversation-line'}
                style={entry.speaker !== 'Player' ? { color: getSpeakerColor(entry.speaker) } : undefined}
              >
                <strong>{entry.speaker}:</strong> {entry.text}
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
              placeholder="Say something..."
              disabled={isConversationLoading}
            />
            <button type="submit" className="gp-conversation-send" disabled={isConversationLoading || !conversationDraft.trim()}>
              {isConversationLoading ? 'Waiting...' : 'Send'}
            </button>
          </form>
        </section>
      )}
    </main>
  )
}

export default GonfPlayerApp


