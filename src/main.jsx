import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import FirstView from './components/FirstView'

createRoot(document.getElementById('root')).render(<FirstView />)
