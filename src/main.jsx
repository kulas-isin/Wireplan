import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import GithubAutoSync from './components/GithubAutoSync.jsx'
import { StoreProvider } from './store/StoreContext.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      <GithubAutoSync />
      <App />
    </StoreProvider>
  </React.StrictMode>,
)
