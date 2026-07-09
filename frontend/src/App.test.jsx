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
})
