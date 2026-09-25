import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ProjectProvider } from './state/project-context'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Racine introuvable.')

createRoot(root).render(
  <StrictMode>
    <ProjectProvider>
      <App />
    </ProjectProvider>
  </StrictMode>,
)
