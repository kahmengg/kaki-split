import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import PwaUpdatePrompt from './components/PwaUpdatePrompt'
import App from './App.jsx'
import { AuthProvider } from './hooks/useAuth'
import { ThemeProvider } from './hooks/useTheme'
import { queryClient } from './lib/queryClient'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    {/* Capacitor ships its own assets and must not register the web service worker. */}
    {!Capacitor.isNativePlatform() && <PwaUpdatePrompt />}
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>,
)
