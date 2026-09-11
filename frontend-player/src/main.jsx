import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import GonfPlayerApp from './GonfPlayerApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GonfPlayerApp />
  </StrictMode>,
)
