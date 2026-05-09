import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Genshougi from './Genshougi.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Genshougi />
  </StrictMode>,
)
