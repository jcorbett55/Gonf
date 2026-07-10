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

  it('shows room and item tabs in the Gonf Generator section', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Gonf Generator' }))

    expect(screen.getByRole('tab', { name: 'Rooms' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Items' })).toBeInTheDocument()
  })
})
