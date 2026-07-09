import { useMemo, useState } from 'react'

const floors = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]

const mockRooms = [
  {
    roomId: 1,
    roomName: 'Entry Hall',
    roomDescription: 'Main entry point for visitors.',
    roomFloor: 1,
    x: 2,
    y: 1,
    exits: { north: 2, east: 3, south: null, west: null, up: 5, down: null },
  },
  {
    roomId: 2,
    roomName: 'Atrium',
    roomDescription: 'Open chamber with overhead skylight.',
    roomFloor: 1,
    x: 2,
    y: 0,
    exits: { north: null, east: 4, south: 1, west: null, up: null, down: null },
  },
  {
    roomId: 3,
    roomName: 'Archive',
    roomDescription: 'Storage and records room.',
    roomFloor: 1,
    x: 3,
    y: 1,
    exits: { north: 4, east: null, south: null, west: 1, up: null, down: null },
  },
  {
    roomId: 4,
    roomName: 'Observation Deck',
    roomDescription: 'Upper overlook for navigation checks.',
    roomFloor: 1,
    x: 3,
    y: 0,
    exits: { north: null, east: null, south: 3, west: 2, up: null, down: null },
  },
  {
    roomId: 5,
    roomName: 'Control Loft',
    roomDescription: 'Vertical control space above the entry floor.',
    roomFloor: 2,
    x: 2,
    y: 1,
    exits: { north: null, east: null, south: null, west: null, up: null, down: 1 },
  },
  {
    roomId: 6,
    roomName: 'Maintenance Tunnel',
    roomDescription: 'Subground maintenance route.',
    roomFloor: -1,
    x: 1,
    y: 1,
    exits: { north: null, east: null, south: null, west: null, up: 1, down: 7 },
  },
  {
    roomId: 7,
    roomName: 'Pump Room',
    roomDescription: 'Utilities and pressure systems.',
    roomFloor: -2,
    x: 1,
    y: 2,
    exits: { north: 6, east: null, south: null, west: null, up: 6, down: null },
  },
]

function getTargetFloor(selectedFloor, direction) {
  if (selectedFloor === null || direction === '') {
    return null
  }

  if (direction === 'up') {
    const next = selectedFloor + 1
    return next === 0 ? selectedFloor + 2 : next
  }

  const next = selectedFloor - 1
  return next === 0 ? selectedFloor - 2 : next
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

export default function GonfGeneratorMockup() {
  const [activeFloor, setActiveFloor] = useState(1)
  const [selectedFloor, setSelectedFloor] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState(1)

  const roomsById = useMemo(() => {
    const map = new Map()
    for (const room of mockRooms) {
      map.set(room.roomId, room)
    }
    return map
  }, [])

  const floorRooms = useMemo(
    () => mockRooms.filter((room) => room.roomFloor === activeFloor),
    [activeFloor],
  )

  const selectedFloorNumber = selectedFloor === '' ? null : Number(selectedFloor)
  const upTargetFloor = getTargetFloor(selectedFloorNumber, 'up')
  const downTargetFloor = getTargetFloor(selectedFloorNumber, 'down')

  const horizontalExitOptions = mockRooms
    .filter((room) => room.roomFloor === selectedFloorNumber)
    .map((room) => ({ value: room.roomId, label: room.roomName }))

  const upExitOptions =
    upTargetFloor === null
      ? []
      : mockRooms
          .filter((room) => room.roomFloor === upTargetFloor)
          .map((room) => ({ value: room.roomId, label: room.roomName }))

  const downExitOptions =
    downTargetFloor === null
      ? []
      : mockRooms
          .filter((room) => room.roomFloor === downTargetFloor)
          .map((room) => ({ value: room.roomId, label: room.roomName }))

  const selectedRoom = roomsById.get(selectedRoomId) ?? floorRooms[0] ?? null
  const floorConnections = useMemo(() => buildFloorConnections(floorRooms, roomsById), [floorRooms, roomsById])

  return (
    <main className="app-shell">
      <section className="panel intro-panel gg-intro">
        <p className="eyebrow">Gonf / Epic 006 Mockup</p>
        <h1>Gonf Generator</h1>
        <p>
          Business preview of Create New Gonf, Load Existing Gonf, room editing, and map visualization.
          This is a frontend mockup for review and does not persist live data yet.
        </p>
      </section>

      <section className="panel gg-workflow">
        <div className="gg-top-actions">
          <div className="gg-action-group" aria-label="Gonf Load/Create Actions">
            <button type="button">Create New Gonf</button>
            <label className="gg-load-button">
              Load Existing Gonf
              <input type="file" accept=".json,application/json" />
            </label>
          </div>
          <label className="gg-field gg-gonf-name">
            <span>Gonf Name</span>
            <input type="text" placeholder="Bobs_awesome_gonf" defaultValue="Bobs_awesome_gonf" />
          </label>
        </div>

        <div className="gg-form-grid">
          <input type="hidden" name="roomId" value="" />

          <label className="gg-field">
            <span>Room Name</span>
            <input type="text" placeholder="Unique room name" defaultValue="Entry Hall" />
          </label>

          <label className="gg-field gg-wide">
            <span>Room Description</span>
            <textarea rows={3} defaultValue="Main entry point for visitors." />
          </label>

          <label className="gg-field">
            <span>Room Floor</span>
            <select value={selectedFloor} onChange={(event) => setSelectedFloor(event.target.value)}>
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
              <select disabled={selectedFloor === ''}>
                <option value="">{selectedFloor === '' ? 'Select floor first' : 'None'}</option>
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
              <select>
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
              <select>
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
              <select>
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
              <select>
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
              <select disabled={selectedFloor === ''}>
                <option value="">{selectedFloor === '' ? 'Select floor first' : 'None'}</option>
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
          <button type="button" className="gg-save-button">
            Save Room
          </button>
          <button type="button" className="gg-clear-button">
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
          <p className="muted">No rooms on Floor {activeFloor} in this mockup.</p>
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
                  onClick={() => setSelectedRoomId(room.roomId)}
                >
                  <span>{room.roomName}</span>
                </button>
              ))}
            </div>

            {selectedRoom && (
              <aside className="gg-room-popover" aria-live="polite">
                <h3>{selectedRoom.roomName}</h3>
                <p>{selectedRoom.roomDescription}</p>
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
