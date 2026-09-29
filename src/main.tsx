import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { KitchenApp } from './components/kitchen/KitchenApp'
import { KitchenProvider } from './state/kitchen-context'
import { ProjectProvider } from './state/project-context'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Racine introuvable.')

function Shell() {
  const [kitchen, setKitchen] = useState(() => window.location.hash.startsWith('#cuisine'))

  useEffect(() => {
    function sync() {
      setKitchen(window.location.hash.startsWith('#cuisine'))
    }
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  return kitchen ? <KitchenApp /> : <App />
}

createRoot(root).render(
  <StrictMode>
    <ProjectProvider>
      <KitchenProvider>
        <Shell />
      </KitchenProvider>
    </ProjectProvider>
  </StrictMode>,
)
