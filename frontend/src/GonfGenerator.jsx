import { useMemo, useState } from 'react'
import { API_BASE_URL, floors, toNullableNumber } from './gonf/shared'
import {
  applyReciprocalLinks,
  buildDirectionalFloorLayout,
  buildFloorConnections,
  canEditRoom,
  createEmptyForm,
  createRoomImageCandidate,
  ensureSecretStorageRoom,
  finalizeRoomImageState,
  generateRoomPreviewPngDataUrl,
  getRoomCenter,
  getSystemManagedRoomDefinition,
  getSystemManagedRoomDefinitionByName,
  getTargetFloor,
  isProviderNotConfiguredError,
  isProviderTimeoutError,
  isSystemManagedRoom,
  normalizeRoomName,
  roomNameById,
  renderSelectedRoomPanel,
  requestProviderRoomImage,
  roomToFormState,
  stripSecretStorageExits,
} from './gonf/rooms'
import { createEmptyItemForm, buildItemSaveResult, getValidatedNumericValue } from './gonf/items'
import {
  buildCharacterSaveResult,
  createCharacterImageCandidate,
  createEmptyCharacterForm,
  finalizeCharacterImageState,
  requestProviderCharacterImage,
} from './gonf/characters'
import { parseLoadedGonf } from './gonf/loaders'
export default function GonfGenerator() {
  const [gonfName, setGonfName] = useState('')
  const [rooms, setRooms] = useState([])
  const [items, setItems] = useState([])
  const [characters, setCharacters] = useState([])
  const [form, setForm] = useState(createEmptyForm())
  const [itemForm, setItemForm] = useState(createEmptyItemForm())
  const [characterForm, setCharacterForm] = useState(createEmptyCharacterForm())
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

  const roomCharacterCounts = useMemo(() => {
    const counts = new Map()

    for (const character of characters) {
      if (!character.characterLocation) {
        continue
      }

      counts.set(character.characterLocation, (counts.get(character.characterLocation) ?? 0) + 1)
    }

    return counts
  }, [characters])

  const gridColumns = useMemo(
    () => Math.max(5, ...positionedFloorRooms.map((room) => room.x + 1), 1),
    [positionedFloorRooms],
  )
  const gridRows = useMemo(
    () => Math.max(4, ...positionedFloorRooms.map((room) => room.y + 1), 1),
    [positionedFloorRooms],
  )

  const horizontalExitOptions = rooms
    .filter(
      (room) =>
        room.roomFloor === selectedFloorNumber &&
        room.roomId !== toNullableNumber(form.roomId) &&
        !isSystemManagedRoom(room),
    )
    .map((room) => ({ value: room.roomId, label: room.roomName }))

  const upExitOptions =
    upTargetFloor === null
      ? []
      : rooms
          .filter(
            (room) =>
              room.roomFloor === upTargetFloor &&
              room.roomId !== toNullableNumber(form.roomId) &&
              !isSystemManagedRoom(room),
          )
          .map((room) => ({ value: room.roomId, label: room.roomName }))

  const downExitOptions =
    downTargetFloor === null
      ? []
      : rooms
          .filter(
            (room) =>
              room.roomFloor === downTargetFloor &&
              room.roomId !== toNullableNumber(form.roomId) &&
              !isSystemManagedRoom(room),
          )
          .map((room) => ({ value: room.roomId, label: room.roomName }))

  const selectedRoom = roomsById.get(selectedRoomId) ?? floorRooms[0] ?? null
  const selectedRoomItems = useMemo(
    () => items.filter((item) => item.itemLocation && Number(item.itemLocation) === selectedRoom?.roomId),
    [items, selectedRoom],
  )
  const selectedRoomCharacters = useMemo(
    () =>
      characters.filter(
        (character) => character.characterLocation && Number(character.characterLocation) === selectedRoom?.roomId,
      ),
    [characters, selectedRoom],
  )

  const roomOptions = useMemo(
    () =>
      rooms
        .filter((room) => !isSystemManagedRoom(room))
        .map((room) => ({ value: room.roomId, label: room.roomName })),
    [rooms],
  )

  const itemsById = useMemo(() => {
    const map = new Map()
    for (const item of items) {
      map.set(String(item.itemId), item)
    }
    return map
  }, [items])

  const selectedCharacter = useMemo(() => {
    const selectedCharacterId = toNullableNumber(characterForm.characterId)
    if (selectedCharacterId === null) {
      return null
    }

    return characters.find((character) => character.characterId === selectedCharacterId) ?? null
  }, [characters, characterForm.characterId])

  const contentsOptions = useMemo(
    () =>
      items
        .filter((item) => String(item.itemId) !== String(itemForm.itemId ?? ''))
        .map((item) => ({ value: String(item.itemId), label: item.itemName })),
    [items, itemForm.itemId],
  )

  const characterContainsOptions = useMemo(
    () => items.map((item) => ({ value: String(item.itemId), label: item.itemName })),
    [items],
  )

  const onFormChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const onItemFormChange = (field, value) => {
    setItemForm((current) => ({ ...current, [field]: value }))
  }

  const onCharacterFormChange = (field, value) => {
    setCharacterForm((current) => ({ ...current, [field]: value }))
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

  const onCharacterContainsChange = (event) => {
    const selectedValues = Array.from(event.target.selectedOptions, (option) => option.value)
    onCharacterFormChange('characterContains', selectedValues)
  }

  const onCreateNewGonf = () => {
    // GONF-006C: this action intentionally clears all in-memory Gonf and map state.
    setGonfName('')
    setRooms([])
    setItems([])
    setCharacters([])
    setForm(createEmptyForm())
    setItemForm(createEmptyItemForm())
    setCharacterForm(createEmptyCharacterForm())
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

  const onClearCharacterForm = () => {
    setCharacterForm(createEmptyCharacterForm())
    setStatusMessage('Cleared character form fields.')
  }

  const onSelectRoom = (room) => {
    setSelectedRoomId(room.roomId)
    setSelectedRoomPanelMode('room')

    if (!canEditRoom(room)) {
      setForm(createEmptyForm())
      const systemManagedDefinition = getSystemManagedRoomDefinition(room)
      setStatusMessage(
        `${systemManagedDefinition?.name ?? 'This room'} is system-managed and cannot be edited from the room form.`,
      )
      return
    }

    setForm(roomToFormState(room))
    setStatusMessage(`Loaded room ${room.roomName} into the form.`)
  }

  const onShowRoomItems = (room) => {
    setSelectedRoomId(room.roomId)
    setSelectedRoomPanelMode('items')
    setStatusMessage(`Showing items found in ${room.roomName}.`)
  }

  const onShowRoomCharacters = (room) => {
    setSelectedRoomId(room.roomId)
    setSelectedRoomPanelMode('characters')
    setStatusMessage(`Showing characters found in ${room.roomName}.`)
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

  const onSelectContainedItem = (itemId) => {
    const containedItem = itemsById.get(String(itemId))
    if (!containedItem) {
      setStatusMessage('Could not load contained item details because the item was not found.')
      return
    }

    onSelectItemForEdit(containedItem)
  }

  const onSelectCharacterForEdit = (character) => {
    const targetRoom = toNullableNumber(character.characterLocation)
      ? roomsById.get(toNullableNumber(character.characterLocation))
      : null

    setActiveTab('character')
    setCharacterForm({
      characterId: character.characterId,
      characterName: character.characterName,
      characterDescription: character.characterDescription ?? '',
      characterLocation: character.characterLocation ?? '',
      characterWanderer: Boolean(character.characterWanderer),
      characterContains: Array.isArray(character.characterContains)
        ? character.characterContains.map(String)
        : [],
    })

    if (targetRoom) {
      setSelectedRoomId(targetRoom.roomId)
      setActiveFloor(targetRoom.roomFloor)
      setSelectedRoomPanelMode('characters')
    }

    setStatusMessage(`Loaded character ${character.characterName} into the character form.`)
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

  const onRetryRoomImage = (room) => {
    if (!room) {
      return
    }

    const nextAttemptIndex = Number(room.image?.attemptIndex ?? -1) + 1
    const nextImage = createRoomImageCandidate(room, nextAttemptIndex)

    setRooms((currentRooms) =>
      currentRooms.map((existingRoom) =>
        existingRoom.roomId === room.roomId
          ? {
              ...existingRoom,
              image: nextImage,
            }
          : existingRoom,
      ),
    )

    void (async () => {
      const providerResult = await requestProviderRoomImage(gonfName, room, nextImage)
      if (!providerResult.success) {
        if (isProviderNotConfiguredError(providerResult)) {
          const fallbackPreview = generateRoomPreviewPngDataUrl(
            room.roomName,
            room.roomDescription,
            nextImage.generationSeed,
            nextImage.attemptIndex,
          )

          setRooms((currentRooms) =>
            currentRooms.map((existingRoom) =>
              existingRoom.roomId === room.roomId && (existingRoom.image?.generationSeed ?? '') === nextImage.generationSeed
                ? {
                    ...existingRoom,
                    image: {
                      ...existingRoom.image,
                      imageStatus: 'candidate-ready',
                      previewDataUrl: fallbackPreview,
                    },
                  }
                : existingRoom,
            ),
          )

          setStatusMessage(
            `Image provider key not configured. Generated a local preview for ${room.roomName} instead.`,
          )
          return
        }

        if (isProviderTimeoutError(providerResult)) {
          setRooms((currentRooms) =>
            currentRooms.map((existingRoom) =>
              existingRoom.roomId === room.roomId && (existingRoom.image?.generationSeed ?? '') === nextImage.generationSeed
                ? {
                    ...existingRoom,
                    image: {
                      ...existingRoom.image,
                      imageStatus: 'generating',
                    },
                  }
                : existingRoom,
            ),
          )

          setStatusMessage(
            `Image generation is still running for ${room.roomName}. Check back shortly and retry if needed.`,
          )
          return
        }

        setRooms((currentRooms) =>
          currentRooms.map((existingRoom) =>
            existingRoom.roomId === room.roomId && (existingRoom.image?.generationSeed ?? '') === nextImage.generationSeed
              ? {
                  ...existingRoom,
                  image: {
                    ...existingRoom.image,
                    imageStatus: 'error',
                  },
                }
              : existingRoom,
          ),
        )

        setStatusMessage(`Image generation failed for ${room.roomName}: ${providerResult.errorMessage}`)
        return
      }

      setRooms((currentRooms) =>
        currentRooms.map((existingRoom) => {
          if (existingRoom.roomId !== room.roomId) {
            return existingRoom
          }

          if ((existingRoom.image?.generationSeed ?? '') !== nextImage.generationSeed) {
            return existingRoom
          }

          return {
            ...existingRoom,
            image: {
              ...existingRoom.image,
              imageStatus: 'candidate-ready',
              previewDataUrl: providerResult.previewDataUrl,
            },
          }
        }),
      )
    })()

    setStatusMessage(`Generated a new room image candidate for ${room.roomName}.`)
  }

  const onConfirmRoomImage = (room) => {
    if (!room) {
      return
    }

    setRooms((currentRooms) =>
      currentRooms.map((existingRoom) =>
        existingRoom.roomId === room.roomId
          ? {
              ...existingRoom,
              image: finalizeRoomImageState(existingRoom),
            }
          : existingRoom,
      ),
    )

    setStatusMessage(`Finalized the room image for ${room.roomName}.`)
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

    const editingRoomId = toNullableNumber(form.roomId)
    const existingRoom = editingRoomId !== null ? roomsById.get(editingRoomId) : null

    const systemManagedDefinition = getSystemManagedRoomDefinitionByName(form.roomName)
    if (systemManagedDefinition) {
      const isLegacyUpdateForSameNamedRoom =
        Boolean(existingRoom) &&
        !isSystemManagedRoom(existingRoom) &&
        normalizeRoomName(existingRoom.roomName) === normalizeRoomName(systemManagedDefinition.name)

      if (!isLegacyUpdateForSameNamedRoom) {
        setStatusMessage(
          `${systemManagedDefinition.name} is a system-managed room name and cannot be created manually.`,
        )
        return
      }
    }

    const roomFloor = Number(form.roomFloor)

    if (editingRoomId !== null) {
      if (existingRoom && isSystemManagedRoom(existingRoom)) {
        const existingDefinition = getSystemManagedRoomDefinition(existingRoom)
        setStatusMessage(`${existingDefinition?.name ?? 'This room'} is system-managed and cannot be edited.`)
        setForm(createEmptyForm())
        return
      }
    }

    setRooms((currentRooms) => {
      const nextRoomId = editingRoomId ?? (Math.max(0, ...currentRooms.map((room) => room.roomId)) + 1)
      const existingRoomForImage = currentRooms.find((room) => room.roomId === nextRoomId)
      const previousAttemptIndex = Number(existingRoomForImage?.image?.attemptIndex ?? -1)
      const nextAttemptIndex = previousAttemptIndex + 1

      const savedRoom = {
        roomId: nextRoomId,
        roomName: form.roomName.trim(),
        roomDescription: form.roomDescription.trim(),
        image: createRoomImageCandidate(
          {
            roomName: form.roomName.trim(),
            roomDescription: form.roomDescription.trim(),
          },
          nextAttemptIndex,
        ),
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

      void (async () => {
        const providerResult = await requestProviderRoomImage(gonfName, savedRoom, savedRoom.image)
        if (!providerResult.success) {
          if (isProviderNotConfiguredError(providerResult)) {
            const fallbackPreview = generateRoomPreviewPngDataUrl(
              savedRoom.roomName,
              savedRoom.roomDescription,
              savedRoom.image.generationSeed,
              savedRoom.image.attemptIndex,
            )

            setRooms((latestRooms) =>
              latestRooms.map((latestRoom) =>
                latestRoom.roomId === nextRoomId && (latestRoom.image?.generationSeed ?? '') === savedRoom.image.generationSeed
                  ? {
                      ...latestRoom,
                      image: {
                        ...latestRoom.image,
                        imageStatus: 'candidate-ready',
                        previewDataUrl: fallbackPreview,
                      },
                    }
                  : latestRoom,
              ),
            )

            setStatusMessage(
              `Room saved. Image provider key is not configured, so a local preview was generated for ${savedRoom.roomName}.`,
            )
            return
          }

          if (isProviderTimeoutError(providerResult)) {
            setRooms((latestRooms) =>
              latestRooms.map((latestRoom) =>
                latestRoom.roomId === nextRoomId && (latestRoom.image?.generationSeed ?? '') === savedRoom.image.generationSeed
                  ? {
                      ...latestRoom,
                      image: {
                        ...latestRoom.image,
                        imageStatus: 'generating',
                      },
                    }
                  : latestRoom,
              ),
            )

            setStatusMessage(
              `Room saved. Image generation for ${savedRoom.roomName} is still running and will complete shortly.`,
            )
            return
          }

          setRooms((latestRooms) =>
            latestRooms.map((latestRoom) =>
              latestRoom.roomId === nextRoomId && (latestRoom.image?.generationSeed ?? '') === savedRoom.image.generationSeed
                ? {
                    ...latestRoom,
                    image: {
                      ...latestRoom.image,
                      imageStatus: 'error',
                    },
                  }
                : latestRoom,
            ),
          )

          setStatusMessage(`Room saved, but image generation failed: ${providerResult.errorMessage}`)
          return
        }

        setRooms((latestRooms) =>
          latestRooms.map((latestRoom) => {
            if (latestRoom.roomId !== nextRoomId) {
              return latestRoom
            }

            if ((latestRoom.image?.generationSeed ?? '') !== savedRoom.image.generationSeed) {
              return latestRoom
            }

            return {
              ...latestRoom,
              image: {
                ...latestRoom.image,
                imageStatus: 'candidate-ready',
                previewDataUrl: providerResult.previewDataUrl,
              },
            }
          }),
        )
      })()

      const nextRooms = stripSecretStorageExits(applyReciprocalLinks(currentRooms, savedRoom))

      setSelectedRoomId(nextRoomId)
      setSelectedRoomPanelMode('room')
      setActiveFloor(roomFloor)
      setForm(createEmptyForm())
      setStatusMessage(`Saved room ${savedRoom.roomName} and generated a room image candidate.`)

      return nextRooms
    })
  }

  const onSaveItem = () => {
    let roomsForValidation = rooms
    let defaultItemLocation = ''

    if (itemForm.itemLocation === '') {
      const ensuredSecretStorage = ensureSecretStorageRoom(rooms)
      roomsForValidation = ensuredSecretStorage.rooms
      defaultItemLocation = String(ensuredSecretStorage.roomId)

      if (ensuredSecretStorage.created) {
        setRooms(roomsForValidation)
      } else {
        const roomsDiffer = JSON.stringify(roomsForValidation) !== JSON.stringify(rooms)
        if (roomsDiffer) {
          setRooms(roomsForValidation)
        }
      }
    }

    const validationRoomsById = new Map(roomsForValidation.map((room) => [room.roomId, room]))

    const itemSaveResult = buildItemSaveResult({
      gonfName,
      itemForm: {
        ...itemForm,
        defaultItemLocation,
      },
      roomsById: validationRoomsById,
      currentItems: items,
      currentCharacters: characters,
      currentSelectedRoomId: selectedRoomId,
    })

    if (itemSaveResult.error) {
      setStatusMessage(itemSaveResult.error)
      return
    }

    setItems(itemSaveResult.nextItems)
    setCharacters(itemSaveResult.nextCharacters)
    setItemForm(createEmptyItemForm())
    setSelectedRoomPanelMode('items')
    setSelectedRoomId(itemSaveResult.nextSelectedRoomId)
    setStatusMessage(itemSaveResult.message)
  }

  const onSaveCharacter = () => {
    const characterSaveResult = buildCharacterSaveResult({
      gonfName,
      characterForm,
      rooms,
      currentItems: items,
      currentCharacters: characters,
    })

    if (characterSaveResult.error) {
      setStatusMessage(characterSaveResult.error)
      return
    }

    const savedCharacter = characterSaveResult.nextCharacters.find(
      (character) => character.characterId === toNullableNumber(characterForm.characterId) ||
        character.characterName === characterForm.characterName.trim(),
    )

    const nextAttemptIndex = Number(savedCharacter?.image?.attemptIndex ?? -1) + 1
    const nextImage = createCharacterImageCandidate(savedCharacter, nextAttemptIndex)

    const nextCharactersWithCandidate = characterSaveResult.nextCharacters.map((character) =>
      character.characterId === savedCharacter?.characterId
        ? {
            ...character,
            image: nextImage,
          }
        : character,
    )

    setRooms(characterSaveResult.nextRooms)
    setItems(characterSaveResult.nextItems)
    setCharacters(nextCharactersWithCandidate)
    setCharacterForm(createEmptyCharacterForm())
    setSelectedRoomPanelMode('characters')
    setSelectedRoomId(characterSaveResult.nextSelectedRoomId)
    setActiveFloor(characterSaveResult.nextSelectedFloor)
    setStatusMessage(`${characterSaveResult.message} Generated a character image candidate.`)

    if (!savedCharacter) {
      return
    }

    void (async () => {
      const providerResult = await requestProviderCharacterImage(gonfName, savedCharacter, nextImage)
      if (!providerResult.success) {
        if (isProviderNotConfiguredError(providerResult)) {
          const fallbackPreview = generateRoomPreviewPngDataUrl(
            savedCharacter.characterName,
            savedCharacter.characterDescription,
            nextImage.generationSeed,
            nextImage.attemptIndex,
          )

          setCharacters((latestCharacters) =>
            latestCharacters.map((latestCharacter) =>
              latestCharacter.characterId === savedCharacter.characterId && (latestCharacter.image?.generationSeed ?? '') === nextImage.generationSeed
                ? {
                    ...latestCharacter,
                    image: {
                      ...latestCharacter.image,
                      imageStatus: 'candidate-ready',
                      previewDataUrl: fallbackPreview,
                    },
                  }
                : latestCharacter,
            ),
          )

          setStatusMessage(
            `Character saved. Image provider key is not configured, so a local preview was generated for ${savedCharacter.characterName}.`,
          )
          return
        }

        if (isProviderTimeoutError(providerResult)) {
          setCharacters((latestCharacters) =>
            latestCharacters.map((latestCharacter) =>
              latestCharacter.characterId === savedCharacter.characterId && (latestCharacter.image?.generationSeed ?? '') === nextImage.generationSeed
                ? {
                    ...latestCharacter,
                    image: {
                      ...latestCharacter.image,
                      imageStatus: 'generating',
                    },
                  }
                : latestCharacter,
            ),
          )

          setStatusMessage(
            `Character saved. Image generation for ${savedCharacter.characterName} is still running and will complete shortly.`,
          )
          return
        }

        setCharacters((latestCharacters) =>
          latestCharacters.map((latestCharacter) =>
            latestCharacter.characterId === savedCharacter.characterId && (latestCharacter.image?.generationSeed ?? '') === nextImage.generationSeed
              ? {
                  ...latestCharacter,
                  image: {
                    ...latestCharacter.image,
                    imageStatus: 'error',
                  },
                }
              : latestCharacter,
          ),
        )

        setStatusMessage(`Character saved, but image generation failed: ${providerResult.errorMessage}`)
        return
      }

      setCharacters((latestCharacters) =>
        latestCharacters.map((latestCharacter) => {
          if (latestCharacter.characterId !== savedCharacter.characterId) {
            return latestCharacter
          }

          if ((latestCharacter.image?.generationSeed ?? '') !== nextImage.generationSeed) {
            return latestCharacter
          }

          return {
            ...latestCharacter,
            image: {
              ...latestCharacter.image,
              imageStatus: 'candidate-ready',
              previewDataUrl: providerResult.previewDataUrl,
            },
          }
        }),
      )
    })()
  }

  const onRetryCharacterImage = (character) => {
    if (!character) {
      return
    }

    const nextAttemptIndex = Number(character.image?.attemptIndex ?? -1) + 1
    const nextImage = createCharacterImageCandidate(character, nextAttemptIndex)

    setCharacters((currentCharacters) =>
      currentCharacters.map((existingCharacter) =>
        existingCharacter.characterId === character.characterId
          ? {
              ...existingCharacter,
              image: nextImage,
            }
          : existingCharacter,
      ),
    )

    void (async () => {
      const providerResult = await requestProviderCharacterImage(gonfName, character, nextImage)
      if (!providerResult.success) {
        if (isProviderNotConfiguredError(providerResult)) {
          const fallbackPreview = generateRoomPreviewPngDataUrl(
            character.characterName,
            character.characterDescription,
            nextImage.generationSeed,
            nextImage.attemptIndex,
          )

          setCharacters((currentCharacters) =>
            currentCharacters.map((existingCharacter) =>
              existingCharacter.characterId === character.characterId && (existingCharacter.image?.generationSeed ?? '') === nextImage.generationSeed
                ? {
                    ...existingCharacter,
                    image: {
                      ...existingCharacter.image,
                      imageStatus: 'candidate-ready',
                      previewDataUrl: fallbackPreview,
                    },
                  }
                : existingCharacter,
            ),
          )

          setStatusMessage(
            `Image provider key not configured. Generated a local preview for ${character.characterName} instead.`,
          )
          return
        }

        if (isProviderTimeoutError(providerResult)) {
          setCharacters((currentCharacters) =>
            currentCharacters.map((existingCharacter) =>
              existingCharacter.characterId === character.characterId && (existingCharacter.image?.generationSeed ?? '') === nextImage.generationSeed
                ? {
                    ...existingCharacter,
                    image: {
                      ...existingCharacter.image,
                      imageStatus: 'generating',
                    },
                  }
                : existingCharacter,
            ),
          )

          setStatusMessage(
            `Image generation is still running for ${character.characterName}. Check back shortly and retry if needed.`,
          )
          return
        }

        setCharacters((currentCharacters) =>
          currentCharacters.map((existingCharacter) =>
            existingCharacter.characterId === character.characterId && (existingCharacter.image?.generationSeed ?? '') === nextImage.generationSeed
              ? {
                  ...existingCharacter,
                  image: {
                    ...existingCharacter.image,
                    imageStatus: 'error',
                  },
                }
              : existingCharacter,
          ),
        )

        setStatusMessage(`Image generation failed for ${character.characterName}: ${providerResult.errorMessage}`)
        return
      }

      setCharacters((currentCharacters) =>
        currentCharacters.map((existingCharacter) => {
          if (existingCharacter.characterId !== character.characterId) {
            return existingCharacter
          }

          if ((existingCharacter.image?.generationSeed ?? '') !== nextImage.generationSeed) {
            return existingCharacter
          }

          return {
            ...existingCharacter,
            image: {
              ...existingCharacter.image,
              imageStatus: 'candidate-ready',
              previewDataUrl: providerResult.previewDataUrl,
            },
          }
        }),
      )
    })()

    setStatusMessage(`Generated a new character image candidate for ${character.characterName}.`)
  }

  const onConfirmCharacterImage = (character) => {
    if (!character) {
      return
    }

    setCharacters((currentCharacters) =>
      currentCharacters.map((existingCharacter) =>
        existingCharacter.characterId === character.characterId
          ? {
              ...existingCharacter,
              image: finalizeCharacterImageState(existingCharacter),
            }
          : existingCharacter,
      ),
    )

    setStatusMessage(`Finalized the character image for ${character.characterName}.`)
  }

  const onSaveGonf = async () => {
    if (!gonfName.trim()) {
      setStatusMessage('Gonf Name is required before saving the Gonf file.')
      return
    }

    const finalizedRooms = rooms.map((room) => ({
      ...room,
      image: finalizeRoomImageState(room),
    }))

    setRooms(finalizedRooms)

    const draftCharacters = characterForm.characterName.trim()
      ? [
          {
            characterId: 1,
            characterName: characterForm.characterName.trim(),
            characterDescription: characterForm.characterDescription.trim(),
            characterLocation:
              characterForm.characterLocation === '' ? null : Number(characterForm.characterLocation),
            characterWanderer: Boolean(characterForm.characterWanderer),
            characterContains: Array.isArray(characterForm.characterContains)
              ? characterForm.characterContains.map(Number).filter((itemId) => Number.isFinite(itemId))
              : [],
            image: null,
          },
        ]
      : []

    const validatedItems = []
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      const itemLabel = item.itemName?.trim() || `Item ${index + 1}`

      const weightResult = getValidatedNumericValue(item.itemWeight, `Item Weight for ${itemLabel}`)
      if (weightResult.error) {
        setStatusMessage(weightResult.error)
        return
      }

      const valueResult = getValidatedNumericValue(item.itemValue, `Item Value for ${itemLabel}`)
      if (valueResult.error) {
        setStatusMessage(valueResult.error)
        return
      }

      validatedItems.push({
        ...item,
        itemWeight: weightResult.value,
        itemValue: valueResult.value,
      })
    }

    const savePayload = {
      gonfName: gonfName.trim(),
      rooms: finalizedRooms.map((room) => ({
        roomId: room.roomId,
        roomName: room.roomName,
        roomDescription: room.roomDescription,
        roomFloor: room.roomFloor,
        systemManagedRoomKey: room.systemManagedRoomKey ?? null,
        isSecretStorage: Boolean(room.isSecretStorage),
        image: {
          imageStatus: room.image?.imageStatus ?? 'none',
          attemptIndex: room.image?.attemptIndex ?? 0,
          generationSeed: room.image?.generationSeed ?? '',
          generatedUtc: room.image?.generatedUtc ?? null,
          finalizedUtc: room.image?.finalizedUtc ?? null,
          fileName: room.image?.fileName ?? '',
          relativePath: room.image?.relativePath ?? '',
          previewDataUrl: room.image?.previewDataUrl ?? '',
        },
        exits: {
          north: room.exits.north,
          east: room.exits.east,
          south: room.exits.south,
          west: room.exits.west,
          up: room.exits.up,
          down: room.exits.down,
        },
      })),
      items: validatedItems.map((item) => ({
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
      characters: (characters.length > 0 ? characters : draftCharacters).map((character, index) => ({
        characterId: character.characterId ?? index + 1,
        characterName: character.characterName,
        description: character.characterDescription ?? '',
        location: character.characterLocation === '' || character.characterLocation === null ? null : Number(character.characterLocation),
        wanderer: Boolean(character.characterWanderer),
        contains: Array.isArray(character.characterContains)
          ? character.characterContains.map(Number).filter((itemId) => Number.isFinite(itemId))
          : [],
        image: {
          imageStatus: character.image?.imageStatus ?? 'none',
          attemptIndex: character.image?.attemptIndex ?? 0,
          generationSeed: character.image?.generationSeed ?? '',
          generatedUtc: character.image?.generatedUtc ?? null,
          finalizedUtc: character.image?.finalizedUtc ?? null,
          fileName: character.image?.fileName ?? '',
          relativePath: character.image?.relativePath ?? '',
          previewDataUrl: character.image?.previewDataUrl ?? '',
        },
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

      const message = payload?.data?.message ?? `Saved Gonf to C:\\gonf\\${gonfName.trim()}\\${gonfName.trim()}.json.`
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
      setCharacters(loaded.characters)
      setForm(loaded.rooms[0] ? roomToFormState(loaded.rooms[0]) : createEmptyForm())
      setItemForm(createEmptyItemForm())
      setCharacterForm(
        loaded.characters[0]
          ? {
              characterId: loaded.characters[0].characterId,
              characterName: loaded.characters[0].characterName,
              characterDescription: loaded.characters[0].characterDescription,
              characterLocation: loaded.characters[0].characterLocation,
              characterWanderer: loaded.characters[0].characterWanderer,
              characterContains: loaded.characters[0].characterContains,
            }
          : createEmptyCharacterForm(),
      )
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
        <p>Create, load, and maintain Gonf data. The Gonf will generate a map based on the rooms. Items can be generated and placed within the map. The map remains empty until rooms are saved or loaded.</p>
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
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'character'}
            className={activeTab === 'character' ? 'is-active' : ''}
            onClick={() => setActiveTab('character')}
          >
            Character
          </button>
        </div>

        {activeTab === 'rooms' && (
          <div className="gg-tab-content">
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
          </div>
        )}

        {activeTab === 'items' && (
          <div className="gg-tab-content">
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
                <small>Assignable rooms are available regardless of floor.</small>
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
          </div>
        )}

        {activeTab === 'character' && (
          <div className="gg-tab-content">
            <div className="gg-item-form-grid">
              <input type="hidden" name="characterId" value={characterForm.characterId ?? ''} />

              <label className="gg-field gg-wide">
                <span>Character Name</span>
                <input
                  type="text"
                  placeholder="Character name"
                  value={characterForm.characterName}
                  onChange={(event) => onCharacterFormChange('characterName', event.target.value)}
                />
              </label>

              <label className="gg-field gg-wide">
                <span>Description</span>
                <textarea
                  rows={3}
                  value={characterForm.characterDescription}
                  onChange={(event) => onCharacterFormChange('characterDescription', event.target.value)}
                />
              </label>

              <label className="gg-field gg-wide">
                <span>Location</span>
                <select
                  value={characterForm.characterLocation}
                  onChange={(event) => onCharacterFormChange('characterLocation', event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {roomOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <small>System-managed rooms are excluded from manual assignment.</small>
              </label>

              <label className="gg-field gg-checkbox-field">
                <span>Wanderer</span>
                <input
                  type="checkbox"
                  checked={Boolean(characterForm.characterWanderer)}
                  onChange={(event) => onCharacterFormChange('characterWanderer', event.target.checked)}
                />
              </label>

              <label className="gg-field gg-wide">
                <span>Contains</span>
                <select
                  className="gg-multi-select"
                  multiple
                  size={Math.min(6, Math.max(3, characterContainsOptions.length || 3))}
                  value={characterForm.characterContains}
                  onChange={onCharacterContainsChange}
                >
                  {characterContainsOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <small>Select one or more items carried by this character.</small>
              </label>

              <section className="gg-room-image-preview gg-wide" aria-label="Character image preview">
                <div className={`gg-room-image-frame ${selectedCharacter?.image?.imageStatus === 'generating' ? 'is-generating' : ''}`}>
                  {selectedCharacter?.image?.previewDataUrl ? (
                    <img
                      src={selectedCharacter.image.previewDataUrl}
                      alt={`Generated character preview for ${selectedCharacter.characterName}`}
                    />
                  ) : (
                    <div className="gg-room-image-empty">No generated image yet.</div>
                  )}
                  {selectedCharacter?.image?.imageStatus === 'generating' && (
                    <div className="gg-room-image-badge" aria-live="polite">
                      Generating final render...
                    </div>
                  )}
                </div>

                <div className="gg-room-image-actions">
                  <button
                    type="button"
                    className="gg-room-image-retry"
                    onClick={() => onRetryCharacterImage(selectedCharacter)}
                    aria-label={`Retry image for ${selectedCharacter?.characterName ?? 'character'}`}
                    title="Retry image"
                    disabled={!selectedCharacter}
                  >
                    <span aria-hidden="true">↻</span>
                  </button>
                  <button
                    type="button"
                    className="gg-room-image-confirm"
                    onClick={() => onConfirmCharacterImage(selectedCharacter)}
                    aria-label={`Confirm image for ${selectedCharacter?.characterName ?? 'character'}`}
                    title="Confirm image"
                    disabled={!selectedCharacter}
                  >
                    <span aria-hidden="true">✓</span>
                  </button>
                </div>

                <p className="gg-room-image-status">
                  Image status: {selectedCharacter?.image?.imageStatus ?? 'none'}
                </p>
              </section>
            </div>

            <div className="gg-button-row">
              <button type="button" className="gg-save-button" onClick={onSaveCharacter}>
                Save Character
              </button>
              <button type="button" className="gg-clear-button" onClick={onClearCharacterForm}>
                Clear
              </button>
            </div>
          </div>
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
                  {roomCharacterCounts.get(String(room.roomId)) > 0 && (
                    <button
                      type="button"
                      className="gg-room-character-indicator"
                      aria-label={`View characters found in ${room.roomName}`}
                      title={`View characters found in ${room.roomName}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onShowRoomCharacters(room)
                      }}
                    >
                      c
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
                {renderSelectedRoomPanel({
                  selectedRoomPanelMode,
                  selectedRoom,
                  selectedRoomItems,
                  selectedRoomCharacters,
                  roomsById,
                  itemsById,
                  onRetryRoomImage,
                  onConfirmRoomImage,
                  onRetryCharacterImage,
                  onConfirmCharacterImage,
                  onSelectItemForEdit,
                  onSelectContainedItem,
                  onSelectCharacterForEdit,
                })}
              </aside>
            )}
          </div>
        )}
      </section>
    </main>
  )
}

