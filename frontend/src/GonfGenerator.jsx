import { useMemo, useState } from 'react'

const floors = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]

function createEmptyForm() {
  return {
    roomId: null,
    roomName: '',
    roomDescription: '',
    roomFloor: '',
    northExit: '',
    eastExit: '',
    southExit: '',
    westExit: '',
    upExit: '',
    downExit: '',
  }
}

function toNullableNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

function getTargetFloor(selectedFloor, direction) {
  if (selectedFloor === null || direction === '') {
    return null
  }

  if (direction === 'up') {
    const next = selectedFloor + 1
    const target = next === 0 ? selectedFloor + 2 : next
    return floors.includes(target) ? target : null
  }

  const next = selectedFloor - 1
  const target = next === 0 ? selectedFloor - 2 : next
  return floors.includes(target) ? target : null
}

function roomNameById(roomsById, roomId) {
  if (!roomId) {
    return 'None'
  }

  return roomsById.get(roomId)?.roomName ?? `Room ${roomId}`
}

function buildFloorConnections(floorRooms, roomsById) {
  const lineKeys = new Set()
  const lines = []

  for (const room of floorRooms) {
    for (const direction of ['north', 'east', 'south', 'west']) {
      const targetId = room.exits[direction]
      if (!targetId) {
        continue
      }

      const targetRoom = roomsById.get(targetId)
      if (!targetRoom || targetRoom.roomFloor !== room.roomFloor) {
        continue
      }

      const low = Math.min(room.roomId, targetRoom.roomId)
      const high = Math.max(room.roomId, targetRoom.roomId)
      const key = `${low}-${high}`

      if (lineKeys.has(key)) {
        continue
      }

      lineKeys.add(key)
      lines.push({ from: room, to: targetRoom })
    }
  }

  return lines
}

function getRoomCenter(room) {
  const gridColumns = 5
  const gridRows = 4

  return {
    x: ((room.x + 0.5) / gridColumns) * 100,
    y: ((room.y + 0.5) / gridRows) * 100,
  }
}

function computeNextCoordinates(rooms, roomFloor) {
  const onFloor = rooms.filter((room) => room.roomFloor === roomFloor)
  const slot = onFloor.length
  return {
    x: slot % 5,
    y: Math.floor(slot / 5) % 4,
  }
}

function mapRoomForState(rawRoom, indexOnFloor) {
  return {
    roomId: Number(rawRoom.roomId),
    roomName: String(rawRoom.roomName ?? ''),
    roomDescription: String(rawRoom.roomDescription ?? ''),
    roomFloor: Number(rawRoom.roomFloor),
    x: Number.isInteger(rawRoom.x) ? rawRoom.x : indexOnFloor % 5,
    y: Number.isInteger(rawRoom.y) ? rawRoom.y : Math.floor(indexOnFloor / 5) % 4,
    exits: {
      north: toNullableNumber(rawRoom.exits?.north ?? rawRoom.northExit),
      east: toNullableNumber(rawRoom.exits?.east ?? rawRoom.eastExit),
      south: toNullableNumber(rawRoom.exits?.south ?? rawRoom.southExit),
      west: toNullableNumber(rawRoom.exits?.west ?? rawRoom.westExit),
      up: toNullableNumber(rawRoom.exits?.up ?? rawRoom.upExit),
      down: toNullableNumber(rawRoom.exits?.down ?? rawRoom.downExit),
    },
  }
}

function parseLoadedGonf(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.rooms)) {
    throw new Error('File is missing a valid rooms array.')
  }

  const floorCounts = new Map()
  const rooms = payload.rooms
    .map((rawRoom) => {
      const roomFloor = Number(rawRoom.roomFloor)
      if (!Number.isFinite(roomFloor) || !floors.includes(roomFloor)) {
        return null
      }

      const count = floorCounts.get(roomFloor) ?? 0
      floorCounts.set(roomFloor, count + 1)

      return mapRoomForState(rawRoom, count)
    })
    .filter(Boolean)

  return {
    gonfName: String(payload.gonfName ?? ''),
    rooms,
  }
}

