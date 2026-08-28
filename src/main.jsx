import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx' // <-- Add this

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider> {/* <-- Add this */}
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider> {/* <-- Add this */}
  </React.StrictMode>,
)