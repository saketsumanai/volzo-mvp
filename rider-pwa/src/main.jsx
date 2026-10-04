import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { connectSocket } from './services/socket'

// Auto-reconnect socket on page refresh if token exists
const savedToken = localStorage.getItem('rider_token')
if (savedToken) {
  connectSocket(savedToken)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
