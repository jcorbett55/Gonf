import { useMemo, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5131'
const floors = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]
const planarDirections = ['north', 'east', 'south', 'west']
const allDirections = ['north', 'east', 'south', 'west', 'up', 'down']
const oppositeDirection = {
  north: 'south',
  east: 'west',
  south: 'north',
  west: 'east',
  up: 'down',
  down: 'up',
}

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

function createEmptyItemForm() {
  return {
    itemId: null,
    itemName: '',
    itemWeight: '',
    itemDescription: '',
    itemValue: '',
    canHoldItems: false,
    canBeCarried: false,
    itemLocation: '',
    itemContents: [],
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

function buildFloorConnections(floorRooms) {
  const lineKeys = new Set()
  const lines = []
  const floorRoomMap = new Map(floorRooms.map((room) => [room.roomId, room]))

  for (const room of floorRooms) {
    for (const direction of planarDirections) {
      const targetId = room.exits[direction]
      if (!targetId) {
        continue
      }

      const targetRoom = floorRoomMap.get(targetId)
      if (!targetRoom) {
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

function getRoomCenter(room, gridColumns, gridRows) {
  return {
    x: ((room.x + 0.5) / gridColumns) * 100,
    y: ((room.y + 0.5) / gridRows) * 100,
  }
}

function findNearestOpenSlot(occupied, startX, startY) {
  const startKey = `${startX},${startY}`
  if (!occupied.has(startKey)) {
    return { x: startX, y: startY }
  }

  for (let radius = 1; radius <= 20; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        const x = startX + dx
        const y = startY + dy
        const key = `${x},${y}`
        if (!occupied.has(key)) {
          return { x, y }
        }
      }
    }
  }

  return { x: startX, y: startY }
}

function queueDirectionalNeighbors(room, roomById, placed, queue, slot, directionOffset) {
  for (const direction of planarDirections) {
    const targetId = room.exits[direction]
    if (!targetId || placed.has(targetId) || !roomById.has(targetId)) {
      continue
    }

    const delta = directionOffset[direction]
    queue.push({ roomId: targetId, x: slot.x + delta.x, y: slot.y + delta.y })
  }
}

function placeDirectionalComponent(seedRoomId, startX, roomById, occupied, placed, directionOffset) {
  const queue = [{ roomId: seedRoomId, x: startX, y: 0 }]

  while (queue.length > 0) {
    const next = queue.shift()
    if (!next || placed.has(next.roomId)) {
      continue
    }

    const room = roomById.get(next.roomId)
    if (!room) {
      continue
    }

    const slot = findNearestOpenSlot(occupied, next.x, next.y)
    occupied.add(`${slot.x},${slot.y}`)
    placed.set(room.roomId, slot)

    queueDirectionalNeighbors(room, roomById, placed, queue, slot, directionOffset)
  }

  return startX + 6
}

function buildDirectionalFloorLayout(floorRooms) {
  if (floorRooms.length === 0) {
    return []
  }

  const directionOffset = {
    north: { x: 0, y: -1 },
    east: { x: 1, y: 0 },
    south: { x: 0, y: 1 },
    west: { x: -1, y: 0 },
  }

  const roomById = new Map(floorRooms.map((room) => [room.roomId, room]))
  const sortedRooms = [...floorRooms].sort((a, b) => a.roomId - b.roomId)
  const placed = new Map()
  const occupied = new Set()
  let componentStartX = 0

  for (const seed of sortedRooms) {
    if (placed.has(seed.roomId)) {
      continue
    }

    componentStartX = placeDirectionalComponent(
      seed.roomId,
      componentStartX,
      roomById,
      occupied,
      placed,
      directionOffset,
    )
  }

  const placedValues = Array.from(placed.values())
  const minX = Math.min(...placedValues.map((point) => point.x))
  const minY = Math.min(...placedValues.map((point) => point.y))

  return sortedRooms.map((room, index) => {
    const fallback = { x: index % 5, y: Math.floor(index / 5) }
    const position = placed.get(room.roomId) ?? fallback
    return {
      ...room,
      x: position.x - minX,
      y: position.y - minY,
    }
  })
}

function applyReciprocalLinks(rooms, savedRoom) {
  const nextRooms = rooms.map((room) => ({ ...room, exits: { ...room.exits } }))
  const savedRoomCopy = { ...savedRoom, exits: { ...savedRoom.exits } }
  const existingIndex = nextRooms.findIndex((room) => room.roomId === savedRoomCopy.roomId)

  if (existingIndex >= 0) {
    nextRooms[existingIndex] = savedRoomCopy
  } else {
    nextRooms.push(savedRoomCopy)
  }

  // Remove stale links pointing to this room before reapplying the current save state.
  for (const room of nextRooms) {
    if (room.roomId === savedRoomCopy.roomId) {
      continue
    }

    for (const direction of allDirections) {
      if (room.exits[direction] === savedRoomCopy.roomId) {
        room.exits[direction] = null
      }
    }
  }

  // Tie both sides of each selected exit direction during save.
  for (const direction of allDirections) {
    const targetId = savedRoomCopy.exits[direction]
    if (!targetId) {
      continue
    }

    const targetRoom = nextRooms.find((room) => room.roomId === targetId)
    if (!targetRoom) {
      continue
    }

    const reverseDirection = oppositeDirection[direction]
    targetRoom.exits[reverseDirection] = savedRoomCopy.roomId
  }

  return nextRooms
}

function mapRoomForState(rawRoom) {
  return {
    roomId: Number(rawRoom.roomId),
    roomName: String(rawRoom.roomName ?? ''),
    roomDescription: String(rawRoom.roomDescription ?? ''),
    roomFloor: Number(rawRoom.roomFloor),
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

function mapItemForState(rawItem, index) {
  const itemLocation = rawItem.location ?? rawItem.itemLocation ?? rawItem.roomId ?? ''
  const contentsSource = Array.isArray(rawItem.contents) ? rawItem.contents : []

  const itemContents = contentsSource
    .map((content) => {
      if (content === null || content === undefined) {
        return null
      }

      if (typeof content === 'object') {
        const nestedId = content.itemId ?? content.id
        return nestedId === null || nestedId === undefined ? null : String(nestedId)
      }

      return String(content)
    })
    .filter(Boolean)

  return {
    itemId: Number(rawItem.itemId ?? rawItem.id ?? index + 1),
    itemName: String(rawItem.itemName ?? rawItem.name ?? ''),
    itemWeight: rawItem.itemWeight ?? rawItem.weight ?? '',
    itemDescription: String(rawItem.itemDescription ?? rawItem.description ?? ''),
    itemValue: rawItem.itemValue ?? rawItem.value ?? '',
    canHoldItems: Boolean(rawItem.canHoldItems ?? rawItem.canHold ?? false),
    canBeCarried: Boolean(rawItem.canBeCarried ?? rawItem.canCarry ?? false),
    itemLocation: itemLocation === null || itemLocation === undefined ? '' : String(itemLocation),
    itemContents,
  }
}

function getValidatedItemLocation(itemForm, roomsById) {
  const itemLocation = itemForm.itemLocation === '' ? null : toNullableNumber(itemForm.itemLocation)
  if (itemForm.itemLocation !== '' && (itemLocation === null || !roomsById.has(itemLocation))) {
    return { error: 'Selected item room was not found.' }
  }

  return { itemLocation }
}

function getValidatedNumericValue(rawValue, label) {
  const normalizedValue = rawValue === '' ? null : Number(rawValue)
  if (normalizedValue !== null && Number.isNaN(normalizedValue)) {
    return { error: `${label} must be a number.` }
  }

  return { value: normalizedValue }
}

function getNormalizedContents(itemForm) {
  return Array.isArray(itemForm.itemContents)
    ? Array.from(new Set(itemForm.itemContents.filter(Boolean)))
    : []
}

function validateContentsSelection(itemForm, selectedContents, currentItems) {
  if (!itemForm.canHoldItems) {
    return null
  }

  const availableItemIds = new Set(currentItems.map((item) => String(item.itemId)))
  const hasInvalidContents = selectedContents.some((itemId) => !availableItemIds.has(itemId))
  return hasInvalidContents ? 'One or more selected contents items are invalid.' : null
}

function renderSelectedRoomPanel(
  selectedRoomPanelMode,
  selectedRoom,
  selectedRoomItems,
  roomsById,
  onSelectItemForEdit,
) {
  if (selectedRoomPanelMode === 'items') {
    return (
      <>
        <h3>{selectedRoom.roomName} Items</h3>
        {selectedRoomItems.length === 0 ? (
          <p className="muted">No items are currently assigned to this room.</p>
        ) : (
          <ul className="gg-item-list">
            {selectedRoomItems.map((item) => (
              <li key={item.itemId}>
                <button
                  type="button"
                  className="gg-item-select-button"
                  onClick={() => onSelectItemForEdit(item)}
                  aria-label={`Edit ${item.itemName}`}
                >
                  <strong>{item.itemName}</strong>
                  <span>{item.itemDescription || 'No description.'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </>
    )
  }

  return (
    <>
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
    </>
  )
}

function buildItemSaveResult({ gonfName, itemForm, roomsById, currentItems, currentSelectedRoomId }) {
  if (!gonfName.trim()) {
    return { error: 'Gonf Name is required before saving items.' }
  }

  if (!itemForm.itemName.trim()) {
    return { error: 'Item Name is required.' }
  }

  const locationResult = getValidatedItemLocation(itemForm, roomsById)
  if (locationResult.error) {
    return { error: locationResult.error }
  }
  const itemLocation = locationResult.itemLocation

  const weightResult = getValidatedNumericValue(itemForm.itemWeight, 'Item Weight')
  if (weightResult.error) {
    return { error: weightResult.error }
  }
  const itemWeight = weightResult.value

  const valueResult = getValidatedNumericValue(itemForm.itemValue, 'Item Value')
  if (valueResult.error) {
    return { error: valueResult.error }
  }
  const itemValue = valueResult.value

  const selectedContents = getNormalizedContents(itemForm)

  const contentsError = validateContentsSelection(itemForm, selectedContents, currentItems)
  if (contentsError) {
    return { error: contentsError }
  }

  const editingItemId = toNullableNumber(itemForm.itemId)
  const nextItemId = editingItemId ?? (Math.max(0, ...currentItems.map((item) => item.itemId)) + 1)
  const savedItem = {
    itemId: nextItemId,
    itemName: itemForm.itemName.trim(),
    itemWeight,
    itemDescription: itemForm.itemDescription.trim(),
    itemValue,
    canHoldItems: Boolean(itemForm.canHoldItems),
    canBeCarried: Boolean(itemForm.canBeCarried),
    itemLocation: itemLocation === null ? '' : String(itemLocation),
    itemContents: itemForm.canHoldItems ? selectedContents : [],
  }

  const nextItems = currentItems.some((item) => item.itemId === nextItemId)
    ? currentItems.map((item) => (item.itemId === nextItemId ? savedItem : item))
    : [...currentItems, savedItem]

  return {
    nextItems,
    nextSelectedRoomId: itemLocation ?? currentSelectedRoomId,
    message: `Saved item ${savedItem.itemName} to ${itemLocation ? roomNameById(roomsById, itemLocation) : 'the Gonf without a room assignment'}.`,
  }
}

function parseLoadedGonf(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.rooms)) {
    throw new Error('File is missing a valid rooms array.')
  }

  const rooms = payload.rooms
    .map((rawRoom) => {
      const roomFloor = Number(rawRoom.roomFloor)
      if (!Number.isFinite(roomFloor) || !floors.includes(roomFloor)) {
        return null
      }



      return mapRoomForState(rawRoom)
    })
    .filter(Boolean)

  const items = Array.isArray(payload.items)
    ? payload.items.map((rawItem, index) => mapItemForState(rawItem, index)).filter(Boolean)
    : []

  return {
    gonfName: String(payload.gonfName ?? ''),
    rooms,
    items,
  }
}

export default function GonfGenerator() {
  const [gonfName, setGonfName] = useState('')
  const [rooms, setRooms] = useState([])
  const [items, setItems] = useState([])
  const [form, setForm] = useState(createEmptyForm())
  const [itemForm, setItemForm] = useState(createEmptyItemForm())
  const [activeTab, setActiveTab] = useState('rooms')
  const [activeFloor, setActiveFloor] = useState(1)
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [selectedRoomPanelMode, setSelectedRoomPanelMode] = useState('room')
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
  const positionedFloorRooms = useMemo(() => buildDirectionalFloorLayout(floorRooms), [floorRooms])
  const selectedFloorNumber = form.roomFloor === '' ? null : Number(form.roomFloor)
  const upTargetFloor = getTargetFloor(selectedFloorNumber, 'up')
  const downTargetFloor = getTargetFloor(selectedFloorNumber, 'down')
  const floorConnections = useMemo(() => buildFloorConnections(positionedFloorRooms), [positionedFloorRooms])
  const roomItemCounts = useMemo(() => {
    const counts = new Map()

    for (const item of items) {
      if (!item.itemLocation) {
        continue
      }

      counts.set(item.itemLocation, (counts.get(item.itemLocation) ?? 0) + 1)
    }

    return counts
  }, [items])

  const gridColumns = useMemo(
    () => Math.max(5, ...positionedFloorRooms.map((room) => room.x + 1), 1),
    [positionedFloorRooms],
  )
  const gridRows = useMemo(
    () => Math.max(4, ...positionedFloorRooms.map((room) => room.y + 1), 1),
    [positionedFloorRooms],
  )

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
  const selectedRoomItems = useMemo(
    () => items.filter((item) => item.itemLocation && Number(item.itemLocation) === selectedRoom?.roomId),
    [items, selectedRoom],
  )

  const roomOptions = useMemo(
    () => rooms.map((room) => ({ value: room.roomId, label: room.roomName })),
    [rooms],
  )

  const contentsOptions = useMemo(
    () =>
      items
        .filter((item) => String(item.itemId) !== String(itemForm.itemId ?? ''))
        .map((item) => ({ value: String(item.itemId), label: item.itemName })),
    [items, itemForm.itemId],
  )

  const onFormChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const onItemFormChange = (field, value) => {
    setItemForm((current) => ({ ...current, [field]: value }))
  }

  const onCanHoldItemsChange = (checked) => {
    setItemForm((current) => ({
      ...current,
      canHoldItems: checked,
      itemContents: checked ? current.itemContents : [],
    }))
  }

  const onItemContentsChange = (event) => {
    const selectedValues = Array.from(event.target.selectedOptions, (option) => option.value)
    onItemFormChange('itemContents', selectedValues)
  }

  const onCreateNewGonf = () => {
    // GONF-006C: this action intentionally clears all in-memory Gonf and map state.
    setGonfName('')
    setRooms([])
    setItems([])
    setForm(createEmptyForm())
    setItemForm(createEmptyItemForm())
    setActiveTab('rooms')
    setSelectedRoomId(null)
    setSelectedRoomPanelMode('room')
    setActiveFloor(1)
    setStatusMessage('Started a new Gonf. Form and map are cleared until you save a room or load a Gonf.')
    setLoadInputKey((key) => key + 1)
  }

  const onClearForm = () => {
    setForm(createEmptyForm())
    setSelectedRoomId(null)
    setSelectedRoomPanelMode('room')
    setStatusMessage('Cleared room form fields.')
  }

  const onClearItemForm = () => {
    setItemForm(createEmptyItemForm())
    setStatusMessage('Cleared item form fields.')
  }

  const onSelectRoom = (room) => {
    setSelectedRoomId(room.roomId)
    setSelectedRoomPanelMode('room')
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

  const onShowRoomItems = (room) => {
    setSelectedRoomId(room.roomId)
    setSelectedRoomPanelMode('items')
    setStatusMessage(`Showing items found in ${room.roomName}.`)
  }

  const onSelectItemForEdit = (item) => {
    const itemLocationId = toNullableNumber(item.itemLocation)
    const targetRoom = itemLocationId ? roomsById.get(itemLocationId) : null

    setActiveTab('items')
    setItemForm({
      itemId: item.itemId,
      itemName: item.itemName,
      itemWeight: item.itemWeight ?? '',
      itemDescription: item.itemDescription,
      itemValue: item.itemValue ?? '',
      canHoldItems: Boolean(item.canHoldItems),
      canBeCarried: Boolean(item.canBeCarried),
      itemLocation: item.itemLocation ?? '',
      itemContents: Array.isArray(item.itemContents) ? item.itemContents.map(String) : [],
    })

    if (targetRoom) {
      setSelectedRoomId(targetRoom.roomId)
      setActiveFloor(targetRoom.roomFloor)
      setSelectedRoomPanelMode('items')
    }

    setStatusMessage(`Loaded item ${item.itemName} into the item form.`)
  }

  const onJumpToVerticalExit = (event, room, direction) => {
    event.stopPropagation()

    const targetId = room.exits[direction]
    if (!targetId) {
      return
    }

    const targetRoom = roomsById.get(targetId)
    if (!targetRoom) {
      setStatusMessage(`Could not follow ${direction} exit because the referenced room was not found.`)
      return
    }

    setActiveFloor(targetRoom.roomFloor)
    onSelectRoom(targetRoom)
    setStatusMessage(`Moved to Floor ${targetRoom.roomFloor} via ${direction} exit.`)
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

      const savedRoom = {
        roomId: nextRoomId,
        roomName: form.roomName.trim(),
        roomDescription: form.roomDescription.trim(),
        roomFloor,
        exits: {
          north: toNullableNumber(form.northExit),
          east: toNullableNumber(form.eastExit),
          south: toNullableNumber(form.southExit),
          west: toNullableNumber(form.westExit),
          up: toNullableNumber(form.upExit),
          down: toNullableNumber(form.downExit),
        },
      }

      const nextRooms = applyReciprocalLinks(currentRooms, savedRoom)

      setSelectedRoomId(nextRoomId)
      setSelectedRoomPanelMode('room')
      setActiveFloor(roomFloor)
      setForm(createEmptyForm())
      setStatusMessage(`Saved room ${savedRoom.roomName} to Gonf ${gonfName.trim()}.`)

      return nextRooms
    })
  }

  const onSaveItem = () => {
    const itemSaveResult = buildItemSaveResult({
      gonfName,
      itemForm,
      roomsById,
      currentItems: items,
      currentSelectedRoomId: selectedRoomId,
    })

    if (itemSaveResult.error) {
      setStatusMessage(itemSaveResult.error)
      return
    }

    setItems(itemSaveResult.nextItems)
    setItemForm(createEmptyItemForm())
    setSelectedRoomPanelMode('items')
    setSelectedRoomId(itemSaveResult.nextSelectedRoomId)
    setStatusMessage(itemSaveResult.message)
  }

  const onSaveGonf = async () => {
    if (!gonfName.trim()) {
      setStatusMessage('Gonf Name is required before saving the Gonf file.')
      return
    }

    const savePayload = {
      gonfName: gonfName.trim(),
      rooms: rooms.map((room) => ({
        roomId: room.roomId,
        roomName: room.roomName,
        roomDescription: room.roomDescription,
        roomFloor: room.roomFloor,
        exits: {
          north: room.exits.north,
          east: room.exits.east,
          south: room.exits.south,
          west: room.exits.west,
          up: room.exits.up,
          down: room.exits.down,
        },
      })),
      items: items.map((item) => ({
        itemId: item.itemId,
        itemName: item.itemName,
        itemWeight: item.itemWeight,
        itemDescription: item.itemDescription,
        itemValue: item.itemValue,
        canHoldItems: item.canHoldItems,
        canBeCarried: item.canBeCarried,
        location: item.itemLocation === '' ? null : Number(item.itemLocation),
        contents: Array.isArray(item.itemContents)
          ? item.itemContents.map(Number).filter((itemId) => Number.isFinite(itemId))
          : [],
      })),
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/gonf/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(savePayload),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.success) {
        const message = payload?.errors?.[0]?.message ?? 'Could not save Gonf. Please try again.'
        setStatusMessage(message)
        return
      }

      const message = payload?.data?.message ?? `Saved Gonf to C:\\Gonf\\${gonfName.trim()}.json.`
      setStatusMessage(message)
    } catch {
      setStatusMessage('Could not save Gonf because the save service is unavailable.')
    }
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
      setItems(loaded.items)
      setForm(createEmptyForm())
      setItemForm(createEmptyItemForm())
      setSelectedRoomPanelMode('room')
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
              <span>Load Existing Gonf</span>
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
          <button type="button" className="gg-save-gonf-top-button" onClick={onSaveGonf}>
            Save Gonf
          </button>
        </div>

        {statusMessage && <output className="status status-info">{statusMessage}</output>}

        <div className="gg-tab-strip" role="tablist" aria-label="Gonf Editor Sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'rooms'}
            className={activeTab === 'rooms' ? 'is-active' : ''}
            onClick={() => setActiveTab('rooms')}
          >
            Rooms
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'items'}
            className={activeTab === 'items' ? 'is-active' : ''}
            onClick={() => setActiveTab('items')}
          >
            Items
          </button>
        </div>

        {activeTab === 'rooms' ? (
          <>
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
          </>
        ) : (
          <>
            <div className="gg-item-form-grid">
              <input type="hidden" name="itemId" value={itemForm.itemId ?? ''} />

              <label className="gg-field">
                <span>Item Name</span>
                <input
                  type="text"
                  placeholder="Unique item name"
                  value={itemForm.itemName}
                  onChange={(event) => onItemFormChange('itemName', event.target.value)}
                />
              </label>

              <label className="gg-field">
                <span>Item Weight</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemForm.itemWeight}
                  onChange={(event) => onItemFormChange('itemWeight', event.target.value)}
                />
              </label>

              <label className="gg-field gg-wide">
                <span>Item Description</span>
                <textarea
                  rows={3}
                  value={itemForm.itemDescription}
                  onChange={(event) => onItemFormChange('itemDescription', event.target.value)}
                />
              </label>

              <label className="gg-field">
                <span>Item Value</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={itemForm.itemValue}
                  onChange={(event) => onItemFormChange('itemValue', event.target.value)}
                />
              </label>

              <label className="gg-field gg-checkbox-field">
                <span>Can Hold Items</span>
                <input
                  type="checkbox"
                  checked={itemForm.canHoldItems}
                  onChange={(event) => onCanHoldItemsChange(event.target.checked)}
                />
              </label>

              <label className="gg-field gg-checkbox-field">
                <span>Can Be Carried</span>
                <input
                  type="checkbox"
                  checked={itemForm.canBeCarried}
                  onChange={(event) => onItemFormChange('canBeCarried', event.target.checked)}
                />
              </label>

              <label className="gg-field gg-wide">
                <span>Location</span>
                <select
                  value={itemForm.itemLocation}
                  onChange={(event) => onItemFormChange('itemLocation', event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {roomOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <small>All rooms are available regardless of floor.</small>
              </label>

              {itemForm.canHoldItems && (
                <label className="gg-field gg-wide">
                  <span>Contents</span>
                  <select
                    className="gg-multi-select"
                    multiple
                    size={Math.min(6, Math.max(3, contentsOptions.length || 3))}
                    value={itemForm.itemContents}
                    onChange={onItemContentsChange}
                  >
                    {contentsOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <small>Select one or more items contained by this object.</small>
                </label>
              )}
            </div>

            <div className="gg-button-row">
              <button type="button" className="gg-save-button" onClick={onSaveItem}>
                Save Item
              </button>
              <button type="button" className="gg-clear-button" onClick={onClearItemForm}>
                Clear
              </button>
            </div>
          </>
        )}
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

        {positionedFloorRooms.length === 0 ? (
          <p className="muted">Map is empty for Floor {activeFloor}. Save a room or load an existing Gonf.</p>
        ) : (
          <div className="gg-map-layout">
            <div
              className="gg-map-canvas"
              role="application"
              aria-label="Room map canvas"
              style={{
                gridTemplateColumns: `repeat(${gridColumns}, minmax(70px, 1fr))`,
                gridTemplateRows: `repeat(${gridRows}, minmax(70px, auto))`,
              }}
            >
              <svg className="gg-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {floorConnections.map((line, index) => {
                  const from = getRoomCenter(line.from, gridColumns, gridRows)
                  const to = getRoomCenter(line.to, gridColumns, gridRows)
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

              {positionedFloorRooms.map((room) => (
                <div
                  key={room.roomId}
                  className={`gg-room-card ${selectedRoomId === room.roomId ? 'is-selected' : ''}`}
                  style={{ gridColumn: room.x + 1, gridRow: room.y + 1 }}
                >
                  <button
                    type="button"
                    className="gg-room-select-button"
                    onClick={() => onSelectRoom(room)}
                    aria-label={`Select ${room.roomName}`}
                  >
                    {room.roomName}
                  </button>
                  {roomItemCounts.get(String(room.roomId)) > 0 && (
                    <button
                      type="button"
                      className="gg-room-item-indicator"
                      aria-label={`View items found in ${room.roomName}`}
                      title={`View items found in ${room.roomName}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onShowRoomItems(room)
                      }}
                    >
                      i
                    </button>
                  )}
                  {room.exits.up && (
                    <button
                      type="button"
                      className="gg-room-vertical-exit gg-room-exit-up"
                      aria-label={`Go up to ${roomNameById(roomsById, room.exits.up)}`}
                      title={`Up to ${roomNameById(roomsById, room.exits.up)}`}
                      onClick={(event) => onJumpToVerticalExit(event, room, 'up')}
                    >
                      ↑
                    </button>
                  )}
                  {room.exits.down && (
                    <button
                      type="button"
                      className="gg-room-vertical-exit gg-room-exit-down"
                      aria-label={`Go down to ${roomNameById(roomsById, room.exits.down)}`}
                      title={`Down to ${roomNameById(roomsById, room.exits.down)}`}
                      onClick={(event) => onJumpToVerticalExit(event, room, 'down')}
                    >
                      ↓
                    </button>
                  )}
                </div>
              ))}
            </div>

            {selectedRoom && (
              <aside className="gg-room-popover" aria-live="polite">
                {renderSelectedRoomPanel(
                  selectedRoomPanelMode,
                  selectedRoom,
                  selectedRoomItems,
                  roomsById,
                  onSelectItemForEdit,
                )}
              </aside>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
