import { fireEvent, render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('shows initial upload guidance', () => {
    render(<App />)
    expect(screen.getByText('JSON to Schema Preview')).toBeInTheDocument()
    expect(screen.getByText('Upload a JSON file to generate a schema preview.')).toBeInTheDocument()
  })

  it('shows validation error when submit is clicked without a file', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Generate Preview' }))

    expect(await screen.findByText(/FILE_REQUIRED/i)).toBeInTheDocument()
    expect(screen.getByText(/Please select a .json file before submitting./i)).toBeInTheDocument()
  })

  it('handles malformed successful API payloads gracefully', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 200,
        success: true,
        errors: [],
        schema: {},
      }),
    })

    render(<App />)

    const fileInput = screen.getByLabelText('JSON File')
    const jsonFile = new File(['{"name":"Ava"}'], 'sample.json', { type: 'application/json' })
    fireEvent.change(fileInput, { target: { files: [jsonFile] } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate Preview' }))

    expect(await screen.findByText(/MALFORMED_RESPONSE/i)).toBeInTheDocument()
    expect(screen.getByText(/unexpected response format/i)).toBeInTheDocument()

    fetchSpy.mockRestore()
  })

  it('shows room, item, and character tabs in the Gonf Generator section', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Gonf Generator' }))

    expect(screen.getByRole('tab', { name: 'Rooms' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Items' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Character' })).toBeInTheDocument()
  })

  it('shows character fields and actions when character tab is selected', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Gonf Generator' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Character' }))

    expect(screen.getByLabelText('Character Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Wanderer' })).toBeInTheDocument()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Character' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
  })

  it('does not list Secret Storage as a manual character location', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Gonf Generator' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Character' }))

    expect(screen.queryByRole('option', { name: 'Secret Storage' })).not.toBeInTheDocument()
  })

  it('shows contents multi-select only when can hold items is checked', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Gonf Generator' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Items' }))

    expect(screen.queryByText('Contents')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Can Hold Items' }))

    expect(screen.getByText('Contents')).toBeInTheDocument()
  })

  it('does not list Secret Storage as an assignable item location', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Gonf Generator' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Items' }))

    expect(screen.queryByRole('option', { name: 'Secret Storage' })).not.toBeInTheDocument()
  })

  it('sends items and characters in the Save Gonf payload', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 200,
        success: true,
        errors: [],
        data: {
          path: 'C:\\Gonf\\TestGonf.json',
          message: 'Saved Gonf to C:\\Gonf\\TestGonf.json.',
        },
      }),
    })

    render(<App />)

    try {
      fireEvent.click(screen.getByRole('button', { name: 'Gonf Generator' }))
      fireEvent.change(screen.getByLabelText('Gonf Name'), { target: { value: 'TestGonf' } })

      fireEvent.click(screen.getByRole('tab', { name: 'Items' }))
      fireEvent.change(screen.getByLabelText('Item Name'), { target: { value: 'Loose Key' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save Item' }))

      fireEvent.click(screen.getByRole('tab', { name: 'Character' }))
      fireEvent.change(screen.getByLabelText('Character Name'), { target: { value: 'Ava' } })

      fireEvent.click(screen.getByRole('button', { name: 'Save Gonf' }))

      expect(fetchSpy).toHaveBeenCalledTimes(1)

      const requestBody = JSON.parse(fetchSpy.mock.calls[0][1].body)
      expect(requestBody.items).toHaveLength(1)
      expect(requestBody.items[0].itemName).toBe('Loose Key')
      expect(requestBody.characters).toHaveLength(1)
      expect(requestBody.characters[0].characterName).toBe('Ava')
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('defaults character location to Secret Storage and shows map character indicator', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Gonf Generator' }))
    fireEvent.change(screen.getByLabelText('Gonf Name'), { target: { value: 'TestGonf' } })
    fireEvent.click(screen.getByRole('tab', { name: 'Character' }))
    fireEvent.change(screen.getByLabelText('Character Name'), { target: { value: 'Ava' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Character' }))

    expect(screen.getByText(/Saved character Ava to Secret Storage/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View characters found in Secret Storage' })).toBeInTheDocument()
  })

  it('removes contained items from Secret Storage room-level item listing', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Gonf Generator' }))
    fireEvent.change(screen.getByLabelText('Gonf Name'), { target: { value: 'TestGonf' } })

    fireEvent.click(screen.getByRole('tab', { name: 'Items' }))
    fireEvent.change(screen.getByLabelText('Item Name'), { target: { value: 'Loose Key' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Item' }))

    fireEvent.change(screen.getByLabelText('Item Name'), { target: { value: 'Satchel' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Can Hold Items' }))
    const contentsList = screen.getByRole('listbox')
    const looseKeyOption = screen.getByRole('option', { name: 'Loose Key' })
    looseKeyOption.selected = true
    fireEvent.change(contentsList)
    fireEvent.click(screen.getByRole('button', { name: 'Save Item' }))

    fireEvent.click(screen.getByRole('tab', { name: 'Floor -5' }))
    fireEvent.click(screen.getByRole('button', { name: 'View items found in Secret Storage' }))

    expect(screen.queryByRole('button', { name: 'Edit Loose Key' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Satchel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit contained item Loose Key' })).toBeInTheDocument()
  })

  it('removes item from container contents when a character starts carrying it', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Gonf Generator' }))
    fireEvent.change(screen.getByLabelText('Gonf Name'), { target: { value: 'TestGonf' } })

    fireEvent.click(screen.getByRole('tab', { name: 'Items' }))
    fireEvent.change(screen.getByLabelText('Item Name'), { target: { value: 'Loose Key' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Item' }))

    fireEvent.change(screen.getByLabelText('Item Name'), { target: { value: 'Satchel' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Can Hold Items' }))
    const itemContentsList = screen.getByRole('listbox')
    const looseKeyInItemOption = screen.getByRole('option', { name: 'Loose Key' })
    looseKeyInItemOption.selected = true
    fireEvent.change(itemContentsList)
    fireEvent.click(screen.getByRole('button', { name: 'Save Item' }))

    fireEvent.click(screen.getByRole('tab', { name: 'Character' }))
    fireEvent.change(screen.getByLabelText('Character Name'), { target: { value: 'Ava' } })
    const characterContainsList = screen.getByRole('listbox')
    const looseKeyInCharacterOption = screen.getByRole('option', { name: 'Loose Key' })
    looseKeyInCharacterOption.selected = true
    fireEvent.change(characterContainsList)
    fireEvent.click(screen.getByRole('button', { name: 'Save Character' }))

    fireEvent.click(screen.getByRole('tab', { name: 'Floor -5' }))
    fireEvent.click(screen.getByRole('button', { name: 'View items found in Secret Storage' }))

    expect(screen.getByRole('button', { name: 'Edit Satchel' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit contained item Loose Key' })).not.toBeInTheDocument()
  })

  it('auto-creates Secret Storage for unassigned items and blocks room-form edits', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Gonf Generator' }))

    fireEvent.change(screen.getByLabelText('Gonf Name'), { target: { value: 'TestGonf' } })
    fireEvent.click(screen.getByRole('tab', { name: 'Items' }))
    fireEvent.change(screen.getByLabelText('Item Name'), { target: { value: 'Loose Key' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Item' }))

    expect(screen.getByText(/Saved item Loose Key to Secret Storage/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Floor -5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select Secret Storage' }))

    expect(
      screen.getByText(/Secret Storage is system-managed and cannot be edited from the room form/i),
    ).toBeInTheDocument()
  })

  it('blocks manual creation of a system-managed room name with a friendly error', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Gonf Generator' }))
    fireEvent.change(screen.getByLabelText('Gonf Name'), { target: { value: 'TestGonf' } })
    fireEvent.change(screen.getByLabelText('Room Name'), { target: { value: 'Secret Storage' } })
    fireEvent.change(screen.getByLabelText('Room Floor'), { target: { value: '-5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Room' }))

    expect(
      screen.getByText(/Secret Storage is a system-managed room name and cannot be created manually/i),
    ).toBeInTheDocument()
  })

  it('does not auto-protect a legacy Secret Storage room when legacy exits are populated', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Gonf Generator' }))

    const legacyGonf = {
      gonfName: 'LegacyGonf',
      rooms: [
        {
          roomId: 1,
          roomName: 'Secret Storage',
          roomDescription: 'Legacy room that still has exits',
          roomFloor: -5,
          northExit: 2,
          eastExit: '',
          southExit: '',
          westExit: '',
          upExit: '',
          downExit: '',
        },
        {
          roomId: 2,
          roomName: 'Anchor Room',
          roomDescription: 'Neighbor room',
          roomFloor: -5,
          northExit: '',
          eastExit: '',
          southExit: '',
          westExit: '',
          upExit: '',
          downExit: '',
        },
      ],
      items: [],
    }

    const loadFile = new File([JSON.stringify(legacyGonf)], 'legacy-gonf.json', {
      type: 'application/json',
    })

    fireEvent.change(screen.getByLabelText('Load Existing Gonf'), {
      target: { files: [loadFile] },
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Select Secret Storage' }))

    expect(screen.queryByText(/Secret Storage is system-managed and cannot be edited/i)).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Secret Storage')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Room Description'), {
      target: { value: 'Legacy room that still has exits - updated' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Room' }))

    expect(screen.queryByText(/cannot be created manually/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Saved room Secret Storage to Gonf LegacyGonf/i)).toBeInTheDocument()
  })
})
