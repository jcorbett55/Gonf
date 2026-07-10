import { useMemo, useState } from 'react'
import './App.css'
import GonfGenerator from './GonfGenerator'
import GonfGeneratorMockup from './GonfGeneratorMockup'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5131'

const statusMessages = {
  404: 'We could not reach the schema service endpoint (404). Please verify the API is running.',
  500: 'The server could not process this upload. Please verify your JSON and try again.',
  502: 'The service is temporarily unavailable (502). Please try again shortly.',
}

const malformedResponseError = {
  code: 'MALFORMED_RESPONSE',
  message: 'The service returned an unexpected response format. Please try again.',
}

function normalizeErrors(payload) {
  return Array.isArray(payload?.errors) ? payload.errors : []
}

function normalizeSchema(payload) {
  return Array.isArray(payload?.schema) ? payload.schema : null
}

function App() {
  const [activeSection, setActiveSection] = useState('schema')
  const [selectedFile, setSelectedFile] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [schemaNodes, setSchemaNodes] = useState([])
  const [errors, setErrors] = useState([])
  const [lastCode, setLastCode] = useState(null)

  const statusBanner = useMemo(() => {
    if (isLoading) {
      return 'Generating schema preview...'
    }

    if (errors.length > 0) {
      return 'Upload failed. Review the details below.'
    }

    if (schemaNodes.length > 0) {
      return `Generated ${schemaNodes.length} schema node${schemaNodes.length > 1 ? 's' : ''}.`
    }

    return 'Upload a JSON file to generate a schema preview.'
  }, [errors.length, isLoading, schemaNodes.length])

  const onFileChange = (event) => {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
    setErrors([])
    setSchemaNodes([])
    setLastCode(null)
  }

  const onSubmit = async (event) => {
    event.preventDefault()

    if (!selectedFile) {
      setErrors([{ code: 'FILE_REQUIRED', message: 'Please select a .json file before submitting.' }])
      setSchemaNodes([])
      setLastCode(null)
      return
    }

    const formData = new FormData()
    formData.append('file', selectedFile)

    setIsLoading(true)
    setErrors([])
    setSchemaNodes([])
    setLastCode(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/schema/preview`, {
        method: 'POST',
        body: formData,
      })

      const payload = await response.json().catch(() => null)
      const normalizedErrors = normalizeErrors(payload)

      setLastCode(payload?.code ?? response.status)

      if (!response.ok || !payload?.success) {
        if (normalizedErrors.length > 0) {
          setErrors(normalizedErrors)
        } else {
          setErrors([
            {
              code: `HTTP_${response.status}`,
              message: statusMessages[response.status] ?? 'The request failed. Please try again.',
            },
          ])
        }
        return
      }

      const normalizedSchema = normalizeSchema(payload)
      if (normalizedSchema === null) {
        setErrors([malformedResponseError])
        setSchemaNodes([])
        return
      }

      setSchemaNodes(normalizedSchema)
    } catch {
      setErrors([
        {
          code: 'NETWORK_ERROR',
          message: 'Unable to reach the API. Ensure backend is running and try again.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <nav className="section-switcher" aria-label="Application Sections">
        <button
          type="button"
          className={activeSection === 'schema' ? 'is-active' : ''}
          onClick={() => setActiveSection('schema')}
        >
          Schema Preview
        </button>
        <button
          type="button"
          className={activeSection === 'gg' ? 'is-active' : ''}
          onClick={() => setActiveSection('gg')}
        >
          Gonf Generator
        </button>
        <button
          type="button"
          className={`${activeSection === 'gg-mockup' ? 'is-active' : ''} mockup-tab`}
          onClick={() => setActiveSection('gg-mockup')}
        >
          Gonf Generator (Mockup)
        </button>
      </nav>

      {activeSection === 'schema' ? (
        <main className="app-shell">
          <section className="panel intro-panel">
            <p className="eyebrow">Gonf / Sprint 1</p>
            <h1>JSON to Schema Preview</h1>
            <p>
              Upload a JSON file to generate minimal schema nodes with path, inferred type, and
              repeatable object or field hints.
            </p>
          </section>

          <section className="panel workflow-panel">
            <form onSubmit={onSubmit} className="upload-form">
              <label htmlFor="jsonFile">JSON File</label>
              <input
                id="jsonFile"
                type="file"
                accept=".json,application/json"
                onChange={onFileChange}
              />
              <button type="submit" disabled={isLoading}>
                {isLoading ? 'Generating...' : 'Generate Preview'}
              </button>
            </form>

            <output className={`status ${errors.length > 0 ? 'status-error' : 'status-info'}`}>
              {statusBanner}
            </output>

            {lastCode && <p className="code-pill">Response Code: {lastCode}</p>}

            {errors.length > 0 && (
              <div className="error-box" role="alert" aria-live="assertive">
                <h2>Validation and Service Errors</h2>
                <ul>
                  {errors.map((error, index) => (
                    <li key={`${error.code}-${index}`}>
                      <strong>{error.code}:</strong> {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="preview-box" aria-live="polite">
              <h2>Schema Preview</h2>
              {schemaNodes.length === 0 ? (
                <p className="muted">No schema nodes yet. Submit a valid JSON file to render preview.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Path</th>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Array</th>
                        <th>Object</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schemaNodes.map((node, index) => (
                        <tr key={`${node.path}-${index}`}>
                          <td>{node.path}</td>
                          <td>{node.fieldName}</td>
                          <td>{node.inferredType}</td>
                          <td>{node.isArray ? 'yes' : 'no'}</td>
                          <td>{node.isObject ? 'yes' : 'no'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </main>
      ) : activeSection === 'gg' ? (
        <GonfGenerator />
      ) : (
        <GonfGeneratorMockup />
      )}
    </>
  )
}

export default App
