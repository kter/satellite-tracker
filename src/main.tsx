import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installDebugApi } from './test/debugApi'
import './styles/global.css'

installDebugApi()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