export default function GonfGenerator() {
  const [gonfName, setGonfName] = useState('')
  const [rooms, setRooms] = useState([])
  const [form, setForm] = useState(createEmptyForm())
  const [activeFloor, setActiveFloor] = useState(1)
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [loadInputKey, setLoadInputKey] = useState(0)

  const roomsById = useMemo(() => {
    const map = new Map()
    for (const room of rooms) {
      map.set(room.roomId, room)
    }
    return map
  }, [rooms])

  const floorRooms = useMemo(() => rooms.filter((room) => room.roomFloor === activeFloor), [rooms, activeFloor])
  const selectedFloorNumber = form.roomFloor === '' ? null : Number(form.roomFloor)
  const upTargetFloor = getTargetFloor(selectedFloorNumber, 'up')
  const downTargetFloor = getTargetFloor(selectedFloorNumber, 'down')
  const floorConnections = useMemo(() => buildFloorConnections(floorRooms, roomsById), [floorRooms, roomsById])

  const horizontalExitOptions = rooms
    .filter((room) => room.roomFloor === selectedFloorNumber && room.roomId !== toNullableNumber(form.roomId))
    .map((room) => ({ value: room.roomId, label: room.roomName }))

  const upExitOptions =
    upTargetFloor === null
      ? []
      : rooms
          .filter((room) => room.roomFloor === upTargetFloor && room.roomId !== toNullableNumber(form.roomId))
          .map((room) => ({ value: room.roomId, label: room.roomName }))

  const downExitOptions =
    downTargetFloor === null
      ? []
      : rooms
          .filter((room) => room.roomFloor === downTargetFloor && room.roomId !== toNullableNumber(form.roomId))
          .map((room) => ({ value: room.roomId, label: room.roomName }))

  const selectedRoom = roomsById.get(selectedRoomId) ?? floorRooms[0] ?? null

  const onFormChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const onCreateNewGonf = () => {
    // GONF-006C: this action intentionally clears all in-memory Gonf and map state.
    setGonfName('')
    setRooms([])
    setForm(createEmptyForm())
    setSelectedRoomId(null)
    setActiveFloor(1)
    setStatusMessage('Started a new Gonf. Form and map are cleared until you save a room or load a Gonf.')
    setLoadInputKey((key) => key + 1)
  }

  const onClearForm = () => {
    setForm(createEmptyForm())
    setSelectedRoomId(null)
    setStatusMessage('Cleared room form fields.')
  }

  const onSelectRoom = (room) => {
    setSelectedRoomId(room.roomId)
    setForm({
      roomId: room.roomId,
      roomName: room.roomName,
      roomDescription: room.roomDescription,
      roomFloor: String(room.roomFloor),
      northExit: room.exits.north ? String(room.exits.north) : '',
      eastExit: room.exits.east ? String(room.exits.east) : '',
      southExit: room.exits.south ? String(room.exits.south) : '',
      westExit: room.exits.west ? String(room.exits.west) : '',
      upExit: room.exits.up ? String(room.exits.up) : '',
      downExit: room.exits.down ? String(room.exits.down) : '',
    })
    setStatusMessage(`Loaded room ${room.roomName} into the form.`)
  }

  const onSaveRoom = () => {
    if (!gonfName.trim()) {
      setStatusMessage('Gonf Name is required before saving rooms.')
      return
    }

    if (!form.roomName.trim()) {
      setStatusMessage('Room Name is required.')
      return
    }

    if (form.roomFloor === '') {
      setStatusMessage('Room Floor is required.')
      return
    }

    const roomFloor = Number(form.roomFloor)
    const editingRoomId = toNullableNumber(form.roomId)

    setRooms((currentRooms) => {
      const nextRoomId = editingRoomId ?? (Math.max(0, ...currentRooms.map((room) => room.roomId)) + 1)
      const existing = currentRooms.find((room) => room.roomId === nextRoomId)

      const coords = existing && existing.roomFloor === roomFloor
        ? { x: existing.x, y: existing.y }
        : computeNextCoordinates(currentRooms.filter((room) => room.roomId !== nextRoomId), roomFloor)

      const savedRoom = {
        roomId: nextRoomId,
        roomName: form.roomName.trim(),
        roomDescription: form.roomDescription.trim(),
        roomFloor,
        x: coords.x,
        y: coords.y,
        exits: {
          north: toNullableNumber(form.northExit),
          east: toNullableNumber(form.eastExit),
          south: toNullableNumber(form.southExit),
          west: toNullableNumber(form.westExit),
          up: toNullableNumber(form.upExit),
          down: toNullableNumber(form.downExit),
        },
      }

      const nextRooms = existing
        ? currentRooms.map((room) => (room.roomId === nextRoomId ? savedRoom : room))
        : [...currentRooms, savedRoom]

      setSelectedRoomId(nextRoomId)
      setActiveFloor(roomFloor)
      setForm(createEmptyForm())
      setStatusMessage(`Saved room ${savedRoom.roomName} to Gonf ${gonfName.trim()}.`)

      return nextRooms
    })
  }

  const onLoadExistingGonf = async (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      const loaded = parseLoadedGonf(payload)
      const inferredName = loaded.gonfName || file.name.replace(/\.json$/i, '')

      setGonfName(inferredName)
      setRooms(loaded.rooms)
      setForm(createEmptyForm())
      setSelectedRoomId(loaded.rooms[0]?.roomId ?? null)
      setActiveFloor(loaded.rooms[0]?.roomFloor ?? 1)
      setStatusMessage(`Loaded ${loaded.rooms.length} room(s) from ${file.name}.`)
    } catch (error) {
      setStatusMessage(`Load failed: ${error instanceof Error ? error.message : 'Invalid Gonf JSON file.'}`)
    }
  }

  return (
    <main className="app-shell">
      <section className="panel intro-panel gg-intro">
        <p className="eyebrow">Gonf / Epic 006</p>
        <h1>Gonf Generator</h1>
        <p>Create, load, and maintain Gonf room data. The map remains empty until rooms are saved or loaded.</p>
      </section>

      <section className="panel gg-workflow">
        <div className="gg-top-actions">
          <div className="gg-action-group" aria-label="Gonf Load/Create Actions">
            <button type="button" onClick={onCreateNewGonf}>
              Create New Gonf
            </button>
            <label className="gg-load-button">
              Load Existing Gonf
              <input
                key={loadInputKey}
                type="file"
                accept=".json,application/json"
                onChange={onLoadExistingGonf}
              />
            </label>
          </div>
          <label className="gg-field gg-gonf-name">
            <span>Gonf Name</span>
            <input
              type="text"
              placeholder="Bobs_awesome_gonf"
              value={gonfName}
              onChange={(event) => setGonfName(event.target.value)}
            />
          </label>
        </div>

        {statusMessage && <output className="status status-info">{statusMessage}</output>}

        <div className="gg-form-grid">
          <input type="hidden" name="roomId" value={form.roomId ?? ''} />

          <label className="gg-field">
            <span>Room Name</span>
            <input
              type="text"
              placeholder="Unique room name"
              value={form.roomName}
              onChange={(event) => onFormChange('roomName', event.target.value)}
            />
          </label>

          <label className="gg-field gg-wide">
            <span>Room Description</span>
            <textarea
              rows={3}
              value={form.roomDescription}
              onChange={(event) => onFormChange('roomDescription', event.target.value)}
            />
          </label>

          <label className="gg-field">
            <span>Room Floor</span>
            <select value={form.roomFloor} onChange={(event) => onFormChange('roomFloor', event.target.value)}>
              <option value="">Select floor</option>
              {floors.map((floor) => (
                <option key={floor} value={floor}>
                  {floor}
                </option>
              ))}
            </select>
          </label>

          <section className="gg-exit-compass" aria-label="Compass Exits">
            <h3>Exits</h3>

            <label className="gg-field gg-exit-up">
              <span>Up Exit</span>
              <select
                value={form.upExit}
                disabled={form.roomFloor === ''}
                onChange={(event) => onFormChange('upExit', event.target.value)}
              >
                <option value="">{form.roomFloor === '' ? 'Select floor first' : 'None'}</option>
                {upExitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small>Target floor: {upTargetFloor ?? '-'}</small>
            </label>

            <span className="gg-compass-icon gg-compass-up" aria-hidden="true">
              ↑
            </span>

            <label className="gg-field gg-exit-north">
              <span>North Exit</span>
              <select value={form.northExit} onChange={(event) => onFormChange('northExit', event.target.value)}>
                <option value="">None</option>
                {horizontalExitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <span className="gg-compass-icon gg-compass-ns" aria-hidden="true">
              ↑
            </span>

            <label className="gg-field gg-exit-west">
              <span>West Exit</span>
              <select value={form.westExit} onChange={(event) => onFormChange('westExit', event.target.value)}>
                <option value="">None</option>
                {horizontalExitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <span className="gg-compass-icon gg-compass-ew" aria-hidden="true">
              ↔
            </span>

            <label className="gg-field gg-exit-east">
              <span>East Exit</span>
              <select value={form.eastExit} onChange={(event) => onFormChange('eastExit', event.target.value)}>
                <option value="">None</option>
                {horizontalExitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <span className="gg-compass-icon gg-compass-south" aria-hidden="true">
              ↓
            </span>

            <label className="gg-field gg-exit-south">
              <span>South Exit</span>
              <select value={form.southExit} onChange={(event) => onFormChange('southExit', event.target.value)}>
                <option value="">None</option>
                {horizontalExitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <span className="gg-compass-icon gg-compass-down" aria-hidden="true">
              ↓
            </span>

            <label className="gg-field gg-exit-down">
              <span>Down Exit</span>
              <select
                value={form.downExit}
                disabled={form.roomFloor === ''}
                onChange={(event) => onFormChange('downExit', event.target.value)}
              >
                <option value="">{form.roomFloor === '' ? 'Select floor first' : 'None'}</option>
                {downExitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small>Target floor: {downTargetFloor ?? '-'}</small>
            </label>
          </section>
        </div>

        <div className="gg-button-row">
          <button type="button" className="gg-save-button" onClick={onSaveRoom}>
            Save Room
          </button>
          <button type="button" className="gg-clear-button" onClick={onClearForm}>
            Clear
          </button>
        </div>
      </section>

      <section className="panel gg-map-panel">
        <h2>The Map</h2>
        <div className="gg-floor-tabs" role="tablist" aria-label="Gonf Floors">
          {floors.map((floor) => (
            <button
              key={floor}
              type="button"
              role="tab"
              aria-selected={activeFloor === floor}
              className={`gg-floor-tab ${activeFloor === floor ? 'is-active' : ''}`}
              onClick={() => setActiveFloor(floor)}
            >
              Floor {floor}
            </button>
          ))}
        </div>

        {floorRooms.length === 0 ? (
          <p className="muted">Map is empty for Floor {activeFloor}. Save a room or load an existing Gonf.</p>
        ) : (
          <div className="gg-map-layout">
            <div className="gg-map-canvas" role="application" aria-label="Room map canvas">
              <svg className="gg-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {floorConnections.map((line, index) => {
                  const from = getRoomCenter(line.from)
                  const to = getRoomCenter(line.to)
                  return (
                    <line
                      key={`${line.from.roomId}-${line.to.roomId}-${index}`}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                    />
                  )
                })}
              </svg>

              {floorRooms.map((room) => (
                <button
                  key={room.roomId}
                  type="button"
                  className={`gg-room-card ${selectedRoomId === room.roomId ? 'is-selected' : ''}`}
                  style={{ gridColumn: room.x + 1, gridRow: room.y + 1 }}
                  onClick={() => onSelectRoom(room)}
                >
                  <span>{room.roomName}</span>
                </button>
              ))}
            </div>

            {selectedRoom && (
              <aside className="gg-room-popover" aria-live="polite">
                <h3>{selectedRoom.roomName}</h3>
                <p>{selectedRoom.roomDescription || 'No description.'}</p>
                <ul>
                  <li>North: {roomNameById(roomsById, selectedRoom.exits.north)}</li>
                  <li>East: {roomNameById(roomsById, selectedRoom.exits.east)}</li>
                  <li>South: {roomNameById(roomsById, selectedRoom.exits.south)}</li>
                  <li>West: {roomNameById(roomsById, selectedRoom.exits.west)}</li>
                  <li>Up: {roomNameById(roomsById, selectedRoom.exits.up)}</li>
                  <li>Down: {roomNameById(roomsById, selectedRoom.exits.down)}</li>
                </ul>
              </aside>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
